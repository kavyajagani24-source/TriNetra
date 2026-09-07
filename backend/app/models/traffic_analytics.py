"""
UrbanEye AI — TrafficAnalytics ORM Model

Stores temporal traffic metrics (vehicle density, counts, congestion level,
average speed) computed periodically across the video timeline.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Float, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class TrafficAnalytics(TimestampMixin, Base):
    """
    ORM model for the ``traffic_analytics`` table.
    """

    __tablename__ = "traffic_analytics"

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

    timestamp: Mapped[float] = mapped_column(Float, nullable=False)
    frame_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    active_vehicle_count: Mapped[int] = mapped_column(Integer, nullable=False)
    car_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    motorcycle_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bus_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    truck_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    person_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    average_pixel_speed: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    traffic_density: Mapped[str] = mapped_column(String(20), nullable=False)
    congestion_level: Mapped[str] = mapped_column(String(20), nullable=False)

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
            f"<TrafficAnalytics id={self.id} frame={self.frame_number} "
            f"vehicles={self.active_vehicle_count} density={self.traffic_density!r}>"
        )
