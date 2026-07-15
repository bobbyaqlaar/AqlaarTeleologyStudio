"""actor-method process model (actors, methods, method_params, process_steps, process_globals)

Revision ID: d5f8b2a1c3e4
Revises: c4e7a1b9d2f0
Create Date: 2026-07-13 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects.postgresql import JSONB


revision = 'd5f8b2a1c3e4'
down_revision = 'c4e7a1b9d2f0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'actors',
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('engagement_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('kind', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('function_unit', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('created_at', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(['engagement_id'], ['engagements.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_actors_engagement_id'), 'actors', ['engagement_id'], unique=False)

    op.create_table(
        'methods',
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('actor_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('engagement_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('created_at', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(['actor_id'], ['actors.id'], ),
        sa.ForeignKeyConstraint(['engagement_id'], ['engagements.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_methods_actor_id'), 'methods', ['actor_id'], unique=False)
    op.create_index(op.f('ix_methods_engagement_id'), 'methods', ['engagement_id'], unique=False)

    op.create_table(
        'method_params',
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('method_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('direction', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('concept_uri', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('concept_label', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('required', sa.Boolean(), nullable=False),
        sa.Column('seq', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['method_id'], ['methods.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_method_params_method_id'), 'method_params', ['method_id'], unique=False)

    op.create_table(
        'process_steps',
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('engagement_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('stream_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('method_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('seq', sa.Integer(), nullable=False),
        sa.Column('input_bindings', JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column('output_bindings', JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column('label', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(['engagement_id'], ['engagements.id'], ),
        sa.ForeignKeyConstraint(['method_id'], ['methods.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_process_steps_engagement_id'), 'process_steps', ['engagement_id'], unique=False)
    op.create_index(op.f('ix_process_steps_stream_type'), 'process_steps', ['stream_type'], unique=False)

    op.create_table(
        'process_globals',
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('engagement_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('stream_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('concept_uri', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('concept_label', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('initial_value', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(['engagement_id'], ['engagements.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_process_globals_engagement_id'), 'process_globals', ['engagement_id'], unique=False)
    op.create_index(op.f('ix_process_globals_stream_type'), 'process_globals', ['stream_type'], unique=False)


def downgrade() -> None:
    op.drop_table('process_globals')
    op.drop_table('process_steps')
    op.drop_table('method_params')
    op.drop_table('methods')
    op.drop_table('actors')
