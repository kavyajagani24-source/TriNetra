"""
UrbanEye AI — ProcessingJob ORM Model

Represents a scheduled (Phase 1) or active (Phase 2) AI processing job
for a video.  Phase 1 creates jobs with status QUEUED; Phase 2 will
implement the actual AI worker that advances job status.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import ProcessingStatus
from app.models.base import Base, TimestampMixin


class ProcessingJob(TimestampMixin, Base):
    """
    ORM model for the ``processing_jobs`` table.

    Attributes:
        video_id:            FK to the video being processed.
        status:              Current job status.
        progress_percentage: 0–100 completion percentage.
        frames_processed:    Number of frames analysed so far.
        total_frames:        Total frames to process (from video metadata).
        events_detected:     Count of detection events found (Phase 2).
        error_message:       Human-readable error if the job failed.
        started_at:          When processing began (Phase 2 will set this).
        completed_at:        When processing finished (Phase 2 will set this).
        video:               Relationship to the parent Video.
    """

    __tablename__ = "processing_jobs"

    video_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=ProcessingStatus.QUEUED.value,
        server_default=ProcessingStatus.QUEUED.value,
        index=True,
    )

    progress_percentage: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
        server_default="0",
    )

    frames_processed: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    total_frames: Mapped[int | None] = mapped_column(Integer, nullable=True)

    events_detected: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    video: Mapped["Video"] = relationship(  # noqa: F821
        "Video",
        back_populates="processing_jobs",
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"<ProcessingJob id={self.id} "
            f"video_id={self.video_id} "
            f"status={self.status!r} "
            f"progress={self.progress_percentage}%>"
        )
