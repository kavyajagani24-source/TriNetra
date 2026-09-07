"""
UrbanEye AI — Bus ORM Model

Represents a registered city bus that carries a camera unit.
Each bus can have multiple associated video recordings.
"""

from datetime import datetime
from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import BusStatus
from app.models.base import Base, TimestampMixin


class Bus(TimestampMixin, Base):
    """
    ORM model for the ``buses`` table.

    Attributes:
        bus_number:           Unique human-readable identifier (e.g. BUS_001).
        registration_number:  Vehicle registration plate (unique if provided).
        route_number:         Route the bus operates on (e.g. R101).
        status:               Operational status (ACTIVE | INACTIVE | OFFLINE).
        videos:               Back-populated list of associated Video records.
    """

    __tablename__ = "buses"

    bus_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    registration_number: Mapped[str | None] = mapped_column(
        String(50),
        unique=True,
        nullable=True,
        index=True,
    )

    route_number: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=BusStatus.ACTIVE.value,
        server_default=BusStatus.ACTIVE.value,
    )

    # ── Geospatial & Real-Time Telemetry ──────────────────────────────────────
    latitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        index=True,
    )

    longitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        index=True,
    )

    heading: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        default=0.0,
    )

    speed: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        default=0.0,
    )

    last_location_update: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    videos: Mapped[list["Video"]] = relationship(  # noqa: F821
        "Video",
        back_populates="bus",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<Bus id={self.id} bus_number={self.bus_number!r} status={self.status!r}>"
