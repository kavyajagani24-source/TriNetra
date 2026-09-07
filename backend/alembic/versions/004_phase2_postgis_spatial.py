"""Stage 2 Phase 2 — PostGIS Spatial Extensions and Telemetry

Revision ID: 004_phase2_postgis_spatial
Revises: 003_phase3_events
Create Date: 2026-09-07 19:30:00.000000 UTC
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_phase2_postgis_spatial"
down_revision: Union[str, None] = "003_phase3_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # 1. Enable PostGIS extension on PostgreSQL
    if is_postgres:
        op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    # 2. Add spatial telemetry columns to buses
    op.add_column("buses", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("buses", sa.Column("longitude", sa.Float(), nullable=True))
    op.add_column("buses", sa.Column("heading", sa.Float(), nullable=True, server_default="0.0"))
    op.add_column("buses", sa.Column("speed", sa.Float(), nullable=True, server_default="0.0"))
    op.add_column(
        "buses",
        sa.Column("last_location_update", sa.DateTime(timezone=True), nullable=True),
    )

    # 3. Create spatial indexes
    op.create_index("ix_buses_latitude", "buses", ["latitude"])
    op.create_index("ix_buses_longitude", "buses", ["longitude"])

    if is_postgres:
        # Create PostGIS geometry columns and GiST spatial indexes
        op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='urban_events' AND column_name='location'
            ) THEN
                ALTER TABLE urban_events ADD COLUMN location geometry(Point, 4326);
                UPDATE urban_events
                SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
                WHERE longitude IS NOT NULL AND latitude IS NOT NULL;
                CREATE INDEX IF NOT EXISTS ix_urban_events_location_gist ON urban_events USING GIST(location);
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='buses' AND column_name='location'
            ) THEN
                ALTER TABLE buses ADD COLUMN location geometry(Point, 4326);
                UPDATE buses
                SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
                WHERE longitude IS NOT NULL AND latitude IS NOT NULL;
                CREATE INDEX IF NOT EXISTS ix_buses_location_gist ON buses USING GIST(location);
            END IF;
        END $$;
        """)


def downgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        op.execute("DROP INDEX IF EXISTS ix_buses_location_gist;")
        op.execute("DROP INDEX IF EXISTS ix_urban_events_location_gist;")
        op.execute("ALTER TABLE buses DROP COLUMN IF EXISTS location;")
        op.execute("ALTER TABLE urban_events DROP COLUMN IF EXISTS location;")

    op.drop_index("ix_buses_longitude", table_name="buses")
    op.drop_index("ix_buses_latitude", table_name="buses")
    op.drop_column("buses", "last_location_update")
    op.drop_column("buses", "speed")
    op.drop_column("buses", "heading")
    op.drop_column("buses", "longitude")
    op.drop_column("buses", "latitude")
