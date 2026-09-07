"""Initial schema — buses, videos, processing_jobs

Revision ID: 001_initial
Revises:
Create Date: 2026-09-07 00:00:00.000000 UTC
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── buses ─────────────────────────────────────────────────────────────────
    op.create_table(
        "buses",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("bus_number", sa.String(50), nullable=False, unique=True),
        sa.Column("registration_number", sa.String(50), nullable=True, unique=True),
        sa.Column("route_number", sa.String(50), nullable=True),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="ACTIVE",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_buses_id", "buses", ["id"])
    op.create_index("ix_buses_bus_number", "buses", ["bus_number"])
    op.create_index(
        "ix_buses_registration_number", "buses", ["registration_number"]
    )

    # ── videos ────────────────────────────────────────────────────────────────
    op.create_table(
        "videos",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(512), nullable=False),
        sa.Column("file_size", sa.Integer, nullable=False),
        sa.Column("format", sa.String(10), nullable=True),
        sa.Column("fps", sa.Float, nullable=True),
        sa.Column("frame_count", sa.Integer, nullable=True),
        sa.Column("duration", sa.Float, nullable=True),
        sa.Column("width", sa.Integer, nullable=True),
        sa.Column("height", sa.Integer, nullable=True),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="UPLOADED",
        ),
        sa.Column(
            "bus_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("buses.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("latitude", sa.Float, nullable=True),
        sa.Column("longitude", sa.Float, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_videos_id", "videos", ["id"])
    op.create_index("ix_videos_status", "videos", ["status"])
    op.create_index("ix_videos_bus_id", "videos", ["bus_id"])

    # ── processing_jobs ───────────────────────────────────────────────────────
    op.create_table(
        "processing_jobs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "video_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("videos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="QUEUED",
        ),
        sa.Column(
            "progress_percentage",
            sa.Float,
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "frames_processed",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column("total_frames", sa.Integer, nullable=True),
        sa.Column(
            "events_detected",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_processing_jobs_id", "processing_jobs", ["id"])
    op.create_index("ix_processing_jobs_video_id", "processing_jobs", ["video_id"])
    op.create_index("ix_processing_jobs_status", "processing_jobs", ["status"])


def downgrade() -> None:
    op.drop_table("processing_jobs")
    op.drop_table("videos")
    op.drop_table("buses")
