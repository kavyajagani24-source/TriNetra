"""
UrbanEye AI — Video Endpoints

POST   /api/v1/videos/upload              — Upload a video
GET    /api/v1/videos                     — List videos (paginated)
GET    /api/v1/videos/{video_id}          — Get a single video
DELETE /api/v1/videos/{video_id}          — Delete a video + file
POST   /api/v1/videos/{video_id}/process  — Create a processing job
GET    /api/v1/videos/{video_id}/status   — Get processing status
"""

import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile, status

from app.api.dependencies import DatabaseDep
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.schemas.processing import ProcessingJobCreateResponse, VideoProcessingStatus
from app.schemas.video import VideoListResponse, VideoResponse, VideoUploadResponse
from app.services.ai_processing_service import AIProcessingService
from app.services.exceptions import (
    ConflictError,
    NotFoundError,
    ProcessingConflictError,
    StorageError,
    ValidationError,
)
from app.services.processing_service import ProcessingService
from app.services.video_service import VideoService

router = APIRouter(prefix="/videos", tags=["Videos"])


def _video_service(db: DatabaseDep) -> VideoService:
    return VideoService(db)


def _proc_service(db: DatabaseDep) -> ProcessingService:
    return ProcessingService(db)


# ── Upload ────────────────────────────────────────────────────────────────────
@router.post(
    "/upload",
    response_model=SuccessResponse[VideoUploadResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Upload a Video",
    description=(
        "Upload a video file (mp4/avi/mov/mkv). "
        "The server validates the file, saves it, and extracts metadata via OpenCV."
    ),
)
async def upload_video(
    db: DatabaseDep,
    file: UploadFile = File(..., description="Video file to upload"),
    bus_id: Optional[uuid.UUID] = Form(
        default=None, description="UUID of the bus this video belongs to"
    ),
    latitude: Optional[float] = Form(
        default=None, description="GPS latitude (-90 to 90)"
    ),
    longitude: Optional[float] = Form(
        default=None, description="GPS longitude (-180 to 180)"
    ),
) -> SuccessResponse[VideoUploadResponse]:
    service = _video_service(db)
    try:
        video = await service.upload_video(
            upload_file=file,
            bus_id=bus_id,
            latitude=latitude,
            longitude=longitude,
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.message,
        )
    except StorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=exc.message,
        )

    return SuccessResponse(
        message="Video uploaded successfully.",
        data=VideoUploadResponse.model_validate(video),
    )


# ── List ──────────────────────────────────────────────────────────────────────
@router.get(
    "",
    response_model=PaginatedResponse[VideoListResponse],
    summary="List Videos",
    description="Returns a paginated list of videos, filterable by status and bus.",
)
def list_videos(
    db: DatabaseDep,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[str] = Query(
        default=None, alias="status", description="Filter by video status"
    ),
    bus_id: Optional[uuid.UUID] = Query(
        default=None, description="Filter by bus UUID"
    ),
) -> PaginatedResponse[VideoListResponse]:
    service = _video_service(db)
    try:
        videos, total = service.list_videos(
            page=page, limit=limit, status=status_filter, bus_id=bus_id
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.message,
        )

    return PaginatedResponse.build(
        items=[VideoListResponse.model_validate(v) for v in videos],
        page=page,
        limit=limit,
        total=total,
    )


# ── Get Single ────────────────────────────────────────────────────────────────
@router.get(
    "/{video_id}",
    response_model=SuccessResponse[VideoResponse],
    summary="Get a Video",
    description="Returns the full metadata for a single video by UUID.",
)
def get_video(
    video_id: uuid.UUID,
    db: DatabaseDep,
) -> SuccessResponse[VideoResponse]:
    service = _video_service(db)
    try:
        video = service.get_video(video_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)

    return SuccessResponse(
        message="Video retrieved successfully.",
        data=VideoResponse.model_validate(video),
    )


# ── Delete ────────────────────────────────────────────────────────────────────
@router.delete(
    "/{video_id}",
    response_model=SuccessResponse[None],
    summary="Delete a Video",
    description=(
        "Deletes a video file and its database record. "
        "Fails if the video is currently being processed."
    ),
)
def delete_video(
    video_id: uuid.UUID,
    db: DatabaseDep,
) -> SuccessResponse[None]:
    service = _video_service(db)
    try:
        service.delete_video(video_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message)
    except StorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=exc.message,
        )

    return SuccessResponse(message="Video deleted successfully.", data=None)


# ── Create Processing Job ─────────────────────────────────────────────────────
@router.post(
    "/{video_id}/process",
    response_model=SuccessResponse[ProcessingJobCreateResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create Processing Job",
    description=(
        "Creates a processing job for the video and starts the AI computer vision "
        "pipeline asynchronously in the background."
    ),
)
def create_processing_job(
    video_id: uuid.UUID,
    db: DatabaseDep,
    background_tasks: BackgroundTasks,
) -> SuccessResponse[ProcessingJobCreateResponse]:
    service = _proc_service(db)
    try:
        job = service.create_processing_job(video_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)
    except ProcessingConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message)

    # Dispatch AI Computer Vision worker in background
    ai_service = AIProcessingService()
    background_tasks.add_task(ai_service.run_processing_job, job.id)

    return SuccessResponse(
        message="Processing job created and AI processing started successfully.",
        data=ProcessingJobCreateResponse(
            job_id=job.id,
            video_id=job.video_id,
            status=job.status,
            progress_percentage=job.progress_percentage,
        ),
    )


# ── Processing Status ─────────────────────────────────────────────────────────
@router.get(
    "/{video_id}/status",
    response_model=SuccessResponse[VideoProcessingStatus],
    summary="Get Video Processing Status",
    description="Returns the current processing status for a video and its latest job.",
)
def get_video_status(
    video_id: uuid.UUID,
    db: DatabaseDep,
) -> SuccessResponse[VideoProcessingStatus]:
    service = _proc_service(db)
    try:
        status_data = service.get_video_processing_status(video_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)

    return SuccessResponse(
        message="Video processing status retrieved.",
        data=status_data,
    )
