"""
UrbanEye AI — Phase 3 Event Pydantic Schemas
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class UrbanEventBase(BaseModel):
    """Base schema for urban events."""
    event_type: str
    category: str
    severity: str
    confidence: float
    frame_number: int
    timestamp: float
    bbox_x1: Optional[float] = None
    bbox_y1: Optional[float] = None
    bbox_x2: Optional[float] = None
    bbox_y2: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: str = ""
    extra_metadata: Dict[str, Any] = Field(default_factory=dict)


class UrbanEventResponse(UrbanEventBase):
    """Response schema returned by the API."""
    id: uuid.UUID
    video_id: uuid.UUID
    job_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EventStatisticsResponse(BaseModel):
    """Aggregated event counts and metrics."""
    total_events: int
    by_category: Dict[str, int]
    by_severity: Dict[str, int]
    by_event_type: Dict[str, int]
