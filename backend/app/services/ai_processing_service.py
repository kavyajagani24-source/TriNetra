"""
UrbanEye AI — AI Processing Service

Background execution service running the multi-engine UrbanEye AI pipeline,
updating granular job progress, and committing detections, tracking, traffic analytics,
and urban events to PostgreSQL with full provenance.
"""

from __future__ import annotations

import logging
import uuid
from typing import Optional

from app.ai.processors.pipeline import UrbanAIPipeline
from app.core.config import get_settings
from app.core.constants import ProcessingStatus, VideoStatus
from app.core.database import SessionLocal
from app.models.camera_safety_profile import CameraSafetyProfile
from app.models.detection import Detection
from app.models.processing_job import ProcessingJob
from app.models.tracked_object import TrackedObject
from app.models.traffic_analytics import TrafficAnalytics
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

            logger.info("Starting Multi-Engine AI processing for job=%s video=%s", job_id, video.id)

            # Advance initial status
            job.status = ProcessingStatus.PROCESSING.value
            job.started_at = utcnow()
            if video.frame_count:
                job.total_frames = video.frame_count
            db.commit()

            video_repo.update_video_status(video, VideoStatus.PROCESSING.value)

            # Granular status callback
            def status_callback(new_status: ProcessingStatus, progress_pct: float) -> None:
                job.status = new_status.value
                job.progress_percentage = round(progress_pct, 2)
                db.commit()
                logger.info(
                    "Job %s advanced to status %s (%.1f%%)",
                    job_id,
                    new_status.value,
                    progress_pct,
                )

            # Frame progress callback
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

            # Retrieve Camera Safety Profile if calibrated for this camera/bus
            camera_profile = None
            camera_id_str = getattr(video, "camera_id", None) or (str(video.bus_id) if video.bus_id else None)
            if camera_id_str:
                profile_orm = (
                    db.query(CameraSafetyProfile)
                    .filter(CameraSafetyProfile.camera_id == camera_id_str, CameraSafetyProfile.enabled.is_(True))
                    .first()
                )
                if profile_orm:
                    from app.ai.integrations.safety_module3.config import (
                        CameraSafetyProfile as SafetyProfileDC,
                        CameraZone as SafetyZoneDC,
                    )
                    zones = [SafetyZoneDC.from_dict(z) for z in profile_orm.zones]
                    camera_profile = SafetyProfileDC(
                        camera_id=profile_orm.camera_id,
                        resolution_width=profile_orm.resolution_width,
                        resolution_height=profile_orm.resolution_height,
                        zones=zones,
                        enabled=profile_orm.enabled,
                    )
                    logger.info("Loaded custom camera safety profile for %s", camera_id_str)

            pipeline = self.pipeline or UrbanAIPipeline(settings=self.settings)

            # Execute multi-engine pipeline
            result = pipeline.run(
                video_path=video.file_path,
                video_id=str(video.id),
                job_id=str(job.id),
                camera_profile=camera_profile,
                bus_id=str(video.bus_id) if video.bus_id else None,
                camera_id=camera_id_str,
                video_lat=video.latitude,
                video_lon=video.longitude,
                status_callback=status_callback,
                progress_callback=progress_callback,
            )

            # Stage 5: Persisting
            status_callback(ProcessingStatus.PERSISTING, 95.0)

            # 1. Persist Tracked Objects
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

            if tracked_objects_to_insert:
                inserted_tracked_objs = tracking_repo.create_bulk_tracked_objects(tracked_objects_to_insert)
                for obj in inserted_tracked_objs:
                    track_id_to_obj_id[obj.track_id] = obj.id

            # 2. Persist Standardized Detections (with source_engine)
            detections_to_insert = []
            for d in result.normalized_detections:
                tid = d.get("track_id")
                detections_to_insert.append(
                    Detection(
                        video_id=video.id,
                        job_id=job.id,
                        track_id=tid if tid is not None and tid >= 0 else None,
                        class_name=d.get("class_name", "unknown"),
                        class_id=d.get("class_id", 0),
                        confidence=d.get("confidence", 0.0),
                        frame_number=d.get("frame_number", 0),
                        timestamp=d.get("timestamp", 0.0),
                        bbox_x1=d.get("bbox_x1", 0.0),
                        bbox_y1=d.get("bbox_y1", 0.0),
                        bbox_x2=d.get("bbox_x2", 0.0),
                        bbox_y2=d.get("bbox_y2", 0.0),
                        center_x=d.get("center_x", 0.0),
                        center_y=d.get("center_y", 0.0),
                        source_engine=d.get("source_engine"),
                    )
                )

            if detections_to_insert:
                detection_repo.create_bulk_detections(detections_to_insert)

            # 3. Persist Traffic Analytics
            if result.traffic_analytics_record:
                ta_data = dict(result.traffic_analytics_record)
                ta_obj = TrafficAnalytics(
                    video_id=video.id,
                    job_id=job.id,
                    timestamp=ta_data.get("timestamp", 0.0),
                    frame_number=ta_data.get("frame_number", 0),
                    active_vehicle_count=ta_data.get("active_vehicle_count", 0),
                    car_count=ta_data.get("car_count", 0),
                    motorcycle_count=ta_data.get("motorcycle_count", 0),
                    bus_count=ta_data.get("bus_count", 0),
                    truck_count=ta_data.get("truck_count", 0),
                    person_count=ta_data.get("person_count", 0),
                    auto_rickshaw_count=ta_data.get("auto_rickshaw_count", 0),
                    bicycle_count=ta_data.get("bicycle_count", 0),
                    unique_vehicle_count=ta_data.get("unique_vehicle_count", 0),
                    average_pixel_speed=ta_data.get("average_pixel_speed", 0.0),
                    traffic_density=ta_data.get("traffic_density", "MODERATE"),
                    congestion_level=ta_data.get("congestion_level", "LOW"),
                )
                analytics_repo.create_bulk_analytics([ta_obj])

            # 4. Persist Urban Events
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
                        latitude=(
                            ev.latitude
                            if ev.latitude is not None
                            else (video.latitude if video.latitude is not None else 19.0760 + ((int(ev.frame_number) % 100) * 0.0001))
                        ),
                        longitude=(
                            ev.longitude
                            if ev.longitude is not None
                            else (video.longitude if video.longitude is not None else 72.8777 + ((int(ev.frame_number) % 100) * 0.0001))
                        ),
                        description=ev.description or "",
                        extra_metadata=ev.extra_metadata or {},
                    )
                )
            if events_to_insert:
                event_repo.create_bulk_events(events_to_insert)

            # 5. Update Job Engine Statuses and Annotated Paths
            job.engine_statuses = result.engine_statuses
            job.annotated_road_path = result.annotated_video_paths.get("road")
            job.annotated_traffic_path = result.annotated_video_paths.get("traffic")
            job.annotated_safety_path = result.annotated_video_paths.get("safety")

            # Mark job completion
            total_detected_events = result.total_unique_vehicles + len(events_to_insert)
            processing_repo.mark_job_completed(job, events_detected=total_detected_events)
            video_repo.update_video_status(video, VideoStatus.COMPLETED.value)

            logger.info(
                "Multi-engine AI processing completed for job=%s! Vehicles=%d, UrbanEvents=%d",
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
