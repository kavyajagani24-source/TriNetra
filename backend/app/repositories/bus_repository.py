"""
UrbanEye AI — Bus Repository

Handles all database operations for the Bus model.
No business logic here — only clean DB queries.
"""

import uuid
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.bus import Bus


class BusRepository:
    """Data access layer for Bus entities."""

    def __init__(self, db: Session) -> None:
        self._db = db

    # ── Create ────────────────────────────────────────────────────────────────
    def create_bus(self, **kwargs) -> Bus:
        """Persist a new Bus record and return it."""
        bus = Bus(**kwargs)
        self._db.add(bus)
        self._db.commit()
        self._db.refresh(bus)
        return bus

    # ── Read ──────────────────────────────────────────────────────────────────
    def get_bus_by_id(self, bus_id: uuid.UUID) -> Optional[Bus]:
        """Return a Bus by its UUID primary key, or None."""
        stmt = select(Bus).where(Bus.id == bus_id)
        return self._db.execute(stmt).scalar_one_or_none()

    def get_bus_by_number(self, bus_number: str) -> Optional[Bus]:
        """Return a Bus by its unique bus_number, or None."""
        stmt = select(Bus).where(
            func.upper(Bus.bus_number) == bus_number.upper()
        )
        return self._db.execute(stmt).scalar_one_or_none()

    def get_bus_by_registration(
        self, registration_number: str
    ) -> Optional[Bus]:
        """Return a Bus by its registration number, or None."""
        stmt = select(Bus).where(
            func.upper(Bus.registration_number)
            == registration_number.upper()
        )
        return self._db.execute(stmt).scalar_one_or_none()

    def get_all_buses(
        self,
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None,
    ) -> tuple[list[Bus], int]:
        """
        Return a paginated list of buses and the total count.

        Args:
            page:   1-based page number.
            limit:  Records per page.
            status: Optional status filter.

        Returns:
            Tuple of (list of Bus, total record count).
        """
        stmt = select(Bus)
        count_stmt = select(func.count(Bus.id))

        if status:
            stmt = stmt.where(Bus.status == status)
            count_stmt = count_stmt.where(Bus.status == status)

        total = self._db.execute(count_stmt).scalar_one()

        stmt = (
            stmt.order_by(Bus.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        buses = list(self._db.execute(stmt).scalars().all())
        return buses, total

    # ── Update ────────────────────────────────────────────────────────────────
    def update_bus(self, bus: Bus, **kwargs) -> Bus:
        """Apply keyword updates to a Bus and persist."""
        for key, value in kwargs.items():
            if value is not None:
                setattr(bus, key, value)
        self._db.commit()
        self._db.refresh(bus)
        return bus

    # ── Delete ────────────────────────────────────────────────────────────────
    def delete_bus(self, bus: Bus) -> None:
        """Delete a Bus record from the database."""
        self._db.delete(bus)
        self._db.commit()
