"""
UrbanEye AI — Video Pydantic Schemas

Request/response shapes for video upload and retrieval endpoints.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, computed_field


def _build_stream_url(file_path: Optional[str], filename: Optional[str]) -> str:
    if file_path:
        norm = file_path.replace("\\", "/")
        if "storage/" in norm:
            idx = norm.index("storage/")
            return "/" + norm[idx:]
    if filename:
        return f"/storage/uploads/{filename}"
    return ""


class VideoResponse(BaseModel):
    """Full video record returned from the API."""

    id: uuid.UUID
    filename: str
    original_filename: str
    file_path: Optional[str] = None
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

    @computed_field
    def stream_url(self) -> str:
        return _build_stream_url(self.file_path, self.filename)

    model_config = {"from_attributes": True}


class VideoListResponse(BaseModel):
    """Slim video record used inside paginated list responses."""

    id: uuid.UUID
    filename: Optional[str] = None
    original_filename: str
    file_path: Optional[str] = None
    file_size: int
    duration: Optional[float] = None
    status: str
    bus_id: Optional[uuid.UUID] = None
    created_at: datetime

    @computed_field
    def stream_url(self) -> str:
        return _build_stream_url(self.file_path, self.filename)

    model_config = {"from_attributes": True}


class VideoUploadResponse(BaseModel):
    """Response returned immediately after a successful video upload."""

    id: uuid.UUID
    filename: Optional[str] = None
    original_filename: str
    file_path: Optional[str] = None
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

    @computed_field
    def stream_url(self) -> str:
        return _build_stream_url(self.file_path, self.filename)

    model_config = {"from_attributes": True}
