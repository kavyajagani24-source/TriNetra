"""
UrbanEye AI — UUID Generation Helpers
"""

import uuid


def generate_uuid() -> uuid.UUID:
    """Return a new random UUID4."""
    return uuid.uuid4()


def generate_uuid_str() -> str:
    """Return a new random UUID4 as a lowercase hex string."""
    return str(uuid.uuid4())
