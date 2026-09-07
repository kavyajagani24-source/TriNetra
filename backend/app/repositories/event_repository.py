"""
UrbanEye AI — Event Repository

Handles database queries and bulk inserts for UrbanEvent records.
"""

from __future__ import annotations

import uuid
from typing import List, Optional, Sequence, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.urban_event import UrbanEvent


class EventRepository:
    """Data access layer for UrbanEvent records."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def create_event(self, event: UrbanEvent) -> UrbanEvent:
        """Insert a single UrbanEvent record."""
        self._db.add(event)
        self._db.commit()
        self._db.refresh(event)
        return event

    def create_bulk_events(self, events: List[UrbanEvent]) -> List[UrbanEvent]:
        """Insert a batch of UrbanEvent records."""
        if not events:
            return []
        self._db.add_all(events)
        self._db.commit()
        return events

    def get_event_by_id(self, event_id: uuid.UUID) -> Optional[UrbanEvent]:
        """Fetch a single UrbanEvent by primary key."""
        stmt = select(UrbanEvent).where(UrbanEvent.id == event_id)
        return self._db.execute(stmt).scalar_one_or_none()

    def get_events_for_video(
        self,
        video_id: Optional[uuid.UUID] = None,
        category: Optional[str] = None,
        event_type: Optional[str] = None,
        severity: Optional[str] = None,
        page: int = 1,
        limit: int = 50,
    ) -> Tuple[Sequence[UrbanEvent], int]:
        """
        Fetch paginated UrbanEvent records with optional video, category, type, and severity filtering.
        """
        stmt = select(UrbanEvent)
        if video_id is not None:
            stmt = stmt.where(UrbanEvent.video_id == video_id)

        if category:
            stmt = stmt.where(UrbanEvent.category == category.upper())
        if event_type:
            stmt = stmt.where(UrbanEvent.event_type == event_type.upper())
        if severity:
            stmt = stmt.where(UrbanEvent.severity == severity.upper())

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = self._db.execute(count_stmt).scalar() or 0

        # Paginate
        stmt = (
            stmt.order_by(UrbanEvent.frame_number.asc(), UrbanEvent.created_at.asc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        items = self._db.execute(stmt).scalars().all()
        return items, total

    def get_events_for_job(
        self,
        job_id: uuid.UUID,
    ) -> Sequence[UrbanEvent]:
        """Fetch all UrbanEvents for a processing job."""
        stmt = (
            select(UrbanEvent)
            .where(UrbanEvent.job_id == job_id)
            .order_by(UrbanEvent.frame_number.asc())
        )
        return self._db.execute(stmt).scalars().all()

    def get_event_statistics(
        self, video_id: Optional[uuid.UUID] = None
    ) -> dict:
        """
        Get aggregated counts by category and severity (optionally scoped to a video).
        """
        cat_stmt = select(UrbanEvent.category, func.count(UrbanEvent.id))
        if video_id is not None:
            cat_stmt = cat_stmt.where(UrbanEvent.video_id == video_id)
        cat_stmt = cat_stmt.group_by(UrbanEvent.category)
        cat_counts = dict(self._db.execute(cat_stmt).all())

        sev_stmt = select(UrbanEvent.severity, func.count(UrbanEvent.id))
        if video_id is not None:
            sev_stmt = sev_stmt.where(UrbanEvent.video_id == video_id)
        sev_stmt = sev_stmt.group_by(UrbanEvent.severity)
        sev_counts = dict(self._db.execute(sev_stmt).all())

        type_stmt = select(UrbanEvent.event_type, func.count(UrbanEvent.id))
        if video_id is not None:
            type_stmt = type_stmt.where(UrbanEvent.video_id == video_id)
        type_stmt = type_stmt.group_by(UrbanEvent.event_type)
        type_counts = dict(self._db.execute(type_stmt).all())

        total_stmt = select(func.count(UrbanEvent.id))
        if video_id is not None:
            total_stmt = total_stmt.where(UrbanEvent.video_id == video_id)
        total = self._db.execute(total_stmt).scalar() or 0

        return {
            "total_events": total,
            "by_category": cat_counts,
            "by_severity": sev_counts,
            "by_event_type": type_counts,
        }
