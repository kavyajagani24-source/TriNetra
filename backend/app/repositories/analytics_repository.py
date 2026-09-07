"""
UrbanEye AI — Analytics Repository

Data access layer for TrafficAnalytics records and metric summaries.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.traffic_analytics import TrafficAnalytics


class AnalyticsRepository:
    """Data access layer for temporal traffic metrics and aggregates."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def create_bulk_analytics(self, records: List[TrafficAnalytics]) -> int:
        """Insert a batch of TrafficAnalytics entries."""
        if not records:
            return 0
        self._db.add_all(records)
        self._db.commit()
        return len(records)

    def get_analytics_by_video(
        self,
        video_id: uuid.UUID,
        page: int = 1,
        limit: int = 100,
    ) -> Tuple[List[TrafficAnalytics], int]:
        """Paginated query for traffic analytics timeseries for a video."""
        stmt = select(TrafficAnalytics).where(TrafficAnalytics.video_id == video_id)
        count_stmt = select(func.count(TrafficAnalytics.id)).where(TrafficAnalytics.video_id == video_id)

        total = self._db.execute(count_stmt).scalar() or 0
        offset = (page - 1) * limit
        stmt = stmt.order_by(TrafficAnalytics.frame_number.asc()).offset(offset).limit(limit)

        records = list(self._db.execute(stmt).scalars().all())
        return records, total

    def get_analytics_by_job(self, job_id: uuid.UUID) -> List[TrafficAnalytics]:
        """Retrieve all analytics rows for a specific processing job."""
        stmt = (
            select(TrafficAnalytics)
            .where(TrafficAnalytics.job_id == job_id)
            .order_by(TrafficAnalytics.frame_number.asc())
        )
        return list(self._db.execute(stmt).scalars().all())

    def get_video_analytics_summary(self, video_id: uuid.UUID) -> Dict[str, Any]:
        """Compute high-level statistical summary for a video's traffic."""
        stmt = select(
            func.max(TrafficAnalytics.active_vehicle_count).label("peak_vehicles"),
            func.avg(TrafficAnalytics.active_vehicle_count).label("avg_vehicles"),
            func.avg(TrafficAnalytics.average_pixel_speed).label("avg_speed"),
            func.count(TrafficAnalytics.id).label("total_data_points"),
        ).where(TrafficAnalytics.video_id == video_id)

        row = self._db.execute(stmt).one_or_none()
        if not row or row.total_data_points == 0:
            return {
                "peak_active_vehicles": 0,
                "avg_active_vehicles": 0.0,
                "avg_pixel_speed": 0.0,
                "data_points": 0,
            }

        return {
            "peak_active_vehicles": row.peak_vehicles or 0,
            "avg_active_vehicles": float(row.avg_vehicles or 0.0),
            "avg_pixel_speed": float(row.avg_speed or 0.0),
            "data_points": row.total_data_points or 0,
        }
