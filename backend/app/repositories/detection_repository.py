"""
UrbanEye AI — Detection Repository

Data access layer for Detection records.
"""

from __future__ import annotations

import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.detection import Detection


class DetectionRepository:
    """Data access layer for Detection entities."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def create_bulk_detections(self, detections: List[Detection]) -> int:
        """Insert a batch of Detection records efficiently."""
        if not detections:
            return 0
        self._db.add_all(detections)
        self._db.commit()
        return len(detections)

    def get_detections_by_video(
        self,
        video_id: uuid.UUID,
        page: int = 1,
        limit: int = 50,
        class_name: Optional[str] = None,
        track_id: Optional[int] = None,
        min_confidence: Optional[float] = None,
    ) -> Tuple[List[Detection], int]:
        """Paginated query for detections associated with a video."""
        stmt = select(Detection).where(Detection.video_id == video_id)
        count_stmt = select(func.count(Detection.id)).where(Detection.video_id == video_id)

        if class_name:
            stmt = stmt.where(Detection.class_name == class_name)
            count_stmt = count_stmt.where(Detection.class_name == class_name)

        if track_id is not None:
            stmt = stmt.where(Detection.track_id == track_id)
            count_stmt = count_stmt.where(Detection.track_id == track_id)

        if min_confidence is not None:
            stmt = stmt.where(Detection.confidence >= min_confidence)
            count_stmt = count_stmt.where(Detection.confidence >= min_confidence)

        total = self._db.execute(count_stmt).scalar() or 0
        offset = (page - 1) * limit
        stmt = stmt.order_by(Detection.frame_number.asc()).offset(offset).limit(limit)

        detections = list(self._db.execute(stmt).scalars().all())
        return detections, total

    def get_detections_by_job(
        self,
        job_id: uuid.UUID,
        page: int = 1,
        limit: int = 50,
    ) -> Tuple[List[Detection], int]:
        """Paginated query for detections associated with a processing job."""
        stmt = select(Detection).where(Detection.job_id == job_id)
        count_stmt = select(func.count(Detection.id)).where(Detection.job_id == job_id)

        total = self._db.execute(count_stmt).scalar() or 0
        offset = (page - 1) * limit
        stmt = stmt.order_by(Detection.frame_number.asc()).offset(offset).limit(limit)

        detections = list(self._db.execute(stmt).scalars().all())
        return detections, total
