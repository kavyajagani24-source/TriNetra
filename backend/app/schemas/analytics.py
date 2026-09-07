"""
UrbanEye AI — Traffic Analytics Schemas
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Dict, Optional

from pydantic import BaseModel, ConfigDict


class TrafficAnalyticsResponse(BaseModel):
    """Schema representing an instant of traffic analytics telemetry."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    video_id: uuid.UUID
    job_id: uuid.UUID
    timestamp: float
    frame_number: int
    active_vehicle_count: int
    car_count: int
    motorcycle_count: int
    bus_count: int
    truck_count: int
    person_count: int
    average_pixel_speed: float
    traffic_density: str
    congestion_level: str


class JobResultsResponse(BaseModel):
    """Schema representing complete aggregated results for an AI processing job."""

    model_config = ConfigDict(from_attributes=True)

    job_id: uuid.UUID
    video_id: uuid.UUID
    status: str
    progress_percentage: float
    frames_processed: int
    total_frames: Optional[int] = None
    total_unique_vehicles: int
    counts_by_class: Dict[str, int]
    peak_active_vehicles: int
    avg_active_vehicles: float
    avg_pixel_speed: float
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
