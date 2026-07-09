"""Postgres engine + schema + seed for engagement/process persistence.

Schema is created with SQLModel.metadata.create_all on startup — Alembic
migrations come later (docs/TODO-implementation-plan.md Phase 4).
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from sqlmodel import Session, SQLModel, create_engine, select

from db_models import (
    CommentRow,
    EngagementRow,
    ProcessStateRow,
    TeleologyRowDB,
    ValueStreamRow,
)

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
    _seed_engagements()
    _seed_workshop_rows()


def _seed_engagements() -> None:
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


def _seed_workshop_rows() -> None:
    """Comments + teleology demo rows — separate guard so the seeds land on
    databases created before these tables existed."""
    with Session(engine) as session:
        if not session.get(EngagementRow, "eng-acme-001"):
            return
        if session.exec(select(CommentRow).limit(1)).first() or session.exec(
            select(TeleologyRowDB).limit(1)
        ).first():
            return

        session.add(
            CommentRow(
                id="comment-1",
                engagement_id="eng-acme-001",
                stream_type="o2c",
                author_id="user-stakeholder-1",
                author_name="Jordan Lee",
                role="stakeholder",
                target_type="bpmn_element",
                target_id="Task_credit",
                target_label="Credit check",
                function_unit="finance",
                body="Credit check still manual — finance team uses spreadsheet today.",
                resolved=False,
                created_at="2026-06-07T10:15:00.000Z",
            )
        )

        empty_org = {"revenue": [], "cost": [], "cx": [], "ttm": []}
        session.add(
            TeleologyRowDB(
                id="tel-o2c-stream-acme-001",
                engagement_id="eng-acme-001",
                stream_type="o2c",
                goals=[
                    "Reduce order-to-cash cycle time",
                    "Improve collection rate on standard invoices",
                ],
                gaps=[
                    "Manual credit checks delay fulfillment",
                    "Invoice disputes lack root-cause tracking",
                ],
                ambitions=[
                    "Straight-through processing for standard orders",
                    "Automated dunning with CX-safe messaging",
                ],
                org_ambitions={
                    "revenue": ["Increase repeat purchase rate on key accounts"],
                    "cost": ["Cut days sales outstanding by 15 days"],
                    "cx": ["Proactive order status notifications"],
                    "ttm": ["Launch self-service order changes in Q3"],
                },
                approval_status="draft",
                updated_at="2026-06-09T10:00:00.000Z",
            )
        )
        session.add(
            TeleologyRowDB(
                id="tel-o2c-finance-acme-001",
                engagement_id="eng-acme-001",
                stream_type="o2c",
                function_unit="finance",
                goals=["Automate credit decisioning for tier-1 customers"],
                gaps=["Credit policy rules live in spreadsheets"],
                ambitions=["Real-time credit exposure dashboard"],
                org_ambitions={
                    **empty_org,
                    "cost": ["Reduce manual credit review hours by 40%"],
                    "ttm": ["Integrate credit engine with order entry"],
                },
                approval_status="in_review",
                updated_at="2026-06-10T14:20:00.000Z",
            )
        )
        session.add(
            TeleologyRowDB(
                id="tel-o2c-operations-acme-001",
                engagement_id="eng-acme-001",
                stream_type="o2c",
                function_unit="operations",
                goals=["Ship within SLA for 95% of standard orders"],
                gaps=["Inventory allocation conflicts across channels"],
                ambitions=["Unified allocation engine across DCs"],
                org_ambitions={
                    **empty_org,
                    "cost": ["Lower expedite shipping spend"],
                    "cx": ["Same-day status on fulfillment exceptions"],
                },
                approval_status="draft",
                updated_at="2026-06-10T09:15:00.000Z",
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
