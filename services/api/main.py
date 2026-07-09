from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Repo-root .env (ANTHROPIC_API_KEY etc.); real env vars take precedence.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from comments_router import router as comments_router
from db import init_db
from engagements_router import router as engagements_router
from fuseki_client import FusekiClient
from gaps_router import router as gaps_router
from models import HealthResponse
from ontology_router import router as ontology_router
from process_router import router as process_router
from teleology_router import router as teleology_router

fuseki = FusekiClient()


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        if await fuseki.ping():
            await fuseki.ensure_dataset()
    except Exception:
        pass
    try:
        init_db()
    except Exception:
        # Postgres optional in dev — engagement/process endpoints will 500,
        # ontology endpoints still work; web app falls back to mock stores.
        pass
    yield


app = FastAPI(title="OTS API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ontology_router)
app.include_router(engagements_router)
app.include_router(process_router)
app.include_router(gaps_router)
app.include_router(comments_router)
app.include_router(teleology_router)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", fuseki=await fuseki.ping())
