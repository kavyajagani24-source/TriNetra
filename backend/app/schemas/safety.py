"""
TriNetra — Safety API Schemas (Pydantic v2)

Response models for /api/v1/safety/* endpoints.
Mirror the SafetyEvent schema v1.0 exactly so the frontend can rely on them.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


# ── Sub-schemas ───────────────────────────────────────────────────────────────

class SafetyRunSummaryResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    job_id: uuid.UUID
    video_id: uuid.UUID
    source_video_path: Optional[str] = None
    total_frames: int
    processed_frames: int
    elapsed_seconds: float
    processing_fps: float
    total_events: int
    events_by_type: Optional[dict[str, int]] = None
    annotated_video_path: Optional[str] = None
    safety_output_dir: Optional[str] = None
    video_fps: float
    created_at: datetime
    updated_at: datetime


class SafetyEventListItem(BaseModel):
    """Compact event representation for the event feed / table."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    run_id: uuid.UUID
    video_id: uuid.UUID
    source_event_id: str
    event_type: str
    event_timestamp: Optional[datetime] = None

    frame_index: int
    start_frame: int
    end_frame: int
    duration_frames: int

    bus_id: Optional[str] = None
    camera_id: Optional[str] = None

    latitude: Optional[float] = None
    longitude: Optional[float] = None

    track_id: Optional[int] = None
    object_type: Optional[str] = None

    risk_level: str
    risk_score: float
    risk_confidence: float
    risk_reasons: Optional[list[str]] = None

    in_school_zone: bool
    in_crossing_zone: bool
    road_entry: bool

    trigger_frame_index: Optional[int] = None
    peak_frame_index: Optional[int] = None

    # URL-resolved evidence frames (populated by router)
    evidence_frame_urls: list[str] = Field(default_factory=list)

    created_at: datetime


class SafetyEventDetailResponse(BaseModel):
    """Full event detail including explanation, context, and trajectory."""

    model_config = {"from_attributes": True, "arbitrary_types_allowed": True}

    id: uuid.UUID
    run_id: uuid.UUID
    job_id: uuid.UUID
    video_id: uuid.UUID
    source_event_id: str
    schema_version: str
    event_type: str
    event_timestamp: Optional[datetime] = None

    frame_index: int
    start_frame: int
    end_frame: int
    duration_frames: int

    # Source
    bus_id: Optional[str] = None
    camera_id: Optional[str] = None
    source_video_path: Optional[str] = None

    # Location
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    gps_accuracy_m: Optional[float] = None

    # Track
    track_id: Optional[int] = None
    object_type: Optional[str] = None
    track_first_frame: Optional[int] = None
    track_last_frame: Optional[int] = None
    track_age_frames: Optional[int] = None

    # Bounding box
    bbox_x1: Optional[float] = None
    bbox_y1: Optional[float] = None
    bbox_x2: Optional[float] = None
    bbox_y2: Optional[float] = None
    bbox_confidence: Optional[float] = None

    # Risk
    risk_level: str
    risk_score: float
    risk_confidence: float
    risk_explanation: Optional[str] = None
    risk_reasons: Optional[list[str]] = None

    # Context
    context: Optional[dict[str, Any]] = None

    # Evidence
    evidence_frames: Optional[list[str]] = None
    evidence_frame_urls: list[str] = Field(default_factory=list)
    evidence_clip: Optional[str] = None
    trigger_frame_index: Optional[int] = None
    peak_frame_index: Optional[int] = None
    trajectory_snapshot: Optional[list[dict[str, Any]]] = None

    # Bool shortcuts
    in_school_zone: bool
    in_crossing_zone: bool
    road_entry: bool

    created_at: datetime
    updated_at: datetime

    # ── Computed helpers ──────────────────────────────────────────────────────
    @property
    def duration_seconds(self) -> float:
        """duration_frames / video FPS (default 30). Frontend uses this for display."""
        return round(self.duration_frames / 30.0, 2)

    @property
    def start_time_seconds(self) -> float:
        return round(self.start_frame / 30.0, 3)

    @property
    def peak_time_seconds(self) -> Optional[float]:
        if self.peak_frame_index is not None:
            return round(self.peak_frame_index / 30.0, 3)
        return None


class SafetyRunListItem(BaseModel):
    """Compact run representation for run listings (includes all fields needed by the frontend)."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    job_id: uuid.UUID
    video_id: uuid.UUID
    source_video_path: Optional[str] = None
    total_events: int
    total_frames: int
    processed_frames: int = 0
    elapsed_seconds: float = 0.0
    processing_fps: float
    events_by_type: Optional[dict[str, int]] = None
    annotated_video_path: Optional[str] = None
    safety_output_dir: Optional[str] = None
    video_fps: float
    created_at: datetime
    updated_at: datetime = Field(default_factory=datetime.utcnow)

