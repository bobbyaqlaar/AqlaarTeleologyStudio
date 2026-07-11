"""solution options and initiatives

Revision ID: b3d1c04f9e21
Revises: 6bf9aa68a23f
Create Date: 2026-07-11 13:40:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

revision = 'b3d1c04f9e21'
down_revision = '6bf9aa68a23f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('solution_options',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('engagement_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('stream_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('function_unit', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('teleology_row_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('option_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('rationale', sa.Text(), nullable=True),
    sa.Column('proposed_changes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('impacted_steps', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('impacted_classes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('effort', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('impact', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('source', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('created_at', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('updated_at', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.ForeignKeyConstraint(['engagement_id'], ['engagements.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_solution_options_engagement_id'), 'solution_options', ['engagement_id'], unique=False)

    op.create_table('initiatives',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('engagement_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('narrative', sa.Text(), nullable=True),
    sa.Column('streams', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('function_units', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('stream_links', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('consolidates', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('org_impact', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('horizon', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('source', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('created_at', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('updated_at', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.ForeignKeyConstraint(['engagement_id'], ['engagements.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_initiatives_engagement_id'), 'initiatives', ['engagement_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_initiatives_engagement_id'), table_name='initiatives')
    op.drop_table('initiatives')
    op.drop_index(op.f('ix_solution_options_engagement_id'), table_name='solution_options')
    op.drop_table('solution_options')
