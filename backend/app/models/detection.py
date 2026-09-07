"""
UrbanEye AI — Detection ORM Model

Stores raw or sampled bounding box detections detected in video frames.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Float, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Detection(TimestampMixin, Base):
    """
    ORM model for the ``detections`` table.
    """

    __tablename__ = "detections"

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

    track_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        index=True,
    )

    class_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    class_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    confidence: Mapped[float] = mapped_column(
        Float,
        nullable=False,
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

    bbox_x1: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_y1: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_x2: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_y2: Mapped[float] = mapped_column(Float, nullable=False)
    center_x: Mapped[float] = mapped_column(Float, nullable=False)
    center_y: Mapped[float] = mapped_column(Float, nullable=False)

    # Relationships
    video: Mapped["Video"] = relationship(  # noqa: F821
        "Video",
        lazy="select",
    )

    job: Mapped["ProcessingJob"] = relationship(  # noqa: F821
        "ProcessingJob",
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"<Detection id={self.id} class_name={self.class_name!r} "
            f"track_id={self.track_id} conf={self.confidence:.2f}>"
        )
