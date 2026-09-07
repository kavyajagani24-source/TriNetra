"""
UrbanEye AI — Application Constants

Centralised enums and string constants to avoid scattering raw strings
throughout the codebase.  All status values live here.
"""

from enum import Enum


class BusStatus(str, Enum):
    """Operational status of a registered bus."""
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    OFFLINE = "OFFLINE"


class VideoStatus(str, Enum):
    """Lifecycle status of an uploaded video file."""
    UPLOADED = "UPLOADED"
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ProcessingStatus(str, Enum):
    """Status of an AI processing job (Phase 2 will execute these jobs)."""
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


# Statuses that indicate an active (non-terminal) processing job
ACTIVE_PROCESSING_STATUSES: frozenset[ProcessingStatus] = frozenset(
    {ProcessingStatus.QUEUED, ProcessingStatus.PROCESSING}
)

# Allowed video file extensions (also enforced from config)
ALLOWED_VIDEO_EXTENSIONS: tuple[str, ...] = (".mp4", ".avi", ".mov", ".mkv")

# Default pagination limits
DEFAULT_PAGE: int = 1
DEFAULT_LIMIT: int = 20
MAX_LIMIT: int = 100
