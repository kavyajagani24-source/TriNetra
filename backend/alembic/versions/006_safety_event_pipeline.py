"""Safety AI JSON event pipeline — safety_runs and safety_events tables

Revision ID: 006_safety_event_pipeline
Revises: 005_multi_engine_integration
Create Date: 2026-09-25 18:00:00.000000 UTC
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "006_safety_event_pipeline"
down_revision: Union[str, None] = "005_multi_engine_integration"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"
    json_type = JSONB if is_postgres else sa.JSON

    # ── safety_runs ──────────────────────────────────────────────────────────
    op.create_table(
        "safety_runs",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("job_id", sa.Uuid(as_uuid=True), sa.ForeignKey("processing_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("video_id", sa.Uuid(as_uuid=True), sa.ForeignKey("videos.id", ondelete="CASCADE"), nullable=False),
        # run_summary.json fields
        sa.Column("source_video_path", sa.String(1000), nullable=True),
        sa.Column("total_frames", sa.Integer, nullable=False, server_default="0"),
        sa.Column("processed_frames", sa.Integer, nullable=False, server_default="0"),
        sa.Column("elapsed_seconds", sa.Float, nullable=False, server_default="0"),
        sa.Column("processing_fps", sa.Float, nullable=False, server_default="0"),
        sa.Column("total_events", sa.Integer, nullable=False, server_default="0"),
        sa.Column("events_by_type", json_type(), nullable=True),
        # Output artifact paths
        sa.Column("annotated_video_path", sa.String(1000), nullable=True),
        sa.Column("safety_output_dir", sa.String(1000), nullable=True),
        sa.Column("video_fps", sa.Float, nullable=False, server_default="30"),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_safety_runs_id", "safety_runs", ["id"])
    op.create_index("ix_safety_runs_job_id", "safety_runs", ["job_id"])
    op.create_index("ix_safety_runs_video_id", "safety_runs", ["video_id"])

    # ── safety_events ────────────────────────────────────────────────────────
    op.create_table(
        "safety_events",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("run_id", sa.Uuid(as_uuid=True), sa.ForeignKey("safety_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", sa.Uuid(as_uuid=True), sa.ForeignKey("processing_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("video_id", sa.Uuid(as_uuid=True), sa.ForeignKey("videos.id", ondelete="CASCADE"), nullable=False),

        # Identity
        sa.Column("source_event_id", sa.String(100), nullable=False),
        sa.Column("schema_version", sa.String(10), nullable=False, server_default="1.0"),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("event_timestamp", sa.DateTime(timezone=True), nullable=True),

        # Frame boundaries
        sa.Column("frame_index", sa.Integer, nullable=False, server_default="0"),
        sa.Column("start_frame", sa.Integer, nullable=False, server_default="0"),
        sa.Column("end_frame", sa.Integer, nullable=False, server_default="0"),
        sa.Column("duration_frames", sa.Integer, nullable=False, server_default="0"),

        # Source provenance
        sa.Column("bus_id", sa.String(100), nullable=True),
        sa.Column("camera_id", sa.String(100), nullable=True),
        sa.Column("source_video_path", sa.String(1000), nullable=True),

        # Location
        sa.Column("latitude", sa.Float, nullable=True),
        sa.Column("longitude", sa.Float, nullable=True),
        sa.Column("gps_accuracy_m", sa.Float, nullable=True),

        # Track info
        sa.Column("track_id", sa.Integer, nullable=True),
        sa.Column("object_type", sa.String(50), nullable=True),
        sa.Column("track_first_frame", sa.Integer, nullable=True),
        sa.Column("track_last_frame", sa.Integer, nullable=True),
        sa.Column("track_age_frames", sa.Integer, nullable=True),

        # Bounding box
        sa.Column("bbox_x1", sa.Float, nullable=True),
        sa.Column("bbox_y1", sa.Float, nullable=True),
        sa.Column("bbox_x2", sa.Float, nullable=True),
        sa.Column("bbox_y2", sa.Float, nullable=True),
        sa.Column("bbox_confidence", sa.Float, nullable=True),

        # Risk
        sa.Column("risk_level", sa.String(20), nullable=False, server_default="low"),
        sa.Column("risk_score", sa.Float, nullable=False, server_default="0"),
        sa.Column("risk_confidence", sa.Float, nullable=False, server_default="0"),
        sa.Column("risk_explanation", sa.Text, nullable=True),
        sa.Column("risk_reasons", json_type(), nullable=True),

        # Context (JSONB)
        sa.Column("context", json_type(), nullable=True),

        # Evidence (JSONB for frame list; individual scalar columns for key frames)
        sa.Column("evidence_frames", json_type(), nullable=True),
        sa.Column("evidence_clip", sa.String(1000), nullable=True),
        sa.Column("trigger_frame_index", sa.Integer, nullable=True),
        sa.Column("peak_frame_index", sa.Integer, nullable=True),
        sa.Column("trajectory_snapshot", json_type(), nullable=True),

        # Bool shortcuts
        sa.Column("in_school_zone", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("in_crossing_zone", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("road_entry", sa.Boolean, nullable=False, server_default="false"),

        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_safety_events_id", "safety_events", ["id"])
    op.create_index("ix_safety_events_run_id", "safety_events", ["run_id"])
    op.create_index("ix_safety_events_job_id", "safety_events", ["job_id"])
    op.create_index("ix_safety_events_video_id", "safety_events", ["video_id"])
    op.create_index("ix_safety_events_source_event_id", "safety_events", ["source_event_id"])
    op.create_index("ix_safety_events_event_type", "safety_events", ["event_type"])
    op.create_index("ix_safety_events_risk_level", "safety_events", ["risk_level"])
    op.create_index("ix_safety_events_risk_score", "safety_events", ["risk_score"])
    op.create_index("ix_safety_events_start_frame", "safety_events", ["start_frame"])
    op.create_index("ix_safety_events_bus_id", "safety_events", ["bus_id"])


def downgrade() -> None:
    op.drop_table("safety_events")
    op.drop_table("safety_runs")
