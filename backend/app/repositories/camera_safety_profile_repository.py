"""
UrbanEye AI — CameraSafetyProfile Repository

Data access layer for camera spatial calibrations and zone profiles.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.camera_safety_profile import CameraSafetyProfile

logger = logging.getLogger(__name__)


class CameraSafetyProfileRepository:
    """Handles CRUD operations for camera safety profiles."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_camera_id(self, camera_id: str) -> Optional[CameraSafetyProfile]:
        return (
            self.db.query(CameraSafetyProfile)
            .filter(CameraSafetyProfile.camera_id == camera_id)
            .first()
        )

    def get_by_id(self, profile_id: uuid.UUID) -> Optional[CameraSafetyProfile]:
        return (
            self.db.query(CameraSafetyProfile)
            .filter(CameraSafetyProfile.id == profile_id)
            .first()
        )

    def list_profiles(self, limit: int = 100, offset: int = 0) -> List[CameraSafetyProfile]:
        return (
            self.db.query(CameraSafetyProfile)
            .order_by(CameraSafetyProfile.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def count_profiles(self) -> int:
        return self.db.query(CameraSafetyProfile).count()

    def upsert_profile(
        self,
        camera_id: str,
        resolution_width: int,
        resolution_height: int,
        zones: List[Dict[str, Any]],
        enabled: bool = True,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> CameraSafetyProfile:
        """Create or update a camera safety profile (idempotent)."""
        existing = self.get_by_camera_id(camera_id)
        if existing:
            existing.resolution_width = resolution_width
            existing.resolution_height = resolution_height
            existing.zones = zones
            existing.enabled = enabled
            if extra_metadata is not None:
                existing.extra_metadata = extra_metadata
            self.db.commit()
            self.db.refresh(existing)
            logger.info("Updated camera safety profile for camera=%s", camera_id)
            return existing

        profile = CameraSafetyProfile(
            camera_id=camera_id,
            resolution_width=resolution_width,
            resolution_height=resolution_height,
            zones=zones,
            enabled=enabled,
            extra_metadata=extra_metadata or {},
        )
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(profile)
        logger.info("Created new camera safety profile for camera=%s", camera_id)
        return profile

    def delete_profile(self, camera_id: str) -> bool:
        profile = self.get_by_camera_id(camera_id)
        if not profile:
            return False
        self.db.delete(profile)
        self.db.commit()
        logger.info("Deleted camera safety profile for camera=%s", camera_id)
        return True
