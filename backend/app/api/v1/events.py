"""
UrbanEye AI — Events, Road Hazards & Infrastructure API

Endpoints for querying detected road hazards, infrastructure anomalies,
pedestrian safety risks, and behavioral violations.
"""

from __future__ import annotations

import uuid
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.repositories.event_repository import EventRepository
from app.repositories.video_repository import VideoRepository
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.schemas.event import EventStatisticsResponse, UrbanEventResponse

router = APIRouter(tags=["Events & Road Intelligence"])

DatabaseDep = Annotated[Session, Depends(get_db)]


# ── Global Events Query ───────────────────────────────────────────────────────
@router.get(
    "/events",
    response_model=PaginatedResponse[UrbanEventResponse],
    summary="List Urban Events",
    description="Retrieve paginated urban events across all videos with optional filtering.",
)
def list_events(
    db: DatabaseDep,
    video_id: Optional[uuid.UUID] = Query(default=None, description="Filter by video UUID"),
    category: Optional[str] = Query(
        default=None,
        description="Filter by category: HAZARD, INFRASTRUCTURE, SAFETY, BEHAVIOR, INCIDENT",
    ),
    event_type: Optional[str] = Query(
        default=None,
        description="Filter by specific event type: POTHOLE, WATERLOGGING, NEAR_MISS, etc.",
    ),
    severity: Optional[str] = Query(
        default=None,
        description="Filter by severity: LOW, MEDIUM, HIGH, CRITICAL",
    ),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
) -> PaginatedResponse[UrbanEventResponse]:
    event_repo = EventRepository(db)
    items, total = event_repo.get_events_for_video(
        video_id=video_id,
        category=category,
        event_type=event_type,
        severity=severity,
        page=page,
        limit=limit,
    )
    return PaginatedResponse.build(
        items=[UrbanEventResponse.model_validate(e) for e in items],
        page=page,
        limit=limit,
        total=total,
    )


# ── Global Event Statistics ───────────────────────────────────────────────────
@router.get(
    "/events/statistics",
    response_model=SuccessResponse[EventStatisticsResponse],
    summary="Get Global Event Statistics",
    description="Retrieve overall event statistics across all videos.",
)
def get_global_event_statistics(
    db: DatabaseDep,
    video_id: Optional[uuid.UUID] = Query(default=None, description="Filter by video UUID"),
) -> SuccessResponse[EventStatisticsResponse]:
    event_repo = EventRepository(db)
    stats = event_repo.get_event_statistics(video_id=video_id)
    return SuccessResponse(
        message="Event statistics retrieved successfully.",
        data=EventStatisticsResponse.model_validate(stats),
    )


# ── Query Events for Video ───────────────────────────────────────────────────
@router.get(
    "/videos/{video_id}/events",
    response_model=PaginatedResponse[UrbanEventResponse],
    summary="Get Video Urban Events",
    description=(
        "Retrieve paginated detected urban events (hazards, signs, pedestrian risks, "
        "and driving incidents) for a specific video with optional category/severity filters."
    ),
)
def get_video_events(
    video_id: uuid.UUID,
    db: DatabaseDep,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    category: Optional[str] = Query(
        default=None,
        description="Filter by category: HAZARD, INFRASTRUCTURE, SAFETY, BEHAVIOR, INCIDENT",
    ),
    event_type: Optional[str] = Query(
        default=None,
        description="Filter by specific event type: POTHOLE, WATERLOGGING, NEAR_MISS, RASH_DRIVING, etc.",
    ),
    severity: Optional[str] = Query(
        default=None,
        description="Filter by severity: LOW, MEDIUM, HIGH, CRITICAL",
    ),
) -> PaginatedResponse[UrbanEventResponse]:
    video_repo = VideoRepository(db)
    if not video_repo.get_video_by_id(video_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Video with id '{video_id}' not found.",
        )

    event_repo = EventRepository(db)
    items, total = event_repo.get_events_for_video(
        video_id=video_id,
        category=category,
        event_type=event_type,
        severity=severity,
        page=page,
        limit=limit,
    )

    return PaginatedResponse.build(
        items=[UrbanEventResponse.model_validate(e) for e in items],
        page=page,
        limit=limit,
        total=total,
    )


# ── Video Event Statistics ───────────────────────────────────────────────────
@router.get(
    "/videos/{video_id}/events/statistics",
    response_model=SuccessResponse[EventStatisticsResponse],
    summary="Get Video Event Statistics",
    description="Retrieve aggregated counts of events broken down by category, severity, and event type.",
)
def get_video_event_statistics(
    video_id: uuid.UUID,
    db: DatabaseDep,
) -> SuccessResponse[EventStatisticsResponse]:
    video_repo = VideoRepository(db)
    if not video_repo.get_video_by_id(video_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Video with id '{video_id}' not found.",
        )

    event_repo = EventRepository(db)
    stats = event_repo.get_event_statistics(video_id)

    return SuccessResponse(
        message="Event statistics retrieved successfully.",
        data=EventStatisticsResponse.model_validate(stats),
    )


# ── Single Event by ID ───────────────────────────────────────────────────────
@router.get(
    "/events/{event_id}",
    response_model=SuccessResponse[UrbanEventResponse],
    summary="Get Event by ID",
    description="Retrieve details for a single detected urban event.",
)
def get_event_by_id(
    event_id: uuid.UUID,
    db: DatabaseDep,
) -> SuccessResponse[UrbanEventResponse]:
    event_repo = EventRepository(db)
    event = event_repo.get_event_by_id(event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with id '{event_id}' not found.",
        )

    return SuccessResponse(
        message="Event retrieved successfully.",
        data=UrbanEventResponse.model_validate(event),
    )
