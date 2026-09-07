"""
UrbanEye AI — Storage Service

Abstracts all file-system operations for the application.
Other services call this layer — they never touch the filesystem directly.

Storage layout:
    storage/uploads/    — raw uploaded video files
    storage/processed/  — AI output artifacts (Phase 2)
    storage/evidence/   — evidence clips/images (Phase 2)
    storage/thumbnails/ — video thumbnails (Phase 2)
"""

import shutil
import uuid
from pathlib import Path
from typing import BinaryIO, Optional

from fastapi import UploadFile

from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.exceptions import StorageError

logger = get_logger(__name__)


class StorageService:
    """Handles all file-system operations with a clean abstraction."""

    def __init__(self) -> None:
        self._settings = get_settings()

    # ── Directory Management ──────────────────────────────────────────────────
    def ensure_storage_directories(self) -> None:
        """
        Create all required storage directories if they do not exist.
        Called once at application startup.
        """
        dirs = [
            self._settings.upload_path_obj,
            self._settings.processed_path_obj,
            self._settings.evidence_path_obj,
            self._settings.thumbnail_path_obj,
        ]
        for directory in dirs:
            directory.mkdir(parents=True, exist_ok=True)
            logger.debug("Storage directory ensured: %s", directory)
        logger.info("All storage directories are ready.")

    # ── Filename Generation ───────────────────────────────────────────────────
    def generate_unique_filename(self, original_filename: str) -> str:
        """
        Create a UUID-based filename preserving the original extension.

        Original filenames are NEVER used as the storage filename to
        prevent path traversal and name collisions.

        Args:
            original_filename: Filename as sent by the client.

        Returns:
            A safe unique filename like ``<uuid>.mp4``.
        """
        ext = Path(original_filename).suffix.lower()
        return f"{uuid.uuid4()}{ext}"

    # ── File Operations ───────────────────────────────────────────────────────
    async def save_upload(
        self,
        upload_file: UploadFile,
        destination_dir: Optional[Path] = None,
    ) -> tuple[Path, int]:
        """
        Save an uploaded file to the uploads directory.

        Args:
            upload_file:    FastAPI UploadFile object.
            destination_dir: Override destination directory (defaults to uploads).

        Returns:
            Tuple of (absolute Path to saved file, file size in bytes).

        Raises:
            StorageError: If writing the file fails.
        """
        dest_dir = destination_dir or self._settings.upload_path_obj
        safe_filename = self.generate_unique_filename(
            upload_file.filename or "upload.mp4"
        )
        file_path = dest_dir / safe_filename

        try:
            await upload_file.seek(0)
            content = await upload_file.read()
            file_path.write_bytes(content)
            size = len(content)
            logger.info(
                "File saved: %s (%d bytes)", file_path, size
            )
            return file_path, size
        except OSError as exc:
            raise StorageError(
                f"Failed to save uploaded file: {exc}", detail=str(exc)
            ) from exc

    def delete_file(self, file_path: str | Path) -> None:
        """
        Delete a file from the filesystem.

        Silently ignores missing files (idempotent cleanup).

        Args:
            file_path: Path to the file to remove.

        Raises:
            StorageError: If deletion fails due to a permission error.
        """
        path = Path(file_path)
        try:
            if path.exists():
                path.unlink()
                logger.info("File deleted: %s", path)
            else:
                logger.warning("File not found for deletion: %s", path)
        except OSError as exc:
            raise StorageError(
                f"Failed to delete file '{path}': {exc}", detail=str(exc)
            ) from exc

    def file_exists(self, file_path: str | Path) -> bool:
        """Return True if the file exists at the given path."""
        return Path(file_path).exists()

    def get_file_path(self, filename: str, sub_dir: str = "uploads") -> Path:
        """
        Build the full path for a filename in the given storage sub-directory.

        Args:
            filename: The storage filename (UUID-based).
            sub_dir:  Sub-directory name ('uploads', 'processed', etc.).

        Returns:
            Full :class:`pathlib.Path` to the file.
        """
        base = Path(self._settings.STORAGE_PATH)
        return base / sub_dir / filename
