"""ots-industry-agent — parse APQC industry PCFs into process baselines.

  uv run ots-industry-agent list           # discovered industry PDFs
  uv run ots-industry-agent check           # drift report (no writes)
  uv run ots-industry-agent sync            # sync all changed industries
  uv run ots-industry-agent sync --industry retail --force
  uv run ots-industry-agent sync --all --force

Designed to run periodically (cron / CI) so baselines track evolving standards:
`check` exits non-zero when any industry is new/changed, so a scheduler can
trigger a `sync` (and open a review PR for the agent-drafted mappings).
"""

from __future__ import annotations

import json

import typer

from .agent import INDUSTRIES_DIR, check as run_check, discover, sync_all, sync_industry

app = typer.Typer(help="OTS industry-standards agent")


@app.command("list")
def list_industries() -> None:
    """List the industry PCF PDFs the agent recognises."""
    for pdf, slug, label in discover(INDUSTRIES_DIR):
        typer.echo(f"{slug:28} {label:32} {pdf.name}")


@app.command()
def check() -> None:
    """Report drift vs the emitted baselines (no writes). Non-zero on drift."""
    report = run_check()
    typer.echo(json.dumps(report, indent=2))
    drifted = [r for r in report if r["status"] in ("new", "changed", "missing-output")]
    if drifted:
        typer.echo(f"\n{len(drifted)} industr(y/ies) need sync: "
                   + ", ".join(r["slug"] for r in drifted), err=True)
        raise typer.Exit(1)
    typer.echo("\nAll industries current.")


@app.command()
def sync(
    industry: str = typer.Option(None, help="single industry slug; omit for all"),
    all: bool = typer.Option(False, "--all", help="sync every discovered industry"),
    force: bool = typer.Option(False, help="re-emit even if the PDF is unchanged"),
) -> None:
    """Parse + emit baselines for changed (or all) industries."""
    if industry:
        match = [t for t in discover(INDUSTRIES_DIR) if t[1] == industry]
        if not match:
            typer.echo(f"Unknown industry: {industry}", err=True)
            raise typer.Exit(1)
        pdf, slug, label = match[0]
        results = [sync_industry(pdf, slug, label, force=force)]
    else:
        if not all:
            typer.echo("Pass --industry <slug> or --all.", err=True)
            raise typer.Exit(1)
        results = sync_all(force=force)

    failed = False
    for r in results:
        tasks = sum(r.stream_tasks.values())
        typer.echo(
            f"{r.slug:28} {r.status:10} elements={r.element_count:5} "
            f"subtrees={tasks:3} problems={len(r.problems)}"
        )
        for problem in r.problems:
            typer.echo(f"    - {problem}")
            failed = True
    if failed:
        raise typer.Exit(1)


if __name__ == "__main__":
    app()
