"""
TriNetra — Sixth Sense Integration Schemas

Internal types used by the SixthSenseClient and adapters.
These are thin wrappers; the authoritative schemas live in The-Sixth-Sense-AI.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------

@dataclass
class SixthSenseRunResult:
    """
    Unified result container returned by SixthSenseClient.analyze_road()
    and SixthSenseClient.analyze_traffic().

    Fields map directly to Sixth Sense API response schemas
    (RoadAnalysisResponse / TrafficAnalysisResponse).
    """
    run_id: str
    module: str                     # "road" | "traffic"
    status: str                     # "completed" | "failed" | "no_detections"
    source: str                     # always "REAL_VIDEO_INFERENCE"
    detections: List[Dict[str, Any]] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    metrics: Dict[str, Any] = field(default_factory=dict)
    video: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None

    @property
    def success(self) -> bool:
        return self.status not in ("failed",) and self.error is None

    @property
    def annotated_video_path(self) -> Optional[str]:
        return self.video.get("annotated_url")


# ---------------------------------------------------------------------------
# Normalized detection types (internal adapter representation)
# ---------------------------------------------------------------------------

@dataclass
class NormalizedRoadDetection:
    """
    One confirmed road damage observation from Sixth Sense Road AI.
    Maps 1:1 from RoadAnalysisResponse.detections[*].
    """
    obs_id: str
    damage_class: str           # D00/D10/D20/D40/Repair/pothole/crack/road_damage
    event_type_mapped: str      # UrbanEye EventType value
    severity: str               # LOW/MEDIUM/HIGH/CRITICAL
    confidence: float
    bbox: List[float]           # [x1, y1, x2, y2]
    frame_index: int
    timestamp: float
    detection_count: int
    first_seen_frame: int
    last_seen_frame: int
    relative_area: Optional[float]
    run_id: str
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NormalizedTrafficDetection:
    """
    One unique vehicle track from Sixth Sense Traffic AI.
    Maps 1:1 from TrafficAnalysisResponse.detections[*].
    """
    track_id: str
    class_name: str
    confidence: float
    bbox: List[float]           # [x1, y1, x2, y2]
    frame_index: int
    timestamp: float
    run_id: str
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NormalizedTrafficSummary:
    """
    Aggregate traffic summary from one Sixth Sense Traffic run.
    """
    run_id: str
    unique_vehicle_count: int
    counts_by_class: Dict[str, int] = field(default_factory=dict)
    traffic_density: str = "UNKNOWN"
    congestion_level: str = "UNKNOWN"
    processing_fps: Optional[float] = None
    model_checkpoint: Optional[str] = None
    raw_summary: Dict[str, Any] = field(default_factory=dict)
    raw_metrics: Dict[str, Any] = field(default_factory=dict)
