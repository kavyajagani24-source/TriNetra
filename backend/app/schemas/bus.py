"""
UrbanEye AI — Bus Pydantic Schemas

Defines the request/response shapes for all bus-related endpoints.
Uses Pydantic v2 validators for field-level validation.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.core.constants import BusStatus


class BusCreate(BaseModel):
    """Payload for creating a new bus."""

    bus_number: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="Unique bus identifier, e.g. BUS_001",
    )
    registration_number: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Vehicle registration plate, e.g. MH01AB1234",
    )
    route_number: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Route this bus operates on, e.g. R101",
    )
    status: BusStatus = Field(
        default=BusStatus.ACTIVE,
        description="Operational status of the bus",
    )

    @field_validator("bus_number")
    @classmethod
    def normalise_bus_number(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("registration_number")
    @classmethod
    def normalise_registration(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip().upper()
        return cleaned if cleaned else None


class BusUpdate(BaseModel):
    """Payload for partially updating an existing bus."""

    bus_number: Optional[str] = Field(
        default=None, min_length=2, max_length=50
    )
    registration_number: Optional[str] = Field(
        default=None, max_length=50
    )
    route_number: Optional[str] = Field(default=None, max_length=50)
    status: Optional[BusStatus] = None

    @field_validator("bus_number")
    @classmethod
    def normalise_bus_number(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if v else None

    @field_validator("registration_number")
    @classmethod
    def normalise_registration(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip().upper()
        return cleaned if cleaned else None


class BusResponse(BaseModel):
    """Full bus record returned from the API."""

    id: uuid.UUID
    bus_number: str
    registration_number: Optional[str] = None
    route_number: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BusListResponse(BaseModel):
    """Slim bus record used inside paginated list responses."""

    id: uuid.UUID
    bus_number: str
    registration_number: Optional[str] = None
    route_number: Optional[str] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
