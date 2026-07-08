"""Fetch all TM Forum MODA EA-export pages listed in cache/moda_pages.txt.

Resumable: already-fetched URLs (present in the output JSONL) are skipped,
so the script can be killed and re-run. Output format matches the original
ReferenceDocs/moda_dump.jsonl: one JSON object {url, title, html} per line.

Run:  uv run python services/ingest/crawl_moda.py
"""

from __future__ import annotations

import asyncio
import json
import re
import sys
from pathlib import Path

import httpx

HERE = Path(__file__).resolve().parent
PAGE_LIST = HERE / "cache" / "moda_pages.txt"
OUT = HERE / "cache" / "moda_full.jsonl"

CONCURRENCY = 4
DELAY_SECONDS = 0.25  # per worker → ~16 req/s ceiling across pool
HEADERS = {"User-Agent": "OTS-ModaIngest/1.0 (research; contact: bobbyaqlaar@gmail.com)"}
TITLE_RE = re.compile(r"<title>(.*?)</title>", re.IGNORECASE | re.DOTALL)


async def worker(
    client: httpx.AsyncClient,
    queue: asyncio.Queue[str],
    out_handle,
    lock: asyncio.Lock,
    progress: dict[str, int],
) -> None:
    while True:
        try:
            url = queue.get_nowait()
        except asyncio.QueueEmpty:
            return
        try:
            response = await client.get(url, timeout=30)
            if response.status_code == 200:
                match = TITLE_RE.search(response.text)
                record = {
                    "url": url,
                    "title": match.group(1).strip() if match else None,
                    "html": response.text,
                }
                async with lock:
                    out_handle.write(json.dumps(record) + "\n")
                    out_handle.flush()
                    progress["done"] += 1
            else:
                async with lock:
                    progress["errors"] += 1
        except httpx.HTTPError:
            async with lock:
                progress["errors"] += 1
        if progress["done"] % 500 == 0:
            print(f"progress: {progress['done']} fetched, {progress['errors']} errors", flush=True)
        await asyncio.sleep(DELAY_SECONDS)


async def main() -> None:
    urls = PAGE_LIST.read_text().splitlines()
    fetched: set[str] = set()
    if OUT.exists():
        with OUT.open() as handle:
            for line in handle:
                try:
                    fetched.add(json.loads(line)["url"])
                except json.JSONDecodeError:
                    continue

    pending = [u for u in urls if u and u not in fetched]
    print(f"{len(urls)} total, {len(fetched)} already fetched, {len(pending)} pending", flush=True)
    if not pending:
        return

    queue: asyncio.Queue[str] = asyncio.Queue()
    for url in pending:
        queue.put_nowait(url)

    progress = {"done": len(fetched), "errors": 0}
    lock = asyncio.Lock()
    with OUT.open("a") as out_handle:
        async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True) as client:
            await asyncio.gather(
                *(worker(client, queue, out_handle, lock, progress) for _ in range(CONCURRENCY))
            )
    print(f"finished: {progress['done']} fetched, {progress['errors']} errors", flush=True)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(130)
