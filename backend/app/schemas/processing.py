"""
UrbanEye AI — Processing Job Pydantic Schemas

Request/response shapes for processing job endpoints.
Phase 1 only creates QUEUED jobs; Phase 2 will advance job status.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ProcessVideoRequest(BaseModel):
    """Request payload to initiate AI processing."""

    mode: Optional[str] = "multi_engine"  # "multi_engine" | "road" | "traffic" | "safety" | "incident"
    force_reprocess: Optional[bool] = False


class ProcessingJobResponse(BaseModel):
    """Full processing job record."""

    id: uuid.UUID
    video_id: uuid.UUID
    status: str
    mode: Optional[str] = "multi_engine"
    progress_percentage: float
    frames_processed: int
    total_frames: Optional[int] = None
    events_detected: int
    error_message: Optional[str] = None
    engine_statuses: Optional[dict] = None
    annotated_road_path: Optional[str] = None
    annotated_traffic_path: Optional[str] = None
    annotated_safety_path: Optional[str] = None
    annotated_incident_path: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProcessingJobCreateResponse(BaseModel):
    """Slim response returned when a new processing job is created."""

    job_id: uuid.UUID
    video_id: uuid.UUID
    status: str
    mode: Optional[str] = "multi_engine"
    progress_percentage: float

    model_config = {"from_attributes": True}


class VideoProcessingStatus(BaseModel):
    """Combined video + latest job status for the status endpoint."""

    video_id: uuid.UUID
    video_status: str
    job_id: Optional[uuid.UUID] = None
    job_status: Optional[str] = None
    mode: Optional[str] = "multi_engine"
    progress_percentage: Optional[float] = None
    frames_processed: Optional[int] = 0
    total_frames: Optional[int] = 0
    events_detected: Optional[int] = 0
    error_message: Optional[str] = None
    engine_statuses: Optional[dict] = None
    annotated_road_path: Optional[str] = None
    annotated_traffic_path: Optional[str] = None
    annotated_safety_path: Optional[str] = None
    annotated_incident_path: Optional[str] = None
