"""
UrbanEye AI — Video ORM Model

Represents a video file uploaded from a bus camera.
Stores both file metadata and video technical properties
extracted by OpenCV during upload.
"""

import uuid

from sqlalchemy import Float, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import VideoStatus
from app.models.base import Base, TimestampMixin


class Video(TimestampMixin, Base):
    """
    ORM model for the ``videos`` table.

    Attributes:
        filename:          UUID-based storage filename (e.g. <uuid>.mp4).
        original_filename: Original filename as uploaded by the client.
        file_path:         Absolute path to the stored file.
        file_size:         File size in bytes.
        format:            File extension / container format.
        fps:               Frames per second extracted by OpenCV.
        frame_count:       Total number of frames.
        duration:          Duration in seconds (frame_count / fps).
        width:             Video width in pixels.
        height:            Video height in pixels.
        status:            Processing lifecycle status.
        bus_id:            FK to the bus this video belongs to (optional).
        latitude:          GPS latitude at time of recording.
        longitude:         GPS longitude at time of recording.
        bus:               Relationship to the parent Bus.
        processing_jobs:   Relationship to associated ProcessingJob records.
    """

    __tablename__ = "videos"

    filename: Mapped[str] = mapped_column(String(255), nullable=False)

    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)

    file_path: Mapped[str] = mapped_column(String(512), nullable=False)

    file_size: Mapped[int] = mapped_column(Integer, nullable=False)

    format: Mapped[str | None] = mapped_column(String(10), nullable=True)

    fps: Mapped[float | None] = mapped_column(Float, nullable=True)

    frame_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    duration: Mapped[float | None] = mapped_column(Float, nullable=True)

    width: Mapped[int | None] = mapped_column(Integer, nullable=True)

    height: Mapped[int | None] = mapped_column(Integer, nullable=True)

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=VideoStatus.UPLOADED.value,
        server_default=VideoStatus.UPLOADED.value,
        index=True,
    )

    bus_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("buses.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    bus: Mapped["Bus | None"] = relationship(  # noqa: F821
        "Bus",
        back_populates="videos",
        lazy="select",
    )

    processing_jobs: Mapped[list["ProcessingJob"]] = relationship(  # noqa: F821
        "ProcessingJob",
        back_populates="video",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"<Video id={self.id} "
            f"original_filename={self.original_filename!r} "
            f"status={self.status!r}>"
        )
