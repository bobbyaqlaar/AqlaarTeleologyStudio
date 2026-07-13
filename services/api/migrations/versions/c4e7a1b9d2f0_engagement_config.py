"""engagement per-industry config (function_units + value_streams_config)

Revision ID: c4e7a1b9d2f0
Revises: b3d1c04f9e21
Create Date: 2026-07-13 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = 'c4e7a1b9d2f0'
down_revision = 'b3d1c04f9e21'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'engagements',
        sa.Column(
            'function_units',
            JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        'engagements',
        sa.Column(
            'value_streams_config',
            JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column('engagements', 'value_streams_config')
    op.drop_column('engagements', 'function_units')
