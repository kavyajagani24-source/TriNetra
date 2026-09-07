"""
UrbanEye AI — Tracking & Trajectory Schemas
"""

from __future__ import annotations

import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict


class TrajectoryPointResponse(BaseModel):
    """Schema representing an individual point on a trajectory."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tracked_object_id: uuid.UUID
    x: float
    y: float
    frame_number: int
    timestamp: float
    pixel_speed: Optional[float] = None


class TrackedObjectResponse(BaseModel):
    """Schema representing a tracked physical object."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    video_id: uuid.UUID
    job_id: uuid.UUID
    track_id: int
    class_name: str
    first_seen_frame: int
    last_seen_frame: int
    first_seen_timestamp: float
    last_seen_timestamp: float
    max_confidence: float
    average_confidence: float
    status: str
