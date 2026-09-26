"""
TriNetra — Safety Repository

Data-access layer for SafetyRun and SafetyEvent ORM models.
All filtering / pagination lives here so routers stay thin.
"""

from __future__ import annotations

import uuid
from typing import Optional, Sequence, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.safety_run import SafetyEvent, SafetyRun


class SafetyRepository:
    """Read-only + mutation queries for safety_runs and safety_events."""

    def __init__(self, db: Session) -> None:
        self._db = db

    # ── SafetyRun ─────────────────────────────────────────────────────────────

    def get_run_by_id(self, run_id: uuid.UUID) -> Optional[SafetyRun]:
        stmt = select(SafetyRun).where(SafetyRun.id == run_id)
        return self._db.execute(stmt).scalar_one_or_none()

    def get_run_by_job_id(self, job_id: uuid.UUID) -> Optional[SafetyRun]:
        stmt = select(SafetyRun).where(SafetyRun.job_id == job_id)
        return self._db.execute(stmt).scalar_one_or_none()

    def get_run_by_video_id(self, video_id: uuid.UUID) -> Optional[SafetyRun]:
        """Return the most-recent SafetyRun for a video."""
        stmt = (
            select(SafetyRun)
            .where(SafetyRun.video_id == video_id)
            .order_by(SafetyRun.created_at.desc())
            .limit(1)
        )
        return self._db.execute(stmt).scalar_one_or_none()

    def list_runs(
        self,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[Sequence[SafetyRun], int]:
        """All runs, newest first."""
        count_stmt = select(func.count(SafetyRun.id))
        total = self._db.execute(count_stmt).scalar() or 0

        stmt = (
            select(SafetyRun)
            .order_by(SafetyRun.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        items = self._db.execute(stmt).scalars().all()
        return items, total

    # ── SafetyEvent ───────────────────────────────────────────────────────────

    def get_event_by_id(self, event_id: uuid.UUID) -> Optional[SafetyEvent]:
        stmt = select(SafetyEvent).where(SafetyEvent.id == event_id)
        return self._db.execute(stmt).scalar_one_or_none()

    def get_events_for_run(
        self,
        run_id: uuid.UUID,
        *,
        risk_level: Optional[str] = None,
        event_type: Optional[str] = None,
        min_score: Optional[float] = None,
        page: int = 1,
        limit: int = 100,
    ) -> Tuple[Sequence[SafetyEvent], int]:
        """
        Return paginated events for a safety run with optional filters.

        Filters:
            risk_level  — "high" | "medium" | "low"
            event_type  — e.g. "school_zone_crossing"
            min_score   — minimum risk_score (inclusive)
        """
        stmt = select(SafetyEvent).where(SafetyEvent.run_id == run_id)

        if risk_level:
            stmt = stmt.where(SafetyEvent.risk_level == risk_level.lower())
        if event_type:
            stmt = stmt.where(SafetyEvent.event_type == event_type)
        if min_score is not None:
            stmt = stmt.where(SafetyEvent.risk_score >= min_score)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = self._db.execute(count_stmt).scalar() or 0

        stmt = (
            stmt.order_by(SafetyEvent.start_frame.asc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        items = self._db.execute(stmt).scalars().all()
        return items, total

    def get_events_for_video(
        self,
        video_id: uuid.UUID,
        *,
        risk_level: Optional[str] = None,
        event_type: Optional[str] = None,
        min_score: Optional[float] = None,
        page: int = 1,
        limit: int = 100,
    ) -> Tuple[Sequence[SafetyEvent], int]:
        """Return paginated safety events scoped to a video."""
        stmt = select(SafetyEvent).where(SafetyEvent.video_id == video_id)

        if risk_level:
            stmt = stmt.where(SafetyEvent.risk_level == risk_level.lower())
        if event_type:
            stmt = stmt.where(SafetyEvent.event_type == event_type)
        if min_score is not None:
            stmt = stmt.where(SafetyEvent.risk_score >= min_score)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = self._db.execute(count_stmt).scalar() or 0

        stmt = (
            stmt.order_by(SafetyEvent.start_frame.asc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        items = self._db.execute(stmt).scalars().all()
        return items, total

    def count_by_risk_level(self, run_id: uuid.UUID) -> dict[str, int]:
        """Fast aggregate: count events per risk level for a run."""
        stmt = (
            select(SafetyEvent.risk_level, func.count(SafetyEvent.id))
            .where(SafetyEvent.run_id == run_id)
            .group_by(SafetyEvent.risk_level)
        )
        return dict(self._db.execute(stmt).all())
