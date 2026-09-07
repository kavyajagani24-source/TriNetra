"""
UrbanEye AI — Analytics Service

High-level business service querying and aggregating AI detections,
tracking results, and traffic telemetry.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.detection import Detection
from app.models.tracked_object import TrackedObject
from app.models.traffic_analytics import TrafficAnalytics
from app.models.trajectory import TrajectoryPoint
from app.repositories.analytics_repository import AnalyticsRepository
from app.repositories.detection_repository import DetectionRepository
from app.repositories.processing_repository import ProcessingRepository
from app.repositories.tracking_repository import TrackingRepository
from app.repositories.video_repository import VideoRepository
from app.services.exceptions import NotFoundError


class AnalyticsService:
    """Service providing query and aggregation endpoints for AI outputs."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.video_repo = VideoRepository(db)
        self.processing_repo = ProcessingRepository(db)
        self.detection_repo = DetectionRepository(db)
        self.tracking_repo = TrackingRepository(db)
        self.analytics_repo = AnalyticsRepository(db)

    def get_job_results(self, job_id: uuid.UUID) -> Dict[str, Any]:
        """Aggregate all AI results for a given processing job."""
        job = self.processing_repo.get_job_by_id(job_id)
        if not job:
            raise NotFoundError(f"Processing job '{job_id}' not found.")

        video = self.video_repo.get_video_by_id(job.video_id)
        tracked_objs, total_tracked = self.tracking_repo.get_tracked_objects_by_video(
            job.video_id, page=1, limit=1000
        )
        analytics_summary = self.analytics_repo.get_video_analytics_summary(job.video_id)

        # Count distribution
        counts_by_class: Dict[str, int] = {}
        for obj in tracked_objs:
            counts_by_class[obj.class_name] = counts_by_class.get(obj.class_name, 0) + 1

        return {
            "job_id": job.id,
            "video_id": job.video_id,
            "status": job.status,
            "progress_percentage": job.progress_percentage,
            "frames_processed": job.frames_processed,
            "total_frames": job.total_frames,
            "total_unique_vehicles": job.events_detected,
            "counts_by_class": counts_by_class,
            "peak_active_vehicles": analytics_summary["peak_active_vehicles"],
            "avg_active_vehicles": analytics_summary["avg_active_vehicles"],
            "avg_pixel_speed": analytics_summary["avg_pixel_speed"],
            "started_at": job.started_at,
            "completed_at": job.completed_at,
            "error_message": job.error_message,
        }

    def get_video_detections(
        self,
        video_id: uuid.UUID,
        page: int = 1,
        limit: int = 50,
        class_name: Optional[str] = None,
        track_id: Optional[int] = None,
    ) -> Tuple[List[Detection], int]:
        """Fetch paginated detections for a video."""
        video = self.video_repo.get_video_by_id(video_id)
        if not video:
            raise NotFoundError(f"Video '{video_id}' not found.")

        return self.detection_repo.get_detections_by_video(
            video_id=video_id,
            page=page,
            limit=limit,
            class_name=class_name,
            track_id=track_id,
        )

    def get_video_tracked_objects(
        self,
        video_id: uuid.UUID,
        page: int = 1,
        limit: int = 50,
        class_name: Optional[str] = None,
    ) -> Tuple[List[TrackedObject], int]:
        """Fetch paginated tracked objects for a video."""
        video = self.video_repo.get_video_by_id(video_id)
        if not video:
            raise NotFoundError(f"Video '{video_id}' not found.")

        return self.tracking_repo.get_tracked_objects_by_video(
            video_id=video_id,
            page=page,
            limit=limit,
            class_name=class_name,
        )

    def get_trajectory(self, tracked_object_id: uuid.UUID) -> List[TrajectoryPoint]:
        """Retrieve path points for a tracked object."""
        obj = self.tracking_repo.get_tracked_object_by_id(tracked_object_id)
        if not obj:
            raise NotFoundError(f"Tracked object '{tracked_object_id}' not found.")

        return self.tracking_repo.get_trajectory_points(tracked_object_id)

    def get_video_analytics(
        self,
        video_id: uuid.UUID,
        page: int = 1,
        limit: int = 100,
    ) -> Tuple[List[TrafficAnalytics], int]:
        """Retrieve time-series analytics for a video."""
        video = self.video_repo.get_video_by_id(video_id)
        if not video:
            raise NotFoundError(f"Video '{video_id}' not found.")

        return self.analytics_repo.get_analytics_by_video(
            video_id=video_id,
            page=page,
            limit=limit,
        )
