"""
UrbanEye AI — AI Internal Data Models

Pure Python dataclasses and enumerations for computer vision outputs.
Decoupled from SQLAlchemy models to enable fast in-memory pipeline operations
and headless unit testing.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class DensityLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    SEVERE = "SEVERE"


class CongestionLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    SEVERE = "SEVERE"


# COCO class IDs and names relevant to urban traffic
# 0: person, 1: bicycle, 2: car, 3: motorcycle, 5: bus, 7: truck
COCO_TRAFFIC_CLASSES: Dict[int, str] = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}

VEHICLE_CLASSES = {"car", "motorcycle", "bus", "truck"}
VULNERABLE_ROAD_USER_CLASSES = {"person", "bicycle"}
ALL_TARGET_CLASSES = VEHICLE_CLASSES | VULNERABLE_ROAD_USER_CLASSES


@dataclass
class BoundingBox:
    """Bounding box coordinates in pixel space (x1, y1, x2, y2)."""
    x1: float
    y1: float
    x2: float
    y2: float

    @property
    def width(self) -> float:
        return max(0.0, self.x2 - self.x1)

    @property
    def height(self) -> float:
        return max(0.0, self.y2 - self.y1)

    @property
    def center_x(self) -> float:
        return self.x1 + self.width / 2.0

    @property
    def center_y(self) -> float:
        return self.y1 + self.height / 2.0

    @property
    def area(self) -> float:
        return self.width * self.height

    def to_tuple(self) -> Tuple[float, float, float, float]:
        return (self.x1, self.y1, self.x2, self.y2)

    def to_int_tuple(self) -> Tuple[int, int, int, int]:
        return (int(round(self.x1)), int(round(self.y1)), int(round(self.x2)), int(round(self.y2)))


@dataclass
class Detection:
    """Single object detection from YOLO."""
    bbox: BoundingBox
    class_id: int
    class_name: str
    confidence: float

    def is_vehicle(self) -> bool:
        return self.class_name in VEHICLE_CLASSES

    def is_vulnerable(self) -> bool:
        return self.class_name in VULNERABLE_ROAD_USER_CLASSES


@dataclass
class TrackedDetection:
    """Detection associated with a persistent track ID."""
    bbox: BoundingBox
    class_id: int
    class_name: str
    confidence: float
    track_id: int

    def is_vehicle(self) -> bool:
        return self.class_name in VEHICLE_CLASSES

    def is_vulnerable(self) -> bool:
        return self.class_name in VULNERABLE_ROAD_USER_CLASSES


@dataclass
class TrajectoryPoint:
    """Spatial coordinate of a tracked object at a specific frame/time."""
    x: float
    y: float
    frame_number: int
    timestamp: float
    pixel_speed: Optional[float] = None


@dataclass
class FrameResult:
    """Complete AI output for a single processed video frame."""
    frame_number: int
    timestamp: float
    detections: List[Detection] = field(default_factory=list)
    tracked_detections: List[TrackedDetection] = field(default_factory=list)
    active_vehicle_count: int = 0
    vehicle_counts_by_class: Dict[str, int] = field(default_factory=dict)
    density_level: DensityLevel = DensityLevel.LOW
    congestion_level: CongestionLevel = CongestionLevel.LOW
    avg_pixel_speed: float = 0.0
    # Phase 3 Events detected in this frame
    events: List[Any] = field(default_factory=list)


@dataclass
class PipelineResult:
    """Aggregated summary returned by the processing pipeline."""
    video_id: str
    job_id: str
    total_frames: int
    frames_processed: int
    fps: float
    duration_seconds: float
    total_unique_vehicles: int
    counts_by_class: Dict[str, int] = field(default_factory=dict)
    total_detections_recorded: int = 0
    peak_density: DensityLevel = DensityLevel.LOW
    avg_congestion_level: CongestionLevel = CongestionLevel.LOW
    annotated_video_path: Optional[str] = None
    evidence_image_paths: List[str] = field(default_factory=list)
    frame_results: List[FrameResult] = field(default_factory=list)
    active_tracks_summary: Dict[int, Dict[str, Any]] = field(default_factory=dict)
    # Phase 3 Aggregated Unique Urban Events
    urban_events: List[Any] = field(default_factory=list)

