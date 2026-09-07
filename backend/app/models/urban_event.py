"""
UrbanEye AI — Urban Event ORM Model

Represents detected road hazards, infrastructure features, pedestrian risks,
and behavioral incidents stored in PostgreSQL.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from sqlalchemy import Float, ForeignKey, Integer, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models.base import Base, TimestampMixin


class UrbanEvent(TimestampMixin, Base):
    """
    ORM model for the ``urban_events`` table.

    Stores discrete events detected by Phase 3 intelligence modules:
      • Hazards: Pothole, Road Damage, Waterlogging, Obstacle, Debris
      • Infrastructure: Traffic Sign, Zebra Crossing, Divider, Road Marking
      • Safety: Pedestrian Risk, Jaywalking, Near-Miss
      • Behavior: Rash Driving, Sudden Braking, Wrong Way, Speeding
      • Incidents: Accidents, Severe Congestion
    """

    __tablename__ = "urban_events"

    video_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    job_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("processing_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    event_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
    )

    confidence: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
    )

    frame_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
    )

    timestamp: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    # Pixel-space bounding box coordinates
    bbox_x1: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bbox_y1: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bbox_x2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bbox_y2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Geospatial coordinates
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    description: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="",
    )

    # Dialect-agnostic JSON (JSONB on PostgreSQL, JSON on SQLite)
    extra_metadata: Mapped[Dict[str, Any]] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=False,
        default=dict,
    )

    # Relationships
    video: Mapped["Video"] = relationship("Video", lazy="select")  # noqa: F821
    processing_job: Mapped["ProcessingJob"] = relationship("ProcessingJob", lazy="select")  # noqa: F821

    def __repr__(self) -> str:
        return (
            f"<UrbanEvent id={self.id} type={self.event_type!r} "
            f"severity={self.severity!r} frame={self.frame_number}>"
        )
