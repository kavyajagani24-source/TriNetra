"""Phase 3 AI tables — urban_events

Revision ID: 003_phase3_events
Revises: 002_phase2_ai_tables
Create Date: 2026-09-07 14:00:00.000000 UTC
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003_phase3_events"
down_revision: Union[str, None] = "002_phase2_ai_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── urban_events ───────────────────────────────────────────────────────────
    op.create_table(
        "urban_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "video_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("videos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("processing_jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("frame_number", sa.Integer(), nullable=False),
        sa.Column("timestamp", sa.Float(), nullable=False),
        sa.Column("bbox_x1", sa.Float(), nullable=True),
        sa.Column("bbox_y1", sa.Float(), nullable=True),
        sa.Column("bbox_x2", sa.Float(), nullable=True),
        sa.Column("bbox_y2", sa.Float(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("description", sa.String(255), nullable=False, server_default=""),
        sa.Column(
            "extra_metadata",
            postgresql.JSONB().with_variant(sa.JSON(), "sqlite"),
            nullable=False,
            server_default="{}",
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
    op.create_index("ix_urban_events_id", "urban_events", ["id"])
    op.create_index("ix_urban_events_video_id", "urban_events", ["video_id"])
    op.create_index("ix_urban_events_job_id", "urban_events", ["job_id"])
    op.create_index("ix_urban_events_event_type", "urban_events", ["event_type"])
    op.create_index("ix_urban_events_category", "urban_events", ["category"])
    op.create_index("ix_urban_events_severity", "urban_events", ["severity"])
    op.create_index("ix_urban_events_frame_number", "urban_events", ["frame_number"])


def downgrade() -> None:
    op.drop_table("urban_events")
