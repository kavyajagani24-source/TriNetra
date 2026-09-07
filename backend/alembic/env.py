"""
Alembic Environment Configuration for UrbanEye AI

Reads DATABASE_URL from the application settings (environment variable)
so the same .env file drives both the application and migrations.
"""

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# ── Add backend directory to sys.path so app can be imported ─────────────────
# This file lives at: backend/alembic/env.py
# The app lives at:   backend/app/
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

# ── Import all models so Alembic knows about them ────────────────────────────
from app.core.config import get_settings  # noqa: E402
from app.models.base import Base  # noqa: E402
from app.models.bus import Bus  # noqa: E402  # noqa: F401
from app.models.video import Video  # noqa: E402  # noqa: F401
from app.models.processing_job import ProcessingJob  # noqa: E402  # noqa: F401
from app.models.detection import Detection  # noqa: E402  # noqa: F401
from app.models.tracked_object import TrackedObject  # noqa: E402  # noqa: F401
from app.models.trajectory import TrajectoryPoint  # noqa: E402  # noqa: F401
from app.models.traffic_analytics import TrafficAnalytics  # noqa: E402  # noqa: F401

# ── Alembic Config Object ─────────────────────────────────────────────────────
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── Override sqlalchemy.url with the value from our settings ─────────────────
settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata


# ── Offline Mode ──────────────────────────────────────────────────────────────
def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode (generate SQL script without a live DB).
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online Mode ───────────────────────────────────────────────────────────────
def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode (apply directly to a live database).
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
