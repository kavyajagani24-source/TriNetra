"""
TriNetra — Module 3 Safety AI Configuration & Camera Profiles

Module 3 is authoritative for Pedestrian / VRU Safety Intelligence.
Zones are camera-specific and must NEVER be assumed or applied globally.
This module provides:
  - Resolution of SIH2026--Module3 repository paths
  - CameraSafetyProfile data structures (defining camera-specific zones)
  - Helper converters to format zones for Module 3's ZoneManager
"""

from __future__ import annotations

import logging
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def _resolve_module3_root() -> Path:
    """
    Resolve SIH2026--Module3 repository root directory.
    Uses settings.MODULE3_ROOT if valid, otherwise auto-discovers sibling directory.
    """
    try:
        from app.core.config import get_settings
        settings = get_settings()
        if settings.MODULE3_ROOT:
            p = Path(settings.MODULE3_ROOT).resolve()
            if p.exists():
                return p
            logger.warning(
                "MODULE3_ROOT=%s does not exist — falling back to auto-discovery.",
                settings.MODULE3_ROOT,
            )
    except Exception:
        pass

    # Auto-discover: this file is at:
    # urbaneye-ai/backend/app/ai/integrations/safety_module3/config.py
    # parents[5] is the parent folder containing urbaneye-ai, SIH2026--Module3, The-Sixth-Sense-AI
    parent = Path(__file__).resolve().parents[5]
    for candidate_name in ["SIH2026--Module3", "SIH2026-Module3", "safety_module3"]:
        candidate = parent / candidate_name
        if candidate.exists():
            return candidate

    raise RuntimeError(
        f"Cannot locate SIH2026--Module3 repository. "
        f"Set MODULE3_ROOT in .env or place repository at {parent / 'SIH2026--Module3'}"
    )


def _ensure_module3_on_path() -> Path:
    """Add Module 3 root to sys.path (idempotent). Returns root path."""
    root = _resolve_module3_root()
    root_str = str(root)
    if root_str not in sys.path:
        sys.path.insert(0, root_str)
        logger.info("SafetyModule3: added to sys.path: %s", root_str)
    return root


# ---------------------------------------------------------------------------
# Camera Safety Profiles & Zones
# ---------------------------------------------------------------------------

@dataclass
class CameraZone:
    """
    Individual spatial zone defined in pixel coordinates for a specific camera view.
    Supported zone_types: "road", "crossing", "school_zone", "sidewalk", "exclusion".
    """
    zone_id: str
    zone_type: str
    name: str
    polygon: List[List[float]]       # [[x1, y1], [x2, y2], ...]
    lat: Optional[float] = None
    lon: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "zone_id": self.zone_id,
            "zone_type": self.zone_type,
            "name": self.name,
            "polygon": self.polygon,
            "lat": self.lat,
            "lon": self.lon,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CameraZone":
        return cls(
            zone_id=data.get("zone_id", ""),
            zone_type=data.get("zone_type", "road"),
            name=data.get("name", ""),
            polygon=data.get("polygon", []),
            lat=data.get("lat"),
            lon=data.get("lon"),
            metadata=data.get("metadata", {}),
        )


@dataclass
class CameraSafetyProfile:
    """
    Spatial calibration profile for an individual camera stream.
    Contains resolution and calibrated polygon zones for VRU detection.
    """
    camera_id: str
    resolution_width: int = 1920
    resolution_height: int = 1080
    zones: List[CameraZone] = field(default_factory=list)
    enabled: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def to_module3_zone_dicts(self) -> List[Dict[str, Any]]:
        """Converts profile zones into the dictionary list expected by Module 3 ZoneManager."""
        return [zone.to_dict() for zone in self.zones]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "camera_id": self.camera_id,
            "resolution_width": self.resolution_width,
            "resolution_height": self.resolution_height,
            "zones": [z.to_dict() for z in self.zones],
            "enabled": self.enabled,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CameraSafetyProfile":
        raw_zones = data.get("zones", [])
        zones = [CameraZone.from_dict(z) if isinstance(z, dict) else z for z in raw_zones]
        return cls(
            camera_id=data.get("camera_id", ""),
            resolution_width=int(data.get("resolution_width", 1920)),
            resolution_height=int(data.get("resolution_height", 1080)),
            zones=zones,
            enabled=bool(data.get("enabled", True)),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else None,
        )

    def scale_zones(self, target_width: int, target_height: int) -> "CameraSafetyProfile":
        """
        Scale zone polygons if the processed video resolution differs from calibration.
        """
        if self.resolution_width == target_width and self.resolution_height == target_height:
            return self

        sx = target_width / max(1, self.resolution_width)
        sy = target_height / max(1, self.resolution_height)

        scaled_zones: List[CameraZone] = []
        for zone in self.zones:
            scaled_poly = [[p[0] * sx, p[1] * sy] for p in zone.polygon]
            scaled_zones.append(
                CameraZone(
                    zone_id=zone.zone_id,
                    zone_type=zone.zone_type,
                    name=zone.name,
                    polygon=scaled_poly,
                    lat=zone.lat,
                    lon=zone.lon,
                    metadata=zone.metadata,
                )
            )

        return CameraSafetyProfile(
            camera_id=self.camera_id,
            resolution_width=target_width,
            resolution_height=target_height,
            zones=scaled_zones,
            enabled=self.enabled,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )
