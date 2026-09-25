"""
UrbanEye AI — Camera Safety Profile Schemas

Pydantic schemas for managing camera-specific spatial calibrations and VRU safety zones.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class CameraZoneSchema(BaseModel):
    """Calibrated spatial zone polygon in image pixel coordinates."""

    zone_id: str = Field(..., description="Unique zone identifier, e.g. ROAD_001")
    zone_type: str = Field(
        ...,
        description="Zone type: 'road' | 'crossing' | 'school_zone' | 'sidewalk' | 'exclusion'",
    )
    name: str = Field(..., description="Human-friendly label, e.g. 'Main Carriageway'")
    polygon: List[List[float]] = Field(
        ...,
        description="Polygon boundary vertices [[x1, y1], [x2, y2], ...]",
    )
    lat: Optional[float] = Field(None, description="Optional GPS latitude anchor")
    lon: Optional[float] = Field(None, description="Optional GPS longitude anchor")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional context/notes")


class CameraSafetyProfileCreate(BaseModel):
    """Payload to register or update a camera safety profile."""

    camera_id: str = Field(..., description="Unique camera or stream identifier")
    resolution_width: int = Field(1920, ge=320, description="Calibrated frame width in pixels")
    resolution_height: int = Field(1080, ge=240, description="Calibrated frame height in pixels")
    zones: List[CameraZoneSchema] = Field(default_factory=list, description="Calibrated zone polygons")
    enabled: bool = Field(True, description="Whether safety zone reasoning is active for this camera")
    extra_metadata: Dict[str, Any] = Field(default_factory=dict)


class CameraSafetyProfileUpdate(BaseModel):
    """Payload for partial updates to a camera safety profile."""

    resolution_width: Optional[int] = Field(None, ge=320)
    resolution_height: Optional[int] = Field(None, ge=240)
    zones: Optional[List[CameraZoneSchema]] = None
    enabled: Optional[bool] = None
    extra_metadata: Optional[Dict[str, Any]] = None


class CameraSafetyProfileResponse(BaseModel):
    """Full camera safety profile response."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    camera_id: str
    resolution_width: int
    resolution_height: int
    zones: List[Dict[str, Any]]
    enabled: bool
    extra_metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
