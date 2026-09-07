"""
UrbanEye AI — Processing Job Repository

Handles all database operations for ProcessingJob entities.
"""

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import ACTIVE_PROCESSING_STATUSES, ProcessingStatus
from app.models.processing_job import ProcessingJob
from app.utils.timestamps import utcnow


class ProcessingRepository:
    """Data access layer for ProcessingJob entities."""

    def __init__(self, db: Session) -> None:
        self._db = db

    # ── Create ────────────────────────────────────────────────────────────────
    def create_job(self, video_id: uuid.UUID) -> ProcessingJob:
        """Create a new QUEUED processing job for the given video."""
        job = ProcessingJob(
            video_id=video_id,
            status=ProcessingStatus.QUEUED.value,
            progress_percentage=0.0,
            frames_processed=0,
            events_detected=0,
        )
        self._db.add(job)
        self._db.commit()
        self._db.refresh(job)
        return job

    # ── Read ──────────────────────────────────────────────────────────────────
    def get_job_by_id(self, job_id: uuid.UUID) -> Optional[ProcessingJob]:
        """Return a ProcessingJob by its UUID, or None."""
        stmt = select(ProcessingJob).where(ProcessingJob.id == job_id)
        return self._db.execute(stmt).scalar_one_or_none()

    def get_job_by_video_id(
        self, video_id: uuid.UUID
    ) -> Optional[ProcessingJob]:
        """Return the most recent ProcessingJob for a video, or None."""
        stmt = (
            select(ProcessingJob)
            .where(ProcessingJob.video_id == video_id)
            .order_by(ProcessingJob.created_at.desc())
        )
        return self._db.execute(stmt).scalars().first()

    def get_active_job_for_video(
        self, video_id: uuid.UUID
    ) -> Optional[ProcessingJob]:
        """
        Return an active (QUEUED or PROCESSING) job for the given video,
        or None if no such job exists.
        """
        active_values = [s.value for s in ACTIVE_PROCESSING_STATUSES]
        stmt = select(ProcessingJob).where(
            ProcessingJob.video_id == video_id,
            ProcessingJob.status.in_(active_values),
        )
        return self._db.execute(stmt).scalars().first()

    # ── Update ────────────────────────────────────────────────────────────────
    def update_job_status(
        self, job: ProcessingJob, status: ProcessingStatus
    ) -> ProcessingJob:
        """Set the job status and persist."""
        job.status = status.value
        self._db.commit()
        self._db.refresh(job)
        return job

    def update_job_progress(
        self,
        job: ProcessingJob,
        progress_percentage: float,
        frames_processed: int,
    ) -> ProcessingJob:
        """Update progress fields on a job."""
        job.progress_percentage = progress_percentage
        job.frames_processed = frames_processed
        self._db.commit()
        self._db.refresh(job)
        return job

    def mark_job_completed(
        self, job: ProcessingJob, events_detected: int = 0
    ) -> ProcessingJob:
        """Mark a job as COMPLETED with final statistics."""
        job.status = ProcessingStatus.COMPLETED.value
        job.progress_percentage = 100.0
        job.events_detected = events_detected
        job.completed_at = utcnow()
        self._db.commit()
        self._db.refresh(job)
        return job

    def mark_job_failed(
        self, job: ProcessingJob, error_message: str
    ) -> ProcessingJob:
        """Mark a job as FAILED with an error message."""
        job.status = ProcessingStatus.FAILED.value
        job.error_message = error_message
        job.completed_at = utcnow()
        self._db.commit()
        self._db.refresh(job)
        return job
