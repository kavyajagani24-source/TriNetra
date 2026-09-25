"""Multi-engine AI integration schema updates

Revision ID: 005_multi_engine_integration
Revises: 004_phase2_postgis_spatial
Create Date: 2026-09-24 16:53:00.000000 UTC
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "005_multi_engine_integration"
down_revision: Union[str, None] = "004_phase2_postgis_spatial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"
    json_type = JSONB if is_postgres else sa.JSON

    # 1. Processing jobs extensions
    op.add_column("processing_jobs", sa.Column("engine_statuses", json_type(), nullable=True))
    op.add_column("processing_jobs", sa.Column("annotated_road_path", sa.String(500), nullable=True))
    op.add_column("processing_jobs", sa.Column("annotated_traffic_path", sa.String(500), nullable=True))
    op.add_column("processing_jobs", sa.Column("annotated_safety_path", sa.String(500), nullable=True))

    # 2. Detections extension
    op.add_column("detections", sa.Column("source_engine", sa.String(50), nullable=True))
    op.create_index("ix_detections_source_engine", "detections", ["source_engine"])

    # 3. Traffic analytics extensions
    op.add_column("traffic_analytics", sa.Column("auto_rickshaw_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("traffic_analytics", sa.Column("bicycle_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("traffic_analytics", sa.Column("unique_vehicle_count", sa.Integer(), nullable=False, server_default="0"))

    # 4. Camera safety profiles table
    op.create_table(
        "camera_safety_profiles",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("camera_id", sa.String(100), nullable=False),
        sa.Column("resolution_width", sa.Integer(), nullable=False, server_default="1920"),
        sa.Column("resolution_height", sa.Integer(), nullable=False, server_default="1080"),
        sa.Column("zones", json_type(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("extra_metadata", json_type(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_camera_safety_profiles_camera_id", "camera_safety_profiles", ["camera_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_camera_safety_profiles_camera_id", table_name="camera_safety_profiles")
    op.drop_table("camera_safety_profiles")

    op.drop_column("traffic_analytics", "unique_vehicle_count")
    op.drop_column("traffic_analytics", "bicycle_count")
    op.drop_column("traffic_analytics", "auto_rickshaw_count")

    op.drop_index("ix_detections_source_engine", table_name="detections")
    op.drop_column("detections", "source_engine")

    op.drop_column("processing_jobs", "annotated_safety_path")
    op.drop_column("processing_jobs", "annotated_traffic_path")
    op.drop_column("processing_jobs", "annotated_road_path")
    op.drop_column("processing_jobs", "engine_statuses")
