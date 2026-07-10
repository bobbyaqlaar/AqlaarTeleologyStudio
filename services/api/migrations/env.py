"""Alembic environment — targets SQLModel.metadata from db_models."""

from __future__ import annotations

import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool
from sqlmodel import SQLModel

# services/api on sys.path so db_models imports the same way as in the app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import db_models  # noqa: F401 E402 — registers all tables on SQLModel.metadata

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def _database_url() -> str:
    return (
        config.get_main_option("sqlalchemy.url")
        or os.getenv(
            "OTS_DATABASE_URL",
            "postgresql+psycopg://ots:ots@localhost:5434/ots",
        )
    )


def run_migrations_offline() -> None:
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = config.attributes.get("connection")
    if connectable is not None:
        # Reuse the app's connection when invoked programmatically (db.py)
        context.configure(connection=connectable, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
        return

    engine = create_engine(_database_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
