"""
TriNetra — Module 3 Safety Adapter

Converts authoritative SafetyEvent objects from SIH2026--Module3 into:
  1. list[UrbanEventData] — for UrbanEye persistence and workflow deduplication
  2. Provenance and explainability metadata in extra_metadata
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.ai.models.event_types import EventCategory, EventSeverity, EventType, UrbanEventData

logger = logging.getLogger(__name__)

EVENT_TYPE_MAP: Dict[str, EventType] = {
    "normal_pedestrian": EventType.PEDESTRIAN_RISK,
    "road_entry": EventType.ROAD_ENTRY,
    "crossing_candidate": EventType.CROSSING_CANDIDATE,
    "school_zone_pedestrian": EventType.SCHOOL_ZONE_PEDESTRIAN,
    "school_zone_crossing": EventType.SCHOOL_ZONE_CROSSING,
    "vehicle_proximity": EventType.VEHICLE_PROXIMITY,
    "potential_conflict": EventType.POTENTIAL_CONFLICT,
    "stopped_pedestrian_road": EventType.STOPPED_PEDESTRIAN_ROAD,
}


class SafetyAdapter:
    """Transforms raw Module 3 SafetyEvents into TriNetra domain models."""

    @staticmethod
    def map_event_type(evt_type_val: str) -> EventType:
        key = str(evt_type_val).lower().strip()
        return EVENT_TYPE_MAP.get(key, EventType.PEDESTRIAN_RISK)

    @staticmethod
    def map_severity(level_val: str, score: float) -> EventSeverity:
        lvl = str(level_val).lower().strip()
        if lvl == "high":
            return EventSeverity.CRITICAL if score >= 0.85 else EventSeverity.HIGH
        elif lvl == "medium":
            return EventSeverity.MEDIUM
        return EventSeverity.LOW

    def to_urban_events(
        self,
        events: List[Any],
        video_id: Optional[str] = None,
        job_id: Optional[str] = None,
        video_lat: Optional[float] = None,
        video_lon: Optional[float] = None,
    ) -> List[UrbanEventData]:
        """
        Normalize a list of Module 3 SafetyEvents into TriNetra UrbanEventData.

        Preserves:
          - Explainability reasons and human-readable explanation
          - Frame boundaries and track ID
          - Bounding boxes and footprint locations
          - Evidence frame references
          - Location provenance without fabrication
        """
        urban_events: List[UrbanEventData] = []

        for evt in events:
            # Extract raw event type string
            raw_type = evt.event_type.value if hasattr(evt.event_type, "value") else str(evt.event_type)
            event_type = self.map_event_type(raw_type)

            # Risk details
            risk = getattr(evt, "risk", None)
            risk_level_val = "low"
            risk_score = 0.0
            risk_conf = 0.5
            risk_reasons: List[str] = []
            risk_explanation = ""

            if risk:
                risk_level_val = risk.level.value if hasattr(risk.level, "value") else str(risk.level)
                risk_score = float(getattr(risk, "score", 0.0))
                risk_conf = float(getattr(risk, "confidence", 0.5))
                raw_reasons = getattr(risk, "reasons", [])
                risk_reasons = [r.value if hasattr(r, "value") else str(r) for r in raw_reasons]
                risk_explanation = getattr(risk, "explanation", "") or ""

            severity = self.map_severity(risk_level_val, risk_score)

            # Bounding box coordinates
            bbox = getattr(evt, "bounding_box", None)
            bbox_x1 = getattr(bbox, "x1", None) if bbox else None
            bbox_y1 = getattr(bbox, "y1", None) if bbox else None
            bbox_x2 = getattr(bbox, "x2", None) if bbox else None
            bbox_y2 = getattr(bbox, "y2", None) if bbox else None

            # Frame & Timestamp
            frame_num = int(getattr(evt, "frame_index", 0))
            ts = 0.0
            raw_ts = getattr(evt, "timestamp", None)
            if raw_ts is not None:
                if hasattr(raw_ts, "timestamp"):
                    ts = float(raw_ts.timestamp())
                elif isinstance(raw_ts, (int, float)):
                    ts = float(raw_ts)

            # Location handling (Never fabricate GPS)
            lat = None
            lon = None
            location_status = "UNAVAILABLE"
            loc = getattr(evt, "location", None)
            if loc and getattr(loc, "lat", None) is not None and getattr(loc, "lon", None) is not None:
                lat = float(loc.lat)
                lon = float(loc.lon)
                location_status = "EVENT_GPS"
            elif video_lat is not None and video_lon is not None:
                lat = video_lat
                lon = video_lon
                location_status = "VIDEO_DEFAULT_GPS"

            # Context
            context = getattr(evt, "context", None)
            context_dict: Dict[str, Any] = {}
            if context:
                if hasattr(context, "model_dump"):
                    context_dict = context.model_dump()
                elif hasattr(context, "dict"):
                    context_dict = context.dict()
                elif isinstance(context, dict):
                    context_dict = context

            # Track info
            track = getattr(evt, "track", None)
            track_id = getattr(track, "track_id", None) if track else None
            object_type = getattr(track, "object_type", "person") if track else "person"

            # Evidence info
            evidence = getattr(evt, "evidence", None)
            evidence_frames = getattr(evidence, "frames", []) if evidence else []
            evidence_clip = getattr(evidence, "clip", None) if evidence else None
            trajectory_snapshot = getattr(evidence, "trajectory_snapshot", None) if evidence else None

            # Description
            desc = risk_explanation or f"Safety event: {raw_type} (risk: {risk_score:.2f}, level: {severity.value})"

            extra_meta: Dict[str, Any] = {
                "ai_engine": "module3_safety",
                "module": "pedestrian_safety",
                "source": "REAL_VIDEO_INFERENCE",
                "source_event_id": str(getattr(evt, "event_id", "")),
                "risk_score": risk_score,
                "risk_level": risk_level_val,
                "risk_reasons": risk_reasons,
                "risk_explanation": risk_explanation,
                "track_id": track_id,
                "object_type": object_type,
                "start_frame": getattr(evt, "start_frame", frame_num),
                "end_frame": getattr(evt, "end_frame", frame_num),
                "context": context_dict,
                "evidence_frames": evidence_frames,
                "evidence_clip": evidence_clip,
                "trajectory_snapshot": trajectory_snapshot,
                "location_status": location_status,
                "video_id": video_id,
                "job_id": job_id,
            }

            u_event = UrbanEventData(
                event_type=event_type,
                severity=severity,
                confidence=risk_conf,
                frame_number=frame_num,
                timestamp=ts,
                bbox_x1=bbox_x1,
                bbox_y1=bbox_y1,
                bbox_x2=bbox_x2,
                bbox_y2=bbox_y2,
                latitude=lat,
                longitude=lon,
                description=desc,
                extra_metadata=extra_meta,
            )
            urban_events.append(u_event)

        return urban_events
