"""
UrbanEye AI — Detection Schemas
"""

from __future__ import annotations

import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict


class DetectionResponse(BaseModel):
    """Schema representing a single detection entity."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    video_id: uuid.UUID
    job_id: uuid.UUID
    track_id: Optional[int] = None
    class_name: str
    class_id: int
    confidence: float
    frame_number: int
    timestamp: float
    bbox_x1: float
    bbox_y1: float
    bbox_x2: float
    bbox_y2: float
    center_x: float
    center_y: float
