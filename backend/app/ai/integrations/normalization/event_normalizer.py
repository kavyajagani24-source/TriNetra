"""
TriNetra — Event Normalizer

Consolidates, validates, and deduplicates UrbanEventData instances produced
by multiple AI engines (Sixth Sense Road AI, Module 3 Safety AI).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Set

from app.ai.models.event_types import EventCategory, EventSeverity, EventType, UrbanEventData

logger = logging.getLogger(__name__)


class EventNormalizer:
    """
    Unifies and deduplicates UrbanEventData across inference engines.
    """

    def __init__(self, spatial_dedup_px: float = 60.0, temporal_dedup_frames: int = 45) -> None:
        self.spatial_dedup_px = spatial_dedup_px
        self.temporal_dedup_frames = temporal_dedup_frames

    def deduplicate(self, events: List[UrbanEventData]) -> List[UrbanEventData]:
        """
        Deduplicate events:
        - For safety events: dedup by source_event_id or track_id + event_type.
        - For road hazards: spatial proximity within temporal window.
        """
        if not events:
            return []

        safety_events: List[UrbanEventData] = []
        road_events: List[UrbanEventData] = []

        for e in events:
            if e.category == EventCategory.SAFETY:
                safety_events.append(e)
            else:
                road_events.append(e)

        deduped_safety = self._dedupe_safety(safety_events)
        deduped_road = self._dedupe_road(road_events)

        combined = deduped_road + deduped_safety
        combined.sort(key=lambda ev: (ev.frame_number, ev.timestamp))
        return combined

    def _dedupe_safety(self, events: List[UrbanEventData]) -> List[UrbanEventData]:
        seen_keys: Set[str] = set()
        deduped: List[UrbanEventData] = []

        sorted_events = sorted(events, key=lambda ev: (ev.severity_rank(), ev.confidence), reverse=True)

        for e in sorted_events:
            src_id = e.extra_metadata.get("source_event_id")
            track_id = e.extra_metadata.get("track_id")

            if src_id:
                key = f"src_{src_id}"
            elif track_id is not None:
                key = f"trk_{track_id}_{e.event_type.value}"
            else:
                key = f"f_{e.frame_number}_{e.event_type.value}_{e.bbox_x1}_{e.bbox_y1}"

            if key not in seen_keys:
                seen_keys.add(key)
                deduped.append(e)

        return deduped

    def _dedupe_road(self, events: List[UrbanEventData]) -> List[UrbanEventData]:
        deduped: List[UrbanEventData] = []

        for candidate in events:
            duplicate = False
            for kept in deduped:
                if candidate.event_type == kept.event_type:
                    frame_diff = abs(candidate.frame_number - kept.frame_number)
                    if frame_diff <= self.temporal_dedup_frames:
                        if candidate.center_x is not None and kept.center_x is not None:
                            dx = candidate.center_x - kept.center_x
                            dy = (candidate.center_y or 0.0) - (kept.center_y or 0.0)
                            dist = (dx**2 + dy**2) ** 0.5
                            if dist < self.spatial_dedup_px:
                                duplicate = True
                                break
            if not duplicate:
                deduped.append(candidate)

        return deduped
