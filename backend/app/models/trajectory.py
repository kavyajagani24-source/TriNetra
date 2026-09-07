"""
UrbanEye AI — TrajectoryPoint ORM Model

Represents a single 2D spatial coordinate and instantaneous velocity
for a tracked object over time.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Float, ForeignKey, Integer, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class TrajectoryPoint(TimestampMixin, Base):
    """
    ORM model for the ``trajectory_points`` table.
    """

    __tablename__ = "trajectory_points"

    tracked_object_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("tracked_objects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    x: Mapped[float] = mapped_column(Float, nullable=False)
    y: Mapped[float] = mapped_column(Float, nullable=False)
    frame_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    timestamp: Mapped[float] = mapped_column(Float, nullable=False)
    pixel_speed: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Relationships
    tracked_object: Mapped["TrackedObject"] = relationship(  # noqa: F821
        "TrackedObject",
        back_populates="trajectory_points",
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"<TrajectoryPoint id={self.id} track_obj={self.tracked_object_id} "
            f"frame={self.frame_number} speed={self.pixel_speed}>"
        )
