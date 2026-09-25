"""
UrbanEye AI — CameraSafetyProfile ORM Model

Stores camera-specific spatial calibrations, resolution, and zone polygons
for pedestrian and VRU safety intelligence (Module 3).
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import Boolean, Integer, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.models.base import Base, TimestampMixin


class CameraSafetyProfile(TimestampMixin, Base):
    """
    ORM model for the ``camera_safety_profiles`` table.
    """

    __tablename__ = "camera_safety_profiles"

    camera_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    resolution_width: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1920,
        server_default="1920",
    )

    resolution_height: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1080,
        server_default="1080",
    )

    # Dialect-agnostic JSON (JSONB on PostgreSQL, JSON on SQLite)
    zones: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=False,
        default=list,
    )

    enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    extra_metadata: Mapped[Dict[str, Any]] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=False,
        default=dict,
    )

    def __repr__(self) -> str:
        return (
            f"<CameraSafetyProfile camera_id={self.camera_id!r} "
            f"zones={len(self.zones)} enabled={self.enabled}>"
        )
