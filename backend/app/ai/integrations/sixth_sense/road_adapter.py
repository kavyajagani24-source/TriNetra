"""
TriNetra — Sixth Sense Road Adapter

Converts SixthSenseRunResult (road_infrastructure) into:
  1. list[UrbanEventData] — for UrbanEye event persistence and deduplication
  2. list[NormalizedRoadDetection] — structured detection representations
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.ai.integrations.sixth_sense.schemas import (
    NormalizedRoadDetection,
    SixthSenseRunResult,
)
from app.ai.models.event_types import EventCategory, EventSeverity, EventType, UrbanEventData

logger = logging.getLogger(__name__)

DAMAGE_CLASS_MAP: Dict[str, EventType] = {
    "D00": EventType.ROAD_CRACK,
    "D10": EventType.ROAD_CRACK,
    "D20": EventType.ROAD_CRACK,
    "D40": EventType.POTHOLE,
    "Repair": EventType.ROAD_REPAIR,
    "repair": EventType.ROAD_REPAIR,
    "pothole": EventType.POTHOLE,
    "crack": EventType.ROAD_CRACK,
    "road_damage": EventType.ROAD_DAMAGE,
}

SEVERITY_MAP: Dict[str, EventSeverity] = {
    "LOW": EventSeverity.LOW,
    "MEDIUM": EventSeverity.MEDIUM,
    "HIGH": EventSeverity.HIGH,
    "CRITICAL": EventSeverity.CRITICAL,
}


class RoadAdapter:
    """Transforms raw Sixth Sense road analysis into TriNetra domain models."""

    @staticmethod
    def map_damage_class(damage_type: str) -> EventType:
        return DAMAGE_CLASS_MAP.get(damage_type, EventType.ROAD_DAMAGE)

    @staticmethod
    def map_severity(severity_str: str) -> EventSeverity:
        return SEVERITY_MAP.get(severity_str.upper(), EventSeverity.MEDIUM)

    def to_urban_events(
        self,
        result: SixthSenseRunResult,
        video_id: Optional[str] = None,
        job_id: Optional[str] = None,
        video_lat: Optional[float] = None,
        video_lon: Optional[float] = None,
    ) -> List[UrbanEventData]:
        """Convert confirmed road observations to UrbanEventData list."""
        if not result.success:
            return []

        events: List[UrbanEventData] = []
        for det in result.detections:
            damage_type = det.get("type", "unknown")
            event_type = self.map_damage_class(damage_type)
            severity = self.map_severity(det.get("severity", "MEDIUM"))
            confidence = float(det.get("confidence", 0.0))
            frame_num = int(det.get("frame", 0))
            ts = float(det.get("timestamp", 0.0))
            bbox = det.get("bbox", [])

            bbox_x1 = float(bbox[0]) if len(bbox) >= 4 else None
            bbox_y1 = float(bbox[1]) if len(bbox) >= 4 else None
            bbox_x2 = float(bbox[2]) if len(bbox) >= 4 else None
            bbox_y2 = float(bbox[3]) if len(bbox) >= 4 else None

            label = det.get("label", damage_type)
            desc = f"{label} detected (confidence: {confidence:.2f}, severity: {severity.value})"

            extra_meta: Dict[str, Any] = {
                "ai_engine": "sixth_sense",
                "module": "road_infrastructure",
                "source": "REAL_VIDEO_INFERENCE",
                "run_id": result.run_id,
                "damage_class": damage_type,
                "label": label,
                "detection_count": det.get("detection_count", 1),
                "relative_area": det.get("relative_area"),
                "evidence_ref": det.get("evidence_ref"),
                "annotated_video_path": result.annotated_video_path,
                "video_id": video_id,
                "job_id": job_id,
            }

            evt = UrbanEventData(
                event_type=event_type,
                severity=severity,
                confidence=confidence,
                frame_number=frame_num,
                timestamp=ts,
                bbox_x1=bbox_x1,
                bbox_y1=bbox_y1,
                bbox_x2=bbox_x2,
                bbox_y2=bbox_y2,
                latitude=video_lat,
                longitude=video_lon,
                description=desc,
                extra_metadata=extra_meta,
            )
            events.append(evt)

        return events

    def to_normalized_detections(
        self,
        result: SixthSenseRunResult,
    ) -> List[NormalizedRoadDetection]:
        """Convert confirmed observations to NormalizedRoadDetection objects."""
        if not result.success:
            return []

        normalized: List[NormalizedRoadDetection] = []
        for i, det in enumerate(result.detections):
            damage_type = det.get("type", "unknown")
            event_type = self.map_damage_class(damage_type)
            norm = NormalizedRoadDetection(
                obs_id=f"{result.run_id}_road_{i}",
                damage_class=damage_type,
                event_type_mapped=event_type.value,
                severity=det.get("severity", "MEDIUM"),
                confidence=float(det.get("confidence", 0.0)),
                bbox=[float(x) for x in det.get("bbox", [])],
                frame_index=int(det.get("frame", 0)),
                timestamp=float(det.get("timestamp", 0.0)),
                detection_count=int(det.get("detection_count", 1)),
                first_seen_frame=int(det.get("frame", 0)),
                last_seen_frame=int(det.get("frame", 0)),
                relative_area=det.get("relative_area"),
                run_id=result.run_id,
                raw=det,
            )
            normalized.append(norm)

        return normalized
