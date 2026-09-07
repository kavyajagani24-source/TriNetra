"""
UrbanEye AI — Video Pydantic Schemas

Request/response shapes for video upload and retrieval endpoints.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class VideoResponse(BaseModel):
    """Full video record returned from the API."""

    id: uuid.UUID
    filename: str
    original_filename: str
    file_size: int
    format: Optional[str] = None
    fps: Optional[float] = None
    frame_count: Optional[int] = None
    duration: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    status: str
    bus_id: Optional[uuid.UUID] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VideoListResponse(BaseModel):
    """Slim video record used inside paginated list responses."""

    id: uuid.UUID
    original_filename: str
    file_size: int
    duration: Optional[float] = None
    status: str
    bus_id: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class VideoUploadResponse(BaseModel):
    """Response returned immediately after a successful video upload."""

    id: uuid.UUID
    original_filename: str
    file_size: int
    format: Optional[str] = None
    fps: Optional[float] = None
    frame_count: Optional[int] = None
    duration: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    status: str
    bus_id: Optional[uuid.UUID] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}
