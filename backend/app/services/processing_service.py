"""
UrbanEye AI — Processing Service

Business logic for managing AI processing jobs.
Phase 1: Creates QUEUED jobs only.
Phase 2: An AI worker will pick up QUEUED jobs and advance their status.
"""

import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.processing_job import ProcessingJob
from app.repositories.processing_repository import ProcessingRepository
from app.repositories.video_repository import VideoRepository
from app.repositories.event_repository import EventRepository
from app.services.exceptions import NotFoundError, ProcessingConflictError
from app.schemas.processing import VideoProcessingStatus

logger = get_logger(__name__)


class ProcessingService:
    """Service layer for processing job management."""

    def __init__(self, db: Session) -> None:
        self._repo = ProcessingRepository(db)
        self._video_repo = VideoRepository(db)
        self._event_repo = EventRepository(db)

    # ── Create ────────────────────────────────────────────────────────────────
    def create_processing_job(
        self,
        video_id: uuid.UUID,
        mode: str = "multi_engine",
        force_reprocess: bool = False,
    ) -> ProcessingJob:
        """
        Create a new QUEUED processing job for the given video.

        Rules:
        - The video must exist.
        - A video cannot have two simultaneous active (QUEUED or PROCESSING) jobs unless force_reprocess=True.

        Args:
            video_id: UUID of the video to process.
            mode: AI execution mode ("multi_engine", "road", "traffic", "safety", "incident").
            force_reprocess: If True, cancel/supersede any active job and re-queue.

        Returns:
            The newly created :class:`ProcessingJob`.

        Raises:
            NotFoundError:           If the video does not exist.
            ProcessingConflictError: If an active job already exists and force_reprocess is False.
        """
        # Validate video exists
        video = self._video_repo.get_video_by_id(video_id)
        if not video:
            raise NotFoundError(f"Video with id '{video_id}' not found.")

        # Check existing active jobs
        existing = self._repo.get_active_job_for_video(video_id)
        if existing:
            if force_reprocess:
                logger.info(
                    "force_reprocess requested — superseding active job %s for video %s",
                    existing.id,
                    video_id,
                )
                self._repo.mark_job_failed(
                    existing, "Job cancelled: superseded by new user processing request."
                )
            else:
                raise ProcessingConflictError(
                    f"An active processing job already exists for video '{video_id}'. "
                    f"Job id: {existing.id} | Status: {existing.status}"
                )

        # Build initial per-engine status blueprint
        all_engines = ["road", "traffic", "safety", "incident"]
        initial_statuses = {}
        for eng in all_engines:
            if mode == "multi_engine" or mode == eng:
                initial_statuses[eng] = {"status": "queued"}
            else:
                initial_statuses[eng] = {"status": "skipped", "reason": f"single_mode_{mode}"}

        job = self._repo.create_job(
            video_id=video_id,
            mode=mode,
            engine_statuses=initial_statuses,
        )
        logger.info(
            "Processing job created: job_id=%s video_id=%s mode=%s", job.id, video_id, mode
        )
        return job

    # ── Read ──────────────────────────────────────────────────────────────────
    def get_job(self, job_id: uuid.UUID) -> ProcessingJob:
        """
        Retrieve a processing job by ID.

        Raises:
            NotFoundError: If no job with the given ID exists.
        """
        job = self._repo.get_job_by_id(job_id)
        if not job:
            raise NotFoundError(f"Processing job with id '{job_id}' not found.")
        return job

    def get_video_processing_status(
        self, video_id: uuid.UUID
    ) -> VideoProcessingStatus:
        """
        Return a combined video + latest processing job status.

        Args:
            video_id: UUID of the video.

        Returns:
            :class:`VideoProcessingStatus` schema populated with the latest job info.

        Raises:
            NotFoundError: If the video does not exist.
        """
        video = self._video_repo.get_video_by_id(video_id)
        if not video:
            raise NotFoundError(f"Video with id '{video_id}' not found.")

        latest_job = self._repo.get_job_by_video_id(video_id)

        _, event_total = self._event_repo.get_events_for_video(video_id=video_id, limit=1)

        return VideoProcessingStatus(
            video_id=video_id,
            video_status=video.status,
            job_id=latest_job.id if latest_job else None,
            job_status=latest_job.status if latest_job else None,
            mode=latest_job.mode if latest_job else "multi_engine",
            progress_percentage=latest_job.progress_percentage if latest_job else None,
            frames_processed=latest_job.frames_processed if latest_job else 0,
            total_frames=latest_job.total_frames if latest_job else (video.frame_count or 0),
            events_detected=event_total,
            error_message=latest_job.error_message if latest_job else None,
            engine_statuses=latest_job.engine_statuses if latest_job else None,
            annotated_road_path=(
                f"/{latest_job.annotated_road_path.replace('\\', '/').lstrip('/')}"
                if latest_job and latest_job.annotated_road_path else None
            ),
            annotated_traffic_path=(
                f"/{latest_job.annotated_traffic_path.replace('\\', '/').lstrip('/')}"
                if latest_job and latest_job.annotated_traffic_path else None
            ),
            annotated_safety_path=(
                f"/{latest_job.annotated_safety_path.replace('\\', '/').lstrip('/')}"
                if latest_job and latest_job.annotated_safety_path else None
            ),
            annotated_incident_path=(
                f"/{getattr(latest_job, 'annotated_incident_path').replace('\\', '/').lstrip('/')}"
                if latest_job and getattr(latest_job, "annotated_incident_path", None) else None
            ),
        )
