"""
UrbanEye AI — Camera Safety Profiles API Router

Endpoints for managing camera-specific zone configurations (Module 3 Safety AI).
"""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.repositories.camera_safety_profile_repository import CameraSafetyProfileRepository
from app.schemas.camera_safety_profile import (
    CameraSafetyProfileCreate,
    CameraSafetyProfileResponse,
    CameraSafetyProfileUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cameras", tags=["Camera Safety Profiles"])


@router.get(
    "/safety-profiles",
    response_model=List[CameraSafetyProfileResponse],
    summary="List all camera safety profiles",
)
def list_safety_profiles(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> List[CameraSafetyProfileResponse]:
    """Retrieve all calibrated camera safety profiles."""
    repo = CameraSafetyProfileRepository(db)
    return repo.list_profiles(limit=limit, offset=offset)


@router.get(
    "/{camera_id}/safety-profile",
    response_model=CameraSafetyProfileResponse,
    summary="Get camera safety profile",
)
def get_camera_safety_profile(
    camera_id: str,
    db: Session = Depends(get_db),
) -> CameraSafetyProfileResponse:
    """Retrieve spatial zone calibration for a specific camera."""
    repo = CameraSafetyProfileRepository(db)
    profile = repo.get_by_camera_id(camera_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Safety profile for camera '{camera_id}' not found.",
        )
    return profile


@router.put(
    "/{camera_id}/safety-profile",
    response_model=CameraSafetyProfileResponse,
    summary="Create or update camera safety profile",
)
def upsert_camera_safety_profile(
    camera_id: str,
    payload: CameraSafetyProfileCreate,
    db: Session = Depends(get_db),
) -> CameraSafetyProfileResponse:
    """Create or update spatial zones for a camera viewpoint."""
    repo = CameraSafetyProfileRepository(db)
    zone_dicts = [z.model_dump() for z in payload.zones]
    profile = repo.upsert_profile(
        camera_id=camera_id,
        resolution_width=payload.resolution_width,
        resolution_height=payload.resolution_height,
        zones=zone_dicts,
        enabled=payload.enabled,
        extra_metadata=payload.extra_metadata,
    )
    return profile


@router.delete(
    "/{camera_id}/safety-profile",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete camera safety profile",
)
def delete_camera_safety_profile(
    camera_id: str,
    db: Session = Depends(get_db),
) -> None:
    """Remove spatial calibration profile for a camera."""
    repo = CameraSafetyProfileRepository(db)
    deleted = repo.delete_profile(camera_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Safety profile for camera '{camera_id}' not found.",
        )
