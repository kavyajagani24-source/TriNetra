"""
UrbanEye AI — Video Repository

Handles all database operations for the Video model.
"""

import uuid
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.video import Video


class VideoRepository:
    """Data access layer for Video entities."""

    def __init__(self, db: Session) -> None:
        self._db = db

    # ── Create ────────────────────────────────────────────────────────────────
    def create_video(self, **kwargs) -> Video:
        """Persist a new Video record and return it."""
        video = Video(**kwargs)
        self._db.add(video)
        self._db.commit()
        self._db.refresh(video)
        return video

    # ── Read ──────────────────────────────────────────────────────────────────
    def get_video_by_id(self, video_id: uuid.UUID) -> Optional[Video]:
        """Return a Video by its UUID primary key, or None."""
        stmt = select(Video).where(Video.id == video_id)
        return self._db.execute(stmt).scalar_one_or_none()

    def get_all_videos(
        self,
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None,
        bus_id: Optional[uuid.UUID] = None,
    ) -> tuple[list[Video], int]:
        """
        Return a paginated list of videos and the total count.

        Args:
            page:   1-based page number.
            limit:  Records per page.
            status: Optional status filter.
            bus_id: Optional bus filter.

        Returns:
            Tuple of (list of Video, total record count).
        """
        stmt = select(Video)
        count_stmt = select(func.count(Video.id))

        if status:
            stmt = stmt.where(Video.status == status)
            count_stmt = count_stmt.where(Video.status == status)

        if bus_id:
            stmt = stmt.where(Video.bus_id == bus_id)
            count_stmt = count_stmt.where(Video.bus_id == bus_id)

        total = self._db.execute(count_stmt).scalar_one()

        stmt = (
            stmt.order_by(Video.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        videos = list(self._db.execute(stmt).scalars().all())
        return videos, total

    # ── Update ────────────────────────────────────────────────────────────────
    def update_video_status(self, video: Video, status: str) -> Video:
        """Update the status field of a Video record."""
        video.status = status
        self._db.commit()
        self._db.refresh(video)
        return video

    def update_video(self, video: Video, **kwargs) -> Video:
        """Apply keyword updates to a Video and persist."""
        for key, value in kwargs.items():
            setattr(video, key, value)
        self._db.commit()
        self._db.refresh(video)
        return video

    # ── Delete ────────────────────────────────────────────────────────────────
    def delete_video(self, video: Video) -> None:
        """Delete a Video record from the database."""
        self._db.delete(video)
        self._db.commit()
