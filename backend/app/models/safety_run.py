"""
TriNetra — SafetyRun & SafetyEvent ORM Models

Persists the complete output of Module 3 Safety AI (safety_events.jsonl +
run_summary.json) into our database for historical querying and UI display.

Tables:
    safety_runs        — one record per Module 3 pipeline execution
    safety_events      — one record per aggregated SafetyEvent (schema v1.0)
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models.base import Base, TimestampMixin


class SafetyRun(TimestampMixin, Base):
    """
    One SafetyRun corresponds to one invocation of Module 3 PipelineRunner
    on a specific processing job / video.  Stores run_summary.json fields.
    """

    __tablename__ = "safety_runs"

    # ── Foreign keys ──────────────────────────────────────────────────────────
    job_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("processing_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    video_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── run_summary.json fields ───────────────────────────────────────────────
    source_video_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    total_frames: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    processed_frames: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    elapsed_seconds: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    processing_fps: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total_events: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    events_by_type: Mapped[dict | None] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"), nullable=True
    )

    # ── Output artifact paths ─────────────────────────────────────────────────
    annotated_video_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    safety_output_dir: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    video_fps: Mapped[float] = mapped_column(Float, nullable=False, default=30.0)

    # ── Relationships ─────────────────────────────────────────────────────────
    events: Mapped[list["SafetyEvent"]] = relationship(
        "SafetyEvent",
        back_populates="run",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"<SafetyRun id={self.id} job_id={self.job_id} "
            f"total_events={self.total_events}>"
        )


class SafetyEvent(TimestampMixin, Base):
    """
    One SafetyEvent corresponds to one line in safety_events.jsonl.
    All complex nested fields (context, evidence, risk reasons, trajectory)
    are stored as JSONB for flexible querying.
    """

    __tablename__ = "safety_events"

    # ── Foreign keys ──────────────────────────────────────────────────────────
    run_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("safety_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("processing_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    video_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── SafetyEvent identity ──────────────────────────────────────────────────
    source_event_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )  # e.g. "SAFE_0004_000013"
    schema_version: Mapped[str] = mapped_column(
        String(10), nullable=False, default="1.0"
    )
    event_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    event_timestamp: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Frame boundaries ──────────────────────────────────────────────────────
    frame_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    start_frame: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)
    end_frame: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_frames: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # ── Source provenance ─────────────────────────────────────────────────────
    bus_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    camera_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source_video_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # ── Location ──────────────────────────────────────────────────────────────
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    gps_accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)

    # ── Track info ────────────────────────────────────────────────────────────
    track_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    object_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    track_first_frame: Mapped[int | None] = mapped_column(Integer, nullable=True)
    track_last_frame: Mapped[int | None] = mapped_column(Integer, nullable=True)
    track_age_frames: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ── Bounding box ──────────────────────────────────────────────────────────
    bbox_x1: Mapped[float | None] = mapped_column(Float, nullable=True)
    bbox_y1: Mapped[float | None] = mapped_column(Float, nullable=True)
    bbox_x2: Mapped[float | None] = mapped_column(Float, nullable=True)
    bbox_y2: Mapped[float | None] = mapped_column(Float, nullable=True)
    bbox_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # ── Risk ──────────────────────────────────────────────────────────────────
    risk_level: Mapped[str] = mapped_column(
        String(20), nullable=False, default="low", index=True
    )  # "high" | "medium" | "low"
    risk_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, index=True)
    risk_confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    risk_explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    risk_reasons: Mapped[list | None] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"), nullable=True
    )

    # ── Context flags (JSONB for flexible schema) ─────────────────────────────
    context: Mapped[dict | None] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"), nullable=True
    )

    # ── Evidence ──────────────────────────────────────────────────────────────
    evidence_frames: Mapped[list | None] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"), nullable=True
    )
    evidence_clip: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    trigger_frame_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    peak_frame_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    trajectory_snapshot: Mapped[list | None] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"), nullable=True
    )

    # ── Context flags (bool shortcuts for fast SQL filtering) ─────────────────
    in_school_zone: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    in_crossing_zone: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    road_entry: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    run: Mapped["SafetyRun"] = relationship(
        "SafetyRun",
        back_populates="events",
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"<SafetyEvent id={self.id} "
            f"source_event_id={self.source_event_id!r} "
            f"risk_level={self.risk_level!r} "
            f"risk_score={self.risk_score}>"
        )

