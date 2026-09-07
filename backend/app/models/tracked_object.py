"""
UrbanEye AI — TrackedObject ORM Model

Represents a unique physical object (vehicle/pedestrian) identified and followed
across video frames with a persistent ByteTrack ID.
"""

from __future__ import annotations

import uuid
from typing import List

from sqlalchemy import Float, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class TrackedObject(TimestampMixin, Base):
    """
    ORM model for the ``tracked_objects`` table.
    """

    __tablename__ = "tracked_objects"

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

    track_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
    )

    class_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    first_seen_frame: Mapped[int] = mapped_column(Integer, nullable=False)
    last_seen_frame: Mapped[int] = mapped_column(Integer, nullable=False)

    first_seen_timestamp: Mapped[float] = mapped_column(Float, nullable=False)
    last_seen_timestamp: Mapped[float] = mapped_column(Float, nullable=False)

    max_confidence: Mapped[float] = mapped_column(Float, nullable=False)
    average_confidence: Mapped[float] = mapped_column(Float, nullable=False)

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="ACTIVE",
        server_default="ACTIVE",
    )

    # Relationships
    video: Mapped["Video"] = relationship(  # noqa: F821
        "Video",
        lazy="select",
    )

    job: Mapped["ProcessingJob"] = relationship(  # noqa: F821
        "ProcessingJob",
        lazy="select",
    )

    trajectory_points: Mapped[List["TrajectoryPoint"]] = relationship(  # noqa: F821
        "TrajectoryPoint",
        back_populates="tracked_object",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"<TrackedObject id={self.id} track_id={self.track_id} "
            f"class={self.class_name!r} status={self.status!r}>"
        )
