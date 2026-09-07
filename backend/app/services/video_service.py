"""
UrbanEye AI — Video Service

Orchestrates the full video lifecycle:
    upload → validate → save → extract metadata → store in DB → manage

Uses OpenCV exclusively for metadata extraction in Phase 1.
No AI detection is performed here.
"""

import uuid
from pathlib import Path
from typing import Optional

import cv2
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.constants import ProcessingStatus, VideoStatus
from app.core.logging import get_logger
from app.models.video import Video
from app.repositories.processing_repository import ProcessingRepository
from app.repositories.video_repository import VideoRepository
from app.services.exceptions import (
    ConflictError,
    NotFoundError,
    StorageError,
    ValidationError,
)
from app.services.storage_service import StorageService
from app.utils.validators import (
    validate_file_size,
    validate_gps_coordinates,
    validate_video_extension,
)

logger = get_logger(__name__)


class VideoMetadata:
    """Container for OpenCV-extracted video properties."""

    __slots__ = ("fps", "frame_count", "width", "height", "duration")

    def __init__(
        self,
        fps: float,
        frame_count: int,
        width: int,
        height: int,
    ) -> None:
        self.fps = fps
        self.frame_count = frame_count
        self.width = width
        self.height = height
        self.duration = frame_count / fps if fps > 0 else 0.0


def _extract_video_metadata(file_path: Path) -> VideoMetadata:
    """
    Open a video file with OpenCV and extract technical metadata.

    Args:
        file_path: Absolute path to the saved video file.

    Returns:
        A :class:`VideoMetadata` instance.

    Raises:
        ValidationError: If OpenCV cannot open or read the video.
    """
    cap = cv2.VideoCapture(str(file_path))
    try:
        if not cap.isOpened():
            raise ValidationError(
                f"Unable to open video file '{file_path.name}'. "
                "The file may be corrupt or in an unsupported format."
            )

        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        if fps <= 0:
            raise ValidationError(
                f"Video '{file_path.name}' reported FPS of {fps}. "
                "The file may be corrupt."
            )

        logger.debug(
            "Metadata extracted — fps=%.2f frames=%d %dx%d",
            fps, frame_count, width, height,
        )
        return VideoMetadata(fps=fps, frame_count=frame_count, width=width, height=height)
    finally:
        cap.release()


class VideoService:
    """Service layer for video lifecycle management."""

    def __init__(self, db: Session) -> None:
        self._repo = VideoRepository(db)
        self._storage = StorageService()

    # ── Upload ────────────────────────────────────────────────────────────────
    async def upload_video(
        self,
        upload_file: UploadFile,
        bus_id: Optional[uuid.UUID] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
    ) -> Video:
        """
        Full upload pipeline:
            1. Validate extension
            2. Read content & validate size
            3. Validate GPS coordinates
            4. Save to storage
            5. Extract metadata via OpenCV
            6. Create database record
            7. Clean up file on any error

        Returns:
            The persisted Video ORM instance.

        Raises:
            ValidationError: On extension, size, or corrupt video.
            StorageError:    If file persistence fails.
        """
        original_filename = upload_file.filename or "unknown.mp4"

        # 1. Extension check
        try:
            file_ext = validate_video_extension(original_filename)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

        # 2. Read content and check size
        await upload_file.seek(0)
        content = await upload_file.read()
        try:
            validate_file_size(len(content))
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

        # 3. GPS validation
        try:
            validate_gps_coordinates(latitude, longitude)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

        # 4. Save file
        safe_filename = self._storage.generate_unique_filename(original_filename)
        file_path = self._storage._settings.upload_path_obj / safe_filename

        try:
            file_path.write_bytes(content)
            file_size = len(content)
            logger.info(
                "Video saved: %s (%d bytes)", file_path, file_size
            )
        except OSError as exc:
            raise StorageError(
                f"Failed to save video file: {exc}", detail=str(exc)
            ) from exc

        # 5. Extract metadata
        try:
            meta = _extract_video_metadata(file_path)
        except ValidationError:
            # Clean up the saved file before propagating the error
            self._storage.delete_file(file_path)
            raise

        # 6. Create DB record
        video = self._repo.create_video(
            filename=safe_filename,
            original_filename=original_filename,
            file_path=str(file_path),
            file_size=file_size,
            format=file_ext,
            fps=meta.fps,
            frame_count=meta.frame_count,
            duration=meta.duration,
            width=meta.width,
            height=meta.height,
            status=VideoStatus.UPLOADED.value,
            bus_id=bus_id,
            latitude=latitude,
            longitude=longitude,
        )
        logger.info(
            "Video record created: id=%s original='%s' duration=%.1fs",
            video.id, original_filename, meta.duration,
        )
        return video

    # ── Read ──────────────────────────────────────────────────────────────────
    def get_video(self, video_id: uuid.UUID) -> Video:
        """
        Retrieve a video by ID.

        Raises:
            NotFoundError: If no video with the given ID exists.
        """
        video = self._repo.get_video_by_id(video_id)
        if not video:
            raise NotFoundError(f"Video with id '{video_id}' not found.")
        return video

    def list_videos(
        self,
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None,
        bus_id: Optional[uuid.UUID] = None,
    ) -> tuple[list[Video], int]:
        """Return a paginated list of videos with optional filters."""
        if status:
            valid = {s.value for s in VideoStatus}
            if status not in valid:
                raise ValidationError(
                    f"Invalid status '{status}'. Allowed: {sorted(valid)}"
                )
        return self._repo.get_all_videos(
            page=page, limit=limit, status=status, bus_id=bus_id
        )

    # ── Delete ────────────────────────────────────────────────────────────────
    def delete_video(self, video_id: uuid.UUID) -> None:
        """
        Delete a video and its associated file.

        Safety rules:
        - Prevents deletion if a PROCESSING job is active.
        - Attempts file deletion first; rolls back if it fails.

        Raises:
            NotFoundError:  If the video does not exist.
            ConflictError:  If the video is currently being processed.
            StorageError:   If file deletion fails.
        """
        video = self.get_video(video_id)

        # Check for active processing job
        proc_repo = ProcessingRepository(self._repo._db)
        active_job = proc_repo.get_active_job_for_video(video_id)
        if active_job and active_job.status == ProcessingStatus.PROCESSING.value:
            raise ConflictError(
                f"Cannot delete video '{video_id}' — a processing job is currently active."
            )

        file_path = video.file_path
        original_name = video.original_filename

        # Delete from filesystem first
        self._storage.delete_file(file_path)

        # Delete DB record
        self._repo.delete_video(video)
        logger.info(
            "Video deleted: id=%s original='%s'", video_id, original_name
        )
