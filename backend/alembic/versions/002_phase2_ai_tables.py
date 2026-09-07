"""Phase 2 AI tables — detections, tracked_objects, trajectory_points, traffic_analytics

Revision ID: 002_phase2_ai_tables
Revises: 001_initial
Create Date: 2026-09-07 12:00:00.000000 UTC
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002_phase2_ai_tables"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── detections ────────────────────────────────────────────────────────────
    op.create_table(
        "detections",
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
        sa.Column("track_id", sa.Integer(), nullable=True),
        sa.Column("class_name", sa.String(50), nullable=False),
        sa.Column("class_id", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("frame_number", sa.Integer(), nullable=False),
        sa.Column("timestamp", sa.Float(), nullable=False),
        sa.Column("bbox_x1", sa.Float(), nullable=False),
        sa.Column("bbox_y1", sa.Float(), nullable=False),
        sa.Column("bbox_x2", sa.Float(), nullable=False),
        sa.Column("bbox_y2", sa.Float(), nullable=False),
        sa.Column("center_x", sa.Float(), nullable=False),
        sa.Column("center_y", sa.Float(), nullable=False),
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
    op.create_index("ix_detections_id", "detections", ["id"])
    op.create_index("ix_detections_video_id", "detections", ["video_id"])
    op.create_index("ix_detections_job_id", "detections", ["job_id"])
    op.create_index("ix_detections_track_id", "detections", ["track_id"])
    op.create_index("ix_detections_class_name", "detections", ["class_name"])
    op.create_index("ix_detections_frame_number", "detections", ["frame_number"])

    # ── tracked_objects ───────────────────────────────────────────────────────
    op.create_table(
        "tracked_objects",
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
        sa.Column("track_id", sa.Integer(), nullable=False),
        sa.Column("class_name", sa.String(50), nullable=False),
        sa.Column("first_seen_frame", sa.Integer(), nullable=False),
        sa.Column("last_seen_frame", sa.Integer(), nullable=False),
        sa.Column("first_seen_timestamp", sa.Float(), nullable=False),
        sa.Column("last_seen_timestamp", sa.Float(), nullable=False),
        sa.Column("max_confidence", sa.Float(), nullable=False),
        sa.Column("average_confidence", sa.Float(), nullable=False),
        sa.Column("status", sa.String(20), server_default="ACTIVE", nullable=False),
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
    op.create_index("ix_tracked_objects_id", "tracked_objects", ["id"])
    op.create_index("ix_tracked_objects_video_id", "tracked_objects", ["video_id"])
    op.create_index("ix_tracked_objects_job_id", "tracked_objects", ["job_id"])
    op.create_index("ix_tracked_objects_track_id", "tracked_objects", ["track_id"])
    op.create_index("ix_tracked_objects_class_name", "tracked_objects", ["class_name"])

    # ── trajectory_points ─────────────────────────────────────────────────────
    op.create_table(
        "trajectory_points",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "tracked_object_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tracked_objects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("x", sa.Float(), nullable=False),
        sa.Column("y", sa.Float(), nullable=False),
        sa.Column("frame_number", sa.Integer(), nullable=False),
        sa.Column("timestamp", sa.Float(), nullable=False),
        sa.Column("pixel_speed", sa.Float(), nullable=True),
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
    op.create_index("ix_trajectory_points_id", "trajectory_points", ["id"])
    op.create_index("ix_trajectory_points_tracked_object_id", "trajectory_points", ["tracked_object_id"])
    op.create_index("ix_trajectory_points_frame_number", "trajectory_points", ["frame_number"])

    # ── traffic_analytics ─────────────────────────────────────────────────────
    op.create_table(
        "traffic_analytics",
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
        sa.Column("timestamp", sa.Float(), nullable=False),
        sa.Column("frame_number", sa.Integer(), nullable=False),
        sa.Column("active_vehicle_count", sa.Integer(), nullable=False),
        sa.Column("car_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("motorcycle_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("bus_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("truck_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("person_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("average_pixel_speed", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("traffic_density", sa.String(20), nullable=False),
        sa.Column("congestion_level", sa.String(20), nullable=False),
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
    op.create_index("ix_traffic_analytics_id", "traffic_analytics", ["id"])
    op.create_index("ix_traffic_analytics_video_id", "traffic_analytics", ["video_id"])
    op.create_index("ix_traffic_analytics_job_id", "traffic_analytics", ["job_id"])
    op.create_index("ix_traffic_analytics_frame_number", "traffic_analytics", ["frame_number"])


def downgrade() -> None:
    op.drop_table("traffic_analytics")
    op.drop_table("trajectory_points")
    op.drop_table("tracked_objects")
    op.drop_table("detections")
