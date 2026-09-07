"""
UrbanEye AI — Timezone-Aware Timestamp Helpers
"""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Return the current UTC time as a timezone-aware datetime."""
    return datetime.now(tz=timezone.utc)


def to_utc(dt: datetime) -> datetime:
    """Convert a naive or tz-aware datetime to UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
