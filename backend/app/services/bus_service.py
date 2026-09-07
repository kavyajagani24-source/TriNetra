"""
UrbanEye AI — Bus Service

Business logic for bus management.
Enforces uniqueness constraints, validates status, and orchestrates
repository calls.  Raises typed exceptions so the API layer can
translate them to appropriate HTTP responses.
"""

import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.core.constants import BusStatus
from app.core.logging import get_logger
from app.models.bus import Bus
from app.repositories.bus_repository import BusRepository
from app.schemas.bus import BusCreate, BusUpdate
from app.services.exceptions import ConflictError, NotFoundError, ValidationError

logger = get_logger(__name__)


class BusService:
    """Service layer for bus lifecycle management."""

    def __init__(self, db: Session) -> None:
        self._repo = BusRepository(db)

    # ── Create ────────────────────────────────────────────────────────────────
    def create_bus(self, payload: BusCreate) -> Bus:
        """
        Create a new bus.

        Raises:
            ConflictError: If bus_number or registration_number already exists.
        """
        # Check duplicate bus_number
        if self._repo.get_bus_by_number(payload.bus_number):
            raise ConflictError(
                f"Bus with number '{payload.bus_number}' already exists."
            )

        # Check duplicate registration_number
        if payload.registration_number:
            if self._repo.get_bus_by_registration(payload.registration_number):
                raise ConflictError(
                    f"Bus with registration '{payload.registration_number}' already exists."
                )

        bus = self._repo.create_bus(
            bus_number=payload.bus_number,
            registration_number=payload.registration_number,
            route_number=payload.route_number,
            status=payload.status.value,
        )
        logger.info("Bus created: %s (id=%s)", bus.bus_number, bus.id)
        return bus

    # ── Read ──────────────────────────────────────────────────────────────────
    def get_bus(self, bus_id: uuid.UUID) -> Bus:
        """
        Retrieve a bus by ID.

        Raises:
            NotFoundError: If no bus with the given ID exists.
        """
        bus = self._repo.get_bus_by_id(bus_id)
        if not bus:
            raise NotFoundError(f"Bus with id '{bus_id}' not found.")
        return bus

    def list_buses(
        self,
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None,
    ) -> tuple[list[Bus], int]:
        """
        Return a paginated list of buses with an optional status filter.

        Raises:
            ValidationError: If the provided status string is invalid.
        """
        if status:
            valid = {s.value for s in BusStatus}
            if status not in valid:
                raise ValidationError(
                    f"Invalid status '{status}'. Allowed: {sorted(valid)}"
                )
        return self._repo.get_all_buses(page=page, limit=limit, status=status)

    # ── Update ────────────────────────────────────────────────────────────────
    def update_bus(self, bus_id: uuid.UUID, payload: BusUpdate) -> Bus:
        """
        Update an existing bus.

        Raises:
            NotFoundError:  If the bus does not exist.
            ConflictError:  If the new bus_number or registration already exists.
        """
        bus = self.get_bus(bus_id)
        updates: dict = {}

        if payload.bus_number and payload.bus_number != bus.bus_number:
            existing = self._repo.get_bus_by_number(payload.bus_number)
            if existing and existing.id != bus_id:
                raise ConflictError(
                    f"Bus number '{payload.bus_number}' is already in use."
                )
            updates["bus_number"] = payload.bus_number

        if (
            payload.registration_number is not None
            and payload.registration_number != bus.registration_number
        ):
            existing = self._repo.get_bus_by_registration(
                payload.registration_number
            )
            if existing and existing.id != bus_id:
                raise ConflictError(
                    f"Registration '{payload.registration_number}' is already in use."
                )
            updates["registration_number"] = payload.registration_number

        if payload.route_number is not None:
            updates["route_number"] = payload.route_number

        if payload.status is not None:
            updates["status"] = payload.status.value

        bus = self._repo.update_bus(bus, **updates)
        logger.info("Bus updated: %s (id=%s)", bus.bus_number, bus.id)
        return bus

    # ── Delete ────────────────────────────────────────────────────────────────
    def delete_bus(self, bus_id: uuid.UUID) -> None:
        """
        Delete a bus by ID.

        Raises:
            NotFoundError: If the bus does not exist.
        """
        bus = self.get_bus(bus_id)
        bus_number = bus.bus_number
        self._repo.delete_bus(bus)
        logger.info("Bus deleted: %s (id=%s)", bus_number, bus_id)
