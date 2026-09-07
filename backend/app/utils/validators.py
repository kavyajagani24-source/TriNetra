"""
UrbanEye AI — Input Validators

Standalone validation functions used by services and API layers.
All validators raise ValueError with descriptive messages on failure.
"""

from pathlib import Path
from typing import Optional

from app.core.config import get_settings


def validate_video_extension(filename: str) -> str:
    """
    Validate that the uploaded filename has an allowed video extension.

    Args:
        filename: Original filename from the client upload.

    Returns:
        The lowercased file extension (e.g. '.mp4').

    Raises:
        ValueError: If the extension is not in the allowed list.
    """
    settings = get_settings()
    suffix = Path(filename).suffix.lower()
    if suffix not in settings.allowed_extensions_list:
        allowed = ", ".join(settings.allowed_extensions_list)
        raise ValueError(
            f"File extension '{suffix}' is not allowed. "
            f"Accepted extensions: {allowed}"
        )
    return suffix


def validate_file_size(size_bytes: int) -> None:
    """
    Validate that the file size does not exceed MAX_UPLOAD_SIZE_MB.

    Args:
        size_bytes: File size in bytes.

    Raises:
        ValueError: If the file is too large.
    """
    settings = get_settings()
    if size_bytes > settings.max_upload_size_bytes:
        raise ValueError(
            f"File size {size_bytes / (1024 ** 2):.1f} MB exceeds the "
            f"maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB} MB."
        )


def validate_gps_coordinates(
    latitude: Optional[float],
    longitude: Optional[float],
) -> None:
    """
    Validate GPS coordinates if provided.

    Args:
        latitude:  Latitude value (-90 to 90) or None.
        longitude: Longitude value (-180 to 180) or None.

    Raises:
        ValueError: If the coordinates are out of valid range.
    """
    if latitude is not None and not (-90.0 <= latitude <= 90.0):
        raise ValueError(
            f"Latitude {latitude} is out of valid range (-90 to 90)."
        )
    if longitude is not None and not (-180.0 <= longitude <= 180.0):
        raise ValueError(
            f"Longitude {longitude} is out of valid range (-180 to 180)."
        )


def sanitise_filename(filename: str) -> str:
    """
    Strip directory components from an uploaded filename to prevent
    path traversal attacks.

    Args:
        filename: Raw filename from the client.

    Returns:
        Safe basename only.
    """
    return Path(filename).name
