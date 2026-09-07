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
    def create_processing_job(self, video_id: uuid.UUID) -> ProcessingJob:
        """
        Create a new QUEUED processing job for the given video.

        Rules:
        - The video must exist.
        - A video cannot have two simultaneous active (QUEUED or PROCESSING) jobs.

        Args:
            video_id: UUID of the video to process.

        Returns:
            The newly created :class:`ProcessingJob`.

        Raises:
            NotFoundError:           If the video does not exist.
            ProcessingConflictError: If an active job already exists.
        """
        # Validate video exists
        video = self._video_repo.get_video_by_id(video_id)
        if not video:
            raise NotFoundError(f"Video with id '{video_id}' not found.")

        # Prevent duplicate active jobs
        existing = self._repo.get_active_job_for_video(video_id)
        if existing:
            raise ProcessingConflictError(
                f"An active processing job already exists for video '{video_id}'. "
                f"Job id: {existing.id} | Status: {existing.status}"
            )

        job = self._repo.create_job(video_id=video_id)
        logger.info(
            "Processing job created: job_id=%s video_id=%s", job.id, video_id
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
            progress_percentage=latest_job.progress_percentage if latest_job else None,
            frames_processed=latest_job.frames_processed if latest_job else 0,
            total_frames=latest_job.total_frames if latest_job else (video.frame_count or 0),
            events_detected=event_total,
            error_message=latest_job.error_message if latest_job else None,
        )
