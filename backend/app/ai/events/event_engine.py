"""
UrbanEye AI — Phase 3 Event Engine

Central hub that collects UrbanEventData from all analysis modules
and applies temporal deduplication to avoid flooding the database
with repeated events for the same persistent hazard.
"""

from __future__ import annotations

import logging
import math
from typing import Dict, List, Optional, Tuple

from app.ai.models.event_types import (
    EventCategory,
    EventSeverity,
    EventType,
    SEVERITY_RANK,
    UrbanEventData,
)

logger = logging.getLogger(__name__)


# ── Deduplication Window ───────────────────────────────────────────────────────

# Key: (event_type, spatial_bucket)  →  last frame number when this was persisted
_DedupeKey = Tuple[str, int, int]   # (event_type_value, bucket_x, bucket_y)


def _spatial_bucket(
    cx: Optional[float], cy: Optional[float], bucket_size: float = 50.0
) -> Tuple[int, int]:
    """Convert pixel centre-point to a discrete spatial bucket."""
    if cx is None or cy is None:
        return (0, 0)
    return (int(cx / bucket_size), int(cy / bucket_size))


class EventEngine:
    """
    Collects events from all Phase 3 modules and performs:
    1. Temporal deduplication — suppress repeated events within a time window.
    2. Evidence accumulation — track per-event confidence for severity upgrade.
    """

    def __init__(
        self,
        dedup_frame_window: int = 150,
        spatial_bucket_size: float = 50.0,
    ):
        """
        Args:
            dedup_frame_window: Suppress re-emitting the same event type at
                                the same spatial location for this many frames.
            spatial_bucket_size: Pixel size of spatial de-dup grid cells.
        """
        self.dedup_frame_window = dedup_frame_window
        self.spatial_bucket_size = spatial_bucket_size

        # Maps dedup key → last_emitted_frame
        self._last_emitted: Dict[_DedupeKey, int] = {}

        # Running list of unique events emitted throughout the video
        self._emitted_events: List[UrbanEventData] = []

    def submit(self, event: UrbanEventData) -> Optional[UrbanEventData]:
        """
        Submit an event for potential emission.

        Returns the event if it passes deduplication, else None (suppressed).
        """
        bucket = _spatial_bucket(event.center_x, event.center_y, self.spatial_bucket_size)
        key: _DedupeKey = (event.event_type.value, bucket[0], bucket[1])

        for previous in reversed(self._emitted_events):
            if previous.event_type != event.event_type:
                continue
            if event.frame_number - previous.frame_number >= self.dedup_frame_window:
                break
            if previous.center_x is None or event.center_x is None:
                return None
            if self._boxes_overlap(previous, event) or self._same_moving_hazard(previous, event):
                return None

        if key in self._last_emitted:
            last_frame = self._last_emitted[key]
            if event.frame_number - last_frame < self.dedup_frame_window:
                # Suppress duplicate
                return None

        # Emit
        self._last_emitted[key] = event.frame_number
        self._emitted_events.append(event)
        logger.debug(
            "Event emitted: type=%s severity=%s frame=%d conf=%.2f",
            event.event_type.value,
            event.severity.value,
            event.frame_number,
            event.confidence,
        )
        return event

    @staticmethod
    def _boxes_overlap(first: UrbanEventData, second: UrbanEventData) -> bool:
        left = max(first.bbox_x1 or 0, second.bbox_x1 or 0)
        top = max(first.bbox_y1 or 0, second.bbox_y1 or 0)
        right = min(first.bbox_x2 or 0, second.bbox_x2 or 0)
        bottom = min(first.bbox_y2 or 0, second.bbox_y2 or 0)
        intersection = max(0.0, right - left) * max(0.0, bottom - top)
        first_area = max(0.0, (first.bbox_x2 or 0) - (first.bbox_x1 or 0)) * max(0.0, (first.bbox_y2 or 0) - (first.bbox_y1 or 0))
        second_area = max(0.0, (second.bbox_x2 or 0) - (second.bbox_x1 or 0)) * max(0.0, (second.bbox_y2 or 0) - (second.bbox_y1 or 0))
        union = first_area + second_area - intersection
        return union > 0 and intersection / union >= 0.35

    @staticmethod
    def _same_moving_hazard(first: UrbanEventData, second: UrbanEventData) -> bool:
        """Match a road defect while camera motion shifts its pixel box."""
        hazard_types = {
            EventType.POTHOLE,
            EventType.POTHOLE_CLUSTER,
            EventType.ROAD_DAMAGE,
        }
        if first.event_type not in hazard_types:
            return False
        distance = math.hypot(
            (first.center_x or 0) - (second.center_x or 0),
            (first.center_y or 0) - (second.center_y or 0),
        )
        first_scale = max(first.bbox_x2 - first.bbox_x1, first.bbox_y2 - first.bbox_y1) if first.bbox_x1 is not None and first.bbox_y1 is not None and first.bbox_x2 is not None and first.bbox_y2 is not None else 0
        second_scale = max(second.bbox_x2 - second.bbox_x1, second.bbox_y2 - second.bbox_y1) if second.bbox_x1 is not None and second.bbox_y1 is not None and second.bbox_x2 is not None and second.bbox_y2 is not None else 0
        return distance <= max(150.0, min(first_scale, second_scale) * 0.45)

    def submit_all(self, events: List[UrbanEventData]) -> List[UrbanEventData]:
        """Submit a batch of events; return only those that pass dedup."""
        emitted: List[UrbanEventData] = []
        for ev in events:
            result = self.submit(ev)
            if result is not None:
                emitted.append(result)
        return emitted

    @property
    def total_emitted(self) -> int:
        return len(self._emitted_events)

    def get_all_events(self) -> List[UrbanEventData]:
        """Return copy of all emitted events for persistence."""
        return list(self._emitted_events)

    def reset(self) -> None:
        """Reset state — call between videos."""
        self._last_emitted.clear()
        self._emitted_events.clear()
