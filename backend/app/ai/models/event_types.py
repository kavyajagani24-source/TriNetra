"""
UrbanEye AI — Phase 3 Event & Hazard Type Definitions

Pure Python enumerations and dataclasses for Phase 3:
Road hazards, infrastructure intelligence, pedestrian safety,
behavioural analytics, and urban incident events.

Decoupled from SQLAlchemy for fast in-memory pipeline operations.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


# ── Event Classification ───────────────────────────────────────────────────────

class EventType(str, Enum):
    """Top-level category of a detected urban event."""
    # Road hazards
    POTHOLE             = "POTHOLE"
    ROAD_DAMAGE         = "ROAD_DAMAGE"
    WATERLOGGING        = "WATERLOGGING"
    ROAD_OBSTACLE       = "ROAD_OBSTACLE"
    DEBRIS              = "DEBRIS"
    POTHOLE_CLUSTER     = "POTHOLE_CLUSTER"

    # Infrastructure
    TRAFFIC_SIGN        = "TRAFFIC_SIGN"
    ZEBRA_CROSSING      = "ZEBRA_CROSSING"
    ROAD_MARKING        = "ROAD_MARKING"
    DIVIDER             = "DIVIDER"

    # Pedestrian / VRU safety
    PEDESTRIAN_RISK     = "PEDESTRIAN_RISK"
    JAYWALKING          = "JAYWALKING"
    UNSAFE_CROSSING     = "UNSAFE_CROSSING"
    NEAR_MISS           = "NEAR_MISS"

    # Vehicle behaviour
    RASH_DRIVING        = "RASH_DRIVING"
    SUDDEN_BRAKING      = "SUDDEN_BRAKING"
    WRONG_WAY           = "WRONG_WAY"
    SPEEDING            = "SPEEDING"
    ABNORMAL_STOP       = "ABNORMAL_STOP"

    # Traffic incidents
    ACCIDENT            = "ACCIDENT"
    CONGESTION_INCIDENT = "CONGESTION_INCIDENT"
    QUEUE_BUILDUP       = "QUEUE_BUILDUP"

    # Miscellaneous
    UNKNOWN             = "UNKNOWN"


class EventSeverity(str, Enum):
    """Severity level of a detected event."""
    LOW      = "LOW"
    MEDIUM   = "MEDIUM"
    HIGH     = "HIGH"
    CRITICAL = "CRITICAL"


class EventCategory(str, Enum):
    """Broad grouping used for dashboard filtering."""
    HAZARD         = "HAZARD"
    INFRASTRUCTURE = "INFRASTRUCTURE"
    SAFETY         = "SAFETY"
    BEHAVIOR       = "BEHAVIOR"
    INCIDENT       = "INCIDENT"


# ── Category Mapping ───────────────────────────────────────────────────────────

EVENT_CATEGORY_MAP: Dict[EventType, EventCategory] = {
    EventType.POTHOLE:              EventCategory.HAZARD,
    EventType.ROAD_DAMAGE:          EventCategory.HAZARD,
    EventType.WATERLOGGING:         EventCategory.HAZARD,
    EventType.ROAD_OBSTACLE:        EventCategory.HAZARD,
    EventType.DEBRIS:               EventCategory.HAZARD,
    EventType.POTHOLE_CLUSTER:      EventCategory.HAZARD,

    EventType.TRAFFIC_SIGN:         EventCategory.INFRASTRUCTURE,
    EventType.ZEBRA_CROSSING:       EventCategory.INFRASTRUCTURE,
    EventType.ROAD_MARKING:         EventCategory.INFRASTRUCTURE,
    EventType.DIVIDER:              EventCategory.INFRASTRUCTURE,

    EventType.PEDESTRIAN_RISK:      EventCategory.SAFETY,
    EventType.JAYWALKING:           EventCategory.SAFETY,
    EventType.UNSAFE_CROSSING:      EventCategory.SAFETY,
    EventType.NEAR_MISS:            EventCategory.SAFETY,

    EventType.RASH_DRIVING:         EventCategory.BEHAVIOR,
    EventType.SUDDEN_BRAKING:       EventCategory.BEHAVIOR,
    EventType.WRONG_WAY:            EventCategory.BEHAVIOR,
    EventType.SPEEDING:             EventCategory.BEHAVIOR,
    EventType.ABNORMAL_STOP:        EventCategory.BEHAVIOR,

    EventType.ACCIDENT:             EventCategory.INCIDENT,
    EventType.CONGESTION_INCIDENT:  EventCategory.INCIDENT,
    EventType.QUEUE_BUILDUP:        EventCategory.INCIDENT,

    EventType.UNKNOWN:              EventCategory.INCIDENT,
}

# Severity rank helper (used by deduplication and aggregation)
SEVERITY_RANK: Dict[EventSeverity, int] = {
    EventSeverity.LOW:      0,
    EventSeverity.MEDIUM:   1,
    EventSeverity.HIGH:     2,
    EventSeverity.CRITICAL: 3,
}


# ── Phase 3 Dataclasses ────────────────────────────────────────────────────────

@dataclass
class UrbanEventData:
    """
    In-memory representation of a detected urban event produced by
    a Phase 3 analysis module.  Instances are persisted to urban_events
    via EventRepository after deduplication.
    """
    event_type: EventType
    severity: EventSeverity
    confidence: float                    # 0.0 – 1.0
    frame_number: int
    timestamp: float                     # seconds from video start

    # Pixel-space bounding box (optional)
    bbox_x1: Optional[float] = None
    bbox_y1: Optional[float] = None
    bbox_x2: Optional[float] = None
    bbox_y2: Optional[float] = None

    # Geospatial (optional — provided by GPS overlay)
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    description: str = ""
    extra_metadata: Dict[str, Any] = field(default_factory=dict)

    # Derived — populated in __post_init__
    category: EventCategory = field(init=False)

    def __post_init__(self) -> None:
        self.category = EVENT_CATEGORY_MAP.get(self.event_type, EventCategory.INCIDENT)

    @property
    def center_x(self) -> Optional[float]:
        if self.bbox_x1 is not None and self.bbox_x2 is not None:
            return (self.bbox_x1 + self.bbox_x2) / 2.0
        return None

    @property
    def center_y(self) -> Optional[float]:
        if self.bbox_y1 is not None and self.bbox_y2 is not None:
            return (self.bbox_y1 + self.bbox_y2) / 2.0
        return None

    def severity_rank(self) -> int:
        return SEVERITY_RANK.get(self.severity, 0)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_type": self.event_type.value,
            "category": self.category.value,
            "severity": self.severity.value,
            "confidence": self.confidence,
            "frame_number": self.frame_number,
            "timestamp": self.timestamp,
            "bbox": {
                "x1": self.bbox_x1,
                "y1": self.bbox_y1,
                "x2": self.bbox_x2,
                "y2": self.bbox_y2,
            },
            "latitude": self.latitude,
            "longitude": self.longitude,
            "description": self.description,
            "metadata": self.extra_metadata,
        }


@dataclass
class Phase3FrameAnalysis:
    """
    Aggregated Phase 3 output for a single processed video frame.
    Collected across all active analysis modules.
    """
    frame_number: int
    timestamp: float
    detected_events: List[UrbanEventData] = field(default_factory=list)

    # Quick counters for downstream logic
    hazard_count: int = 0
    safety_risk_count: int = 0
    infrastructure_count: int = 0
    behavior_count: int = 0

    def add_event(self, event: UrbanEventData) -> None:
        """Register an event and update category counters."""
        self.detected_events.append(event)
        if event.category == EventCategory.HAZARD:
            self.hazard_count += 1
        elif event.category == EventCategory.SAFETY:
            self.safety_risk_count += 1
        elif event.category == EventCategory.INFRASTRUCTURE:
            self.infrastructure_count += 1
        elif event.category == EventCategory.BEHAVIOR:
            self.behavior_count += 1

    @property
    def total_events(self) -> int:
        return len(self.detected_events)

    @property
    def max_severity(self) -> Optional[EventSeverity]:
        if not self.detected_events:
            return None
        return max(self.detected_events, key=lambda e: e.severity_rank()).severity
