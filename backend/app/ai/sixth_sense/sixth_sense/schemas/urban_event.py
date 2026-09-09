"""
Urban Event Schema — The Sixth Sense
Typed dataclasses for the full observation/issue pipeline.
No detection is an event until validated; no observation is an issue until corroborated.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, List, Tuple, Dict
from enum import Enum
import uuid


class EventType(str, Enum):
    # Road damage
    POTHOLE = "POTHOLE"
    ROAD_CRACK = "ROAD_CRACK"
    ROAD_DAMAGE = "ROAD_DAMAGE"
    ROAD_REPAIR = "ROAD_REPAIR"
    WATERLOGGING = "WATERLOGGING"
    # Traffic
    VEHICLE = "VEHICLE"
    CONGESTION = "CONGESTION"
    # VRU
    PEDESTRIAN = "PEDESTRIAN"
    CYCLIST = "CYCLIST"
    # Infrastructure
    TRAFFIC_SIGN = "TRAFFIC_SIGN"
    ZEBRA_CROSSING = "ZEBRA_CROSSING"
    ROAD_DIVIDER = "ROAD_DIVIDER"
    GARBAGE = "GARBAGE"
    # Incident
    INCIDENT_CANDIDATE = "INCIDENT_CANDIDATE"
    UNKNOWN = "UNKNOWN"


class SeverityTier(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"
    UNKNOWN = "UNKNOWN"


class GPSStatus(str, Enum):
    DIRECT = "DIRECT"           # GPS sample within 1s of frame timestamp
    INTERPOLATED = "INTERPOLATED"  # Linear interpolation between samples
    UNAVAILABLE = "UNAVAILABLE"    # Outside all GPS data; no coordinates


class IssueTrend(str, Enum):
    NEW = "NEW"
    STABLE = "STABLE"
    IMPROVING = "IMPROVING"
    DETERIORATING = "DETERIORATING"
    RESOLVED = "RESOLVED"
    REOPENED = "REOPENED"


class ClassificationSource(str, Enum):
    DETECTED = "DETECTED"   # Direct model output
    INFERRED = "INFERRED"   # Heuristic / post-processing rule


@dataclass
class QualityScore:
    """Per-frame quality assessment used to penalise detection confidence."""
    blur_score: float       # Laplacian variance: higher = sharper (usable > 80)
    brightness: float       # Mean luminance 0-255 (usable: 30-230)
    glare_ratio: float      # Fraction of pixels >250 (usable < 0.15)
    conf_multiplier: float  # Applied multiplicatively to raw detection confidence
    is_usable: bool         # False if frame is too degraded to trust


@dataclass
class GPSPoint:
    lat: float
    lon: float
    timestamp: float        # Unix timestamp of GPS fix
    uncertainty_m: float    # Horizontal uncertainty estimate (m)
    heading: Optional[float]  # Degrees (0=N), None if unavailable
    status: GPSStatus = GPSStatus.UNAVAILABLE

    def to_dict(self) -> Dict:
        return {
            "lat": self.lat,
            "lon": self.lon,
            "timestamp": self.timestamp,
            "uncertainty_m": self.uncertainty_m,
            "heading": self.heading,
            "status": self.status.value,
        }


@dataclass
class Detection:
    """
    Raw output of a single model inference on a single frame.
    NOT an event — must pass temporal validation to become an Observation.
    """
    det_id: str
    frame_idx: int
    timestamp: float                          # Video timestamp (seconds from start)
    event_type: EventType
    class_name: str
    classification_source: ClassificationSource
    raw_confidence: float                     # Direct model output [0,1]
    confidence: float                         # After quality-gate multiplier
    bbox: Tuple[int, int, int, int]           # x1, y1, x2, y2 pixels
    bbox_area_px: int
    relative_area: float                      # bbox_area / total_frame_area
    frame_width: int
    frame_height: int
    gps: Optional[GPSPoint]
    quality: Optional[QualityScore]
    model_name: str

    @staticmethod
    def make_id() -> str:
        return f"det_{uuid.uuid4().hex[:8]}"


@dataclass
class Track:
    """
    A confirmed moving object tracked across multiple frames.
    One physical vehicle/object = one Track within the camera FOV.
    """
    track_id: int
    class_name: str
    classification_source: ClassificationSource
    first_seen_frame: int
    last_seen_frame: int
    first_seen_ts: float
    last_seen_ts: float
    confirmed: bool                           # True after N consecutive detections
    trajectory: List[Tuple[int, int]] = field(default_factory=list)  # bbox centres
    detections: List[Detection] = field(default_factory=list)

    @property
    def age_frames(self) -> int:
        return self.last_seen_frame - self.first_seen_frame + 1

    @property
    def latest_bbox(self) -> Optional[Tuple[int, int, int, int]]:
        return self.detections[-1].bbox if self.detections else None

    @property
    def latest_confidence(self) -> float:
        return self.detections[-1].confidence if self.detections else 0.0

    def to_dict(self) -> Dict:
        return {
            "track_id": self.track_id,
            "class_name": self.class_name,
            "classification_source": self.classification_source.value,
            "first_seen_frame": self.first_seen_frame,
            "last_seen_frame": self.last_seen_frame,
            "first_seen_ts": round(self.first_seen_ts, 3),
            "last_seen_ts": round(self.last_seen_ts, 3),
            "age_frames": self.age_frames,
            "confirmed": self.confirmed,
            "trajectory_points": len(self.trajectory),
            "detection_count": len(self.detections),
            "latest_confidence": round(self.latest_confidence, 4),
        }


@dataclass
class Observation:
    """
    One physical event observed during one bus pass.
    Produced by temporal grouping of N detections of the same physical thing.
    Example: 20 frames of the same pothole → ONE Observation.
    """
    obs_id: str
    bus_id: str
    camera_id: str
    run_id: str
    event_type: EventType
    class_name: str
    first_seen_frame: int
    last_seen_frame: int
    first_seen_ts: float
    last_seen_ts: float
    representative_frame: int     # Frame index with highest-confidence detection
    confidence: float             # Peak detection confidence (quality-adjusted)
    severity: SeverityTier
    bbox: Tuple[int, int, int, int]  # Representative bbox
    bbox_area_px: int
    relative_area: float
    gps: Optional[GPSPoint]
    evidence_ref: Optional[str]   # Relative path to privacy-masked evidence frame
    detection_count: int          # How many individual detections were grouped
    model_name: str
    privacy_status: str = "ANONYMIZED"

    @staticmethod
    def make_id() -> str:
        return f"obs_{uuid.uuid4().hex[:12]}"

    def to_dict(self) -> Dict:
        return {
            "obs_id": self.obs_id,
            "bus_id": self.bus_id,
            "camera_id": self.camera_id,
            "run_id": self.run_id,
            "event_type": self.event_type.value,
            "class_name": self.class_name,
            "first_seen_frame": self.first_seen_frame,
            "last_seen_frame": self.last_seen_frame,
            "first_seen_ts": round(self.first_seen_ts, 3),
            "last_seen_ts": round(self.last_seen_ts, 3),
            "representative_frame": self.representative_frame,
            "confidence": round(self.confidence, 4),
            "severity": self.severity.value,
            "bbox": list(self.bbox),
            "bbox_area_px": self.bbox_area_px,
            "relative_area": round(self.relative_area, 6),
            "gps": self.gps.to_dict() if self.gps else None,
            "evidence_ref": self.evidence_ref,
            "detection_count": self.detection_count,
            "model_name": self.model_name,
            "privacy_status": self.privacy_status,
        }


@dataclass
class PersistentIssue:
    """
    A real-world physical problem inferred from one or more Observations.
    Multiple bus passes observing the same defect → ONE PersistentIssue.
    This is NOT the same as an Observation.
    """
    issue_id: str
    event_type: EventType
    class_name: str
    observations: List[Observation] = field(default_factory=list)
    bus_ids: List[str] = field(default_factory=list)
    first_seen_ts: float = 0.0
    last_seen_ts: float = 0.0
    observation_count: int = 0
    bus_count: int = 0          # Distinct bus IDs that observed this
    confidence: float = 0.0     # Fused from all observations
    severity: SeverityTier = SeverityTier.UNKNOWN
    trend: IssueTrend = IssueTrend.NEW
    center_gps: Optional[GPSPoint] = None
    road_segment: Optional[str] = None
    status: str = "OPEN"        # OPEN / UNDER_REPAIR / RESOLVED / REOPENED
    severity_history: List[str] = field(default_factory=list)
    closure_history: List[Dict] = field(default_factory=list)  # Phase D verification events

    @staticmethod
    def make_id() -> str:
        return f"issue_{uuid.uuid4().hex[:10]}"

    def to_dict(self) -> Dict:
        return {
            "issue_id": self.issue_id,
            "event_type": self.event_type.value,
            "class_name": self.class_name,
            "status": self.status,
            "observation_count": self.observation_count,
            "bus_count": self.bus_count,
            "bus_ids": self.bus_ids,
            "first_seen_ts": round(self.first_seen_ts, 3),
            "last_seen_ts": round(self.last_seen_ts, 3),
            "confidence": round(self.confidence, 4),
            "severity": self.severity.value,
            "trend": self.trend.value,
            "center_gps": self.center_gps.to_dict() if self.center_gps else None,
            "road_segment": self.road_segment,
            "severity_history": self.severity_history,
            "closure_history": self.closure_history,
            "observation_ids": [o.obs_id for o in self.observations],
        }
