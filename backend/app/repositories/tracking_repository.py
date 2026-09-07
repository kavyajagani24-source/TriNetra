"""
UrbanEye AI — Tracking Repository

Data access layer for TrackedObject and TrajectoryPoint records.
"""

from __future__ import annotations

import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.tracked_object import TrackedObject
from app.models.trajectory import TrajectoryPoint


class TrackingRepository:
    """Data access layer for object tracking and trajectories."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def create_bulk_tracked_objects(self, objects: List[TrackedObject]) -> List[TrackedObject]:
        """Insert a batch of TrackedObject records and refresh them."""
        if not objects:
            return []
        self._db.add_all(objects)
        self._db.commit()
        for obj in objects:
            self._db.refresh(obj)
        return objects

    def get_tracked_objects_by_video(
        self,
        video_id: uuid.UUID,
        page: int = 1,
        limit: int = 50,
        class_name: Optional[str] = None,
    ) -> Tuple[List[TrackedObject], int]:
        """Paginated query for tracked objects associated with a video."""
        stmt = select(TrackedObject).where(TrackedObject.video_id == video_id)
        count_stmt = select(func.count(TrackedObject.id)).where(TrackedObject.video_id == video_id)

        if class_name:
            stmt = stmt.where(TrackedObject.class_name == class_name)
            count_stmt = count_stmt.where(TrackedObject.class_name == class_name)

        total = self._db.execute(count_stmt).scalar() or 0
        offset = (page - 1) * limit
        stmt = stmt.order_by(TrackedObject.track_id.asc()).offset(offset).limit(limit)

        items = list(self._db.execute(stmt).scalars().all())
        return items, total

    def get_tracked_object_by_id(self, tracked_object_id: uuid.UUID) -> Optional[TrackedObject]:
        """Fetch a single TrackedObject by UUID primary key."""
        stmt = select(TrackedObject).where(TrackedObject.id == tracked_object_id)
        return self._db.execute(stmt).scalar_one_or_none()

    def create_bulk_trajectory_points(self, points: List[TrajectoryPoint]) -> int:
        """Insert a batch of TrajectoryPoint records."""
        if not points:
            return 0
        self._db.add_all(points)
        self._db.commit()
        return len(points)

    def get_trajectory_points(self, tracked_object_id: uuid.UUID) -> List[TrajectoryPoint]:
        """Retrieve all chronological trajectory points for a tracked entity."""
        stmt = (
            select(TrajectoryPoint)
            .where(TrajectoryPoint.tracked_object_id == tracked_object_id)
            .order_by(TrajectoryPoint.frame_number.asc())
        )
        return list(self._db.execute(stmt).scalars().all())
