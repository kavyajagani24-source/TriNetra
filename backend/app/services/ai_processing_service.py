"""
UrbanEye AI — AI Processing Service

Background execution service running the UrbanEye AI computer vision pipeline,
updating job progress, and committing detections, tracking, and analytics to PostgreSQL.
"""

from __future__ import annotations

import logging
import uuid
from typing import Optional

from app.ai.processors.pipeline import UrbanAIPipeline
from app.core.config import get_settings
from app.core.constants import ProcessingStatus, VideoStatus
from app.core.database import SessionLocal
from app.models.detection import Detection
from app.models.tracked_object import TrackedObject
from app.models.traffic_analytics import TrafficAnalytics
from app.models.trajectory import TrajectoryPoint
from app.models.urban_event import UrbanEvent
from app.repositories.analytics_repository import AnalyticsRepository
from app.repositories.detection_repository import DetectionRepository
from app.repositories.event_repository import EventRepository
from app.repositories.processing_repository import ProcessingRepository
from app.repositories.tracking_repository import TrackingRepository
from app.repositories.video_repository import VideoRepository
from app.utils.timestamps import utcnow

logger = logging.getLogger(__name__)


class AIProcessingService:
    """
    Executes an AI processing job asynchronously in a dedicated database session.
    """

    def __init__(self, pipeline: Optional[UrbanAIPipeline] = None):
        self.settings = get_settings()
        self.pipeline = pipeline

    def run_processing_job(self, job_id: uuid.UUID) -> None:
        """
        Main worker entrypoint for background processing tasks.
        """
        db = SessionLocal()
        processing_repo = ProcessingRepository(db)
        video_repo = VideoRepository(db)
        detection_repo = DetectionRepository(db)
        tracking_repo = TrackingRepository(db)
        analytics_repo = AnalyticsRepository(db)
        event_repo = EventRepository(db)

        try:
            job = processing_repo.get_job_by_id(job_id)
            if not job:
                logger.error("Processing job %s not found in DB.", job_id)
                return

            video = video_repo.get_video_by_id(job.video_id)
            if not video:
                logger.error("Video %s for job %s not found.", job.video_id, job_id)
                processing_repo.mark_job_failed(job, "Associated video record not found.")
                return

            logger.info("Starting AI processing for job=%s video=%s", job_id, video.id)

            # Advance statuses
            job.status = ProcessingStatus.PROCESSING.value
            job.started_at = utcnow()
            if video.frame_count:
                job.total_frames = video.frame_count
            db.commit()

            video_repo.update_video_status(video, VideoStatus.PROCESSING.value)

            # Define progress callback with throttling
            last_reported_frame = 0

            def progress_callback(
                frame_num: int, total_frames: int, progress_pct: float, events_count: int
            ) -> None:
                nonlocal last_reported_frame
                if (
                    frame_num - last_reported_frame >= self.settings.PROGRESS_UPDATE_INTERVAL
                    or frame_num >= total_frames
                ):
                    last_reported_frame = frame_num
                    job.progress_percentage = round(progress_pct, 2)
                    job.frames_processed = frame_num
                    job.events_detected = events_count
                    if total_frames > 0:
                        job.total_frames = total_frames
                    db.commit()

            pipeline = self.pipeline or UrbanAIPipeline(settings=self.settings)

            # Execute pipeline
            result = pipeline.run(
                video_path=video.file_path,
                video_id=str(video.id),
                job_id=str(job.id),
                progress_callback=progress_callback,
            )

            # Persist Tracked Objects first (they have UUIDs needed by TrajectoryPoints)
            track_id_to_obj_id = {}
            tracked_objects_to_insert = []
            for tid, s in result.active_tracks_summary.items():
                t_obj = TrackedObject(
                    video_id=video.id,
                    job_id=job.id,
                    track_id=tid,
                    class_name=s["class_name"],
                    first_seen_frame=s["first_seen_frame"],
                    last_seen_frame=s["last_seen_frame"],
                    first_seen_timestamp=s["first_seen_timestamp"],
                    last_seen_timestamp=s["last_seen_timestamp"],
                    max_confidence=s["max_confidence"],
                    average_confidence=s["average_confidence"],
                    status=s["status"],
                )
                tracked_objects_to_insert.append(t_obj)

            inserted_tracked_objs = tracking_repo.create_bulk_tracked_objects(tracked_objects_to_insert)
            for obj in inserted_tracked_objs:
                track_id_to_obj_id[obj.track_id] = obj.id

            # Persist Trajectories (sampled)
            trajectory_points_to_insert = []
            for tid, obj_id in track_id_to_obj_id.items():
                pts = pipeline.trajectory_manager.get_trajectory(tid)
                for i, pt in enumerate(pts):
                    if i % self.settings.TRAJECTORY_SAVE_INTERVAL == 0 or i == len(pts) - 1:
                        trajectory_points_to_insert.append(
                            TrajectoryPoint(
                                tracked_object_id=obj_id,
                                x=pt.x,
                                y=pt.y,
                                frame_number=pt.frame_number,
                                timestamp=pt.timestamp,
                                pixel_speed=pt.pixel_speed,
                            )
                        )
            tracking_repo.create_bulk_trajectory_points(trajectory_points_to_insert)

            # Persist Detections (sampled or full)
            detections_to_insert = []
            for fr in result.frame_results:
                if (
                    self.settings.SAVE_ALL_DETECTIONS
                    or fr.frame_number % self.settings.DETECTION_SAVE_INTERVAL == 0
                ):
                    for td in fr.tracked_detections:
                        detections_to_insert.append(
                            Detection(
                                video_id=video.id,
                                job_id=job.id,
                                track_id=td.track_id if td.track_id >= 0 else None,
                                class_name=td.class_name,
                                class_id=td.class_id,
                                confidence=td.confidence,
                                frame_number=fr.frame_number,
                                timestamp=fr.timestamp,
                                bbox_x1=td.bbox.x1,
                                bbox_y1=td.bbox.y1,
                                bbox_x2=td.bbox.x2,
                                bbox_y2=td.bbox.y2,
                                center_x=td.bbox.center_x,
                                center_y=td.bbox.center_y,
                            )
                        )
            detection_repo.create_bulk_detections(detections_to_insert)

            # Persist Traffic Analytics (sampled)
            analytics_to_insert = []
            for fr in result.frame_results:
                if (
                    fr.frame_number % self.settings.ANALYTICS_INTERVAL_FRAMES == 0
                    or fr.frame_number == result.frames_processed
                ):
                    counts = fr.vehicle_counts_by_class
                    analytics_to_insert.append(
                        TrafficAnalytics(
                            video_id=video.id,
                            job_id=job.id,
                            timestamp=fr.timestamp,
                            frame_number=fr.frame_number,
                            active_vehicle_count=fr.active_vehicle_count,
                            car_count=counts.get("car", 0),
                            motorcycle_count=counts.get("motorcycle", 0),
                            bus_count=counts.get("bus", 0),
                            truck_count=counts.get("truck", 0),
                            person_count=counts.get("person", 0),
                            average_pixel_speed=fr.avg_pixel_speed,
                            traffic_density=fr.density_level.value,
                            congestion_level=fr.congestion_level.value,
                        )
                    )
            analytics_repo.create_bulk_analytics(analytics_to_insert)

            # Persist Urban Events (Phase 3)
            events_to_insert = []
            for ev in result.urban_events:
                events_to_insert.append(
                    UrbanEvent(
                        video_id=video.id,
                        job_id=job.id,
                        event_type=ev.event_type.value if hasattr(ev.event_type, "value") else str(ev.event_type),
                        category=ev.category.value if hasattr(ev.category, "value") else str(ev.category),
                        severity=ev.severity.value if hasattr(ev.severity, "value") else str(ev.severity),
                        confidence=float(ev.confidence),
                        frame_number=int(ev.frame_number),
                        timestamp=float(ev.timestamp),
                        bbox_x1=ev.bbox_x1,
                        bbox_y1=ev.bbox_y1,
                        bbox_x2=ev.bbox_x2,
                        bbox_y2=ev.bbox_y2,
                        latitude=ev.latitude or video.latitude,
                        longitude=ev.longitude or video.longitude,
                        description=ev.description or "",
                        extra_metadata=ev.extra_metadata or {},
                    )
                )
            event_repo.create_bulk_events(events_to_insert)

            # Mark completion
            total_detected_events = result.total_unique_vehicles + len(events_to_insert)
            processing_repo.mark_job_completed(
                job, events_detected=total_detected_events
            )
            video_repo.update_video_status(video, VideoStatus.COMPLETED.value)
            logger.info(
                "AI processing completed for job=%s! Vehicles=%d, UrbanEvents=%d",
                job_id,
                result.total_unique_vehicles,
                len(events_to_insert),
            )

        except Exception as exc:
            logger.exception("AI processing job %s failed: %s", job_id, exc)
            try:
                job = processing_repo.get_job_by_id(job_id)
                if job:
                    processing_repo.mark_job_failed(job, str(exc))
                video = video_repo.get_video_by_id(job.video_id) if job else None
                if video:
                    video_repo.update_video_status(video, VideoStatus.FAILED.value)
            except Exception as inner_exc:
                logger.exception("Failed to mark job as failed: %s", inner_exc)
        finally:
            db.close()
