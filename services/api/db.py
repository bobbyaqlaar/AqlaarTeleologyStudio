"""Postgres engine + schema + seed for engagement/process persistence.

Schema is created with SQLModel.metadata.create_all on startup — Alembic
migrations come later (docs/TODO-implementation-plan.md Phase 4).
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from sqlmodel import Session, SQLModel, create_engine, select

from db_models import EngagementRow, ProcessStateRow, ValueStreamRow

DATABASE_URL = os.getenv(
    "OTS_DATABASE_URL",
    "postgresql+psycopg://ots:ots@localhost:5434/ots",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

STREAM_TYPES = ["o2c", "p2p", "c2m", "h2r", "t2r"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    seed()


def seed() -> None:
    with Session(engine) as session:
        if session.exec(select(EngagementRow).limit(1)).first():
            return

        consultant = {
            "userId": "user-consultant-1",
            "displayName": "Alex Morgan",
            "role": "consultant",
        }
        stakeholder = {
            "userId": "user-stakeholder-1",
            "displayName": "Jordan Lee",
            "role": "stakeholder",
            "functionUnits": ["finance", "operations"],
        }

        acme = EngagementRow(
            id="eng-acme-001",
            name="Digital transformation — Phase 1",
            client="Acme Corp",
            description="Baseline mapping for five value streams with stakeholder workshops.",
            industry="generic",
            status="active",
            current_step="streams",
            participants=[consultant, stakeholder],
            created_at="2026-05-01T09:00:00.000Z",
            updated_at="2026-06-08T14:30:00.000Z",
        )
        globex = EngagementRow(
            id="eng-globex-002",
            name="Operating model refresh",
            client="Globex Industries",
            description="Initial scoping for O2C and P2P customization.",
            industry="telecom",
            status="draft",
            current_step="streams",
            participants=[consultant],
            created_at="2026-06-05T11:00:00.000Z",
            updated_at="2026-06-05T11:00:00.000Z",
        )
        session.add(acme)
        session.add(globex)

        for engagement, suffix in ((acme, "acme"), (globex, "globex")):
            for stream_type in STREAM_TYPES:
                session.add(
                    ValueStreamRow(
                        id=f"stream-{stream_type}-{suffix}",
                        engagement_id=engagement.id,
                        type=stream_type,
                        baseline_id=f"baseline-{stream_type}",
                        baseline_loaded=suffix == "acme" and stream_type == "o2c",
                        approval_status=(
                            "in_review"
                            if suffix == "acme" and stream_type == "o2c"
                            else "draft"
                        ),
                    )
                )

        session.commit()


def get_session() -> Session:
    return Session(engine)


__all__ = [
    "engine",
    "init_db",
    "get_session",
    "now_iso",
    "STREAM_TYPES",
    "EngagementRow",
    "ValueStreamRow",
    "ProcessStateRow",
]
