from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fuseki_client import FusekiClient
from models import HealthResponse
from ontology_router import router as ontology_router

fuseki = FusekiClient()


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        if await fuseki.ping():
            await fuseki.ensure_dataset()
    except Exception:
        pass
    yield


app = FastAPI(title="OTS API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ontology_router)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", fuseki=await fuseki.ping())
