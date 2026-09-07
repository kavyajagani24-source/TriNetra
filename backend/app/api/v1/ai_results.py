"""
UrbanEye AI — AI Results & Traffic Intelligence API

Endpoints for retrieving detections, tracked objects, vehicle trajectories,
and aggregated traffic analytics.
"""

from __future__ import annotations

import uuid
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.analytics import JobResultsResponse, TrafficAnalyticsResponse
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.schemas.detection import DetectionResponse
from app.schemas.tracking import TrackedObjectResponse, TrajectoryPointResponse
from app.services.analytics_service import AnalyticsService
from app.services.exceptions import NotFoundError

router = APIRouter(tags=["AI Results & Analytics"])

DatabaseDep = Annotated[Session, Depends(get_db)]


def _analytics_service(db: Session) -> AnalyticsService:
    return AnalyticsService(db)


# ── Processing Job Results ───────────────────────────────────────────────────
@router.get(
    "/processing/{job_id}/results",
    response_model=SuccessResponse[JobResultsResponse],
    summary="Get Job Results",
    description="Retrieve comprehensive AI results and traffic summary for a processing job.",
)
def get_job_results(
    job_id: uuid.UUID,
    db: DatabaseDep,
) -> SuccessResponse[JobResultsResponse]:
    service = _analytics_service(db)
    try:
        results = service.get_job_results(job_id)
        return SuccessResponse(
            message="Processing job results retrieved successfully.",
            data=JobResultsResponse.model_validate(results),
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)


# ── Video Detections ─────────────────────────────────────────────────────────
@router.get(
    "/videos/{video_id}/detections",
    response_model=PaginatedResponse[DetectionResponse],
    summary="Get Video Detections",
    description="Retrieve paginated bounding box detections for a video, filterable by class and track.",
)
def get_video_detections(
    video_id: uuid.UUID,
    db: DatabaseDep,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    class_name: Optional[str] = Query(default=None, description="Filter by class name (e.g. car, bus)"),
    track_id: Optional[int] = Query(default=None, description="Filter by track ID"),
) -> PaginatedResponse[DetectionResponse]:
    service = _analytics_service(db)
    try:
        items, total = service.get_video_detections(
            video_id=video_id,
            page=page,
            limit=limit,
            class_name=class_name,
            track_id=track_id,
        )
        return PaginatedResponse.build(
            items=[DetectionResponse.model_validate(d) for d in items],
            page=page,
            limit=limit,
            total=total,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)


# ── Tracked Objects ──────────────────────────────────────────────────────────
@router.get(
    "/videos/{video_id}/tracked-objects",
    response_model=PaginatedResponse[TrackedObjectResponse],
    summary="Get Tracked Objects",
    description="Retrieve unique tracked physical objects identified in a video.",
)
def get_video_tracked_objects(
    video_id: uuid.UUID,
    db: DatabaseDep,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    class_name: Optional[str] = Query(default=None, description="Filter by class name"),
) -> PaginatedResponse[TrackedObjectResponse]:
    service = _analytics_service(db)
    try:
        items, total = service.get_video_tracked_objects(
            video_id=video_id,
            page=page,
            limit=limit,
            class_name=class_name,
        )
        return PaginatedResponse.build(
            items=[TrackedObjectResponse.model_validate(o) for o in items],
            page=page,
            limit=limit,
            total=total,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)


# ── Object Trajectory ────────────────────────────────────────────────────────
@router.get(
    "/tracked-objects/{tracked_object_id}/trajectory",
    response_model=SuccessResponse[List[TrajectoryPointResponse]],
    summary="Get Object Trajectory",
    description="Retrieve full historical trajectory path coordinates for a tracked entity.",
)
def get_object_trajectory(
    tracked_object_id: uuid.UUID,
    db: DatabaseDep,
) -> SuccessResponse[List[TrajectoryPointResponse]]:
    service = _analytics_service(db)
    try:
        points = service.get_trajectory(tracked_object_id)
        return SuccessResponse(
            message="Trajectory points retrieved successfully.",
            data=[TrajectoryPointResponse.model_validate(p) for p in points],
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)


# ── Video Traffic Analytics ──────────────────────────────────────────────────
@router.get(
    "/videos/{video_id}/analytics",
    response_model=PaginatedResponse[TrafficAnalyticsResponse],
    summary="Get Traffic Analytics",
    description="Retrieve temporal traffic telemetry and density samples across video frames.",
)
def get_video_analytics(
    video_id: uuid.UUID,
    db: DatabaseDep,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
) -> PaginatedResponse[TrafficAnalyticsResponse]:
    service = _analytics_service(db)
    try:
        records, total = service.get_video_analytics(
            video_id=video_id,
            page=page,
            limit=limit,
        )
        return PaginatedResponse.build(
            items=[TrafficAnalyticsResponse.model_validate(r) for r in records],
            page=page,
            limit=limit,
            total=total,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)
