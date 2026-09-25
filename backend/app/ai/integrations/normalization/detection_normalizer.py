"""
TriNetra — Detection Normalizer

Converts detections across engines into standard records for the `detections` table.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class DetectionNormalizer:
    """Normalizes detection outputs from multiple engines."""

    @staticmethod
    def from_road_detections(
        detections: List[Dict[str, Any]],
        video_id: Any,
        job_id: Any,
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        for d in detections:
            bbox = d.get("bbox", [0, 0, 0, 0])
            x1 = float(bbox[0]) if len(bbox) >= 4 else 0.0
            y1 = float(bbox[1]) if len(bbox) >= 4 else 0.0
            x2 = float(bbox[2]) if len(bbox) >= 4 else 0.0
            y2 = float(bbox[3]) if len(bbox) >= 4 else 0.0
            results.append({
                "video_id": video_id,
                "job_id": job_id,
                "track_id": None,
                "class_name": d.get("label", d.get("type", "road_damage")),
                "class_id": 0,
                "confidence": float(d.get("confidence", 0.0)),
                "frame_number": int(d.get("frame", 0)),
                "timestamp": float(d.get("timestamp", 0.0)),
                "bbox_x1": x1,
                "bbox_y1": y1,
                "bbox_x2": x2,
                "bbox_y2": y2,
                "center_x": (x1 + x2) / 2.0,
                "center_y": (y1 + y2) / 2.0,
                "source_engine": "sixth_sense_road",
            })
        return results

    @staticmethod
    def from_traffic_detections(
        detections: List[Dict[str, Any]],
        video_id: Any,
        job_id: Any,
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        for d in detections:
            bbox = d.get("bbox", [0, 0, 0, 0])
            x1 = float(bbox[0]) if len(bbox) >= 4 else 0.0
            y1 = float(bbox[1]) if len(bbox) >= 4 else 0.0
            x2 = float(bbox[2]) if len(bbox) >= 4 else 0.0
            y2 = float(bbox[3]) if len(bbox) >= 4 else 0.0
            track_id_val = None
            try:
                track_id_val = int(d.get("track_id")) if d.get("track_id") is not None else None
            except (ValueError, TypeError):
                pass

            results.append({
                "video_id": video_id,
                "job_id": job_id,
                "track_id": track_id_val,
                "class_name": d.get("class_name", "vehicle"),
                "class_id": 1,
                "confidence": float(d.get("latest_confidence", 0.0)),
                "frame_number": int(d.get("first_seen_frame", 0)),
                "timestamp": float(d.get("first_seen_ts", 0.0)),
                "bbox_x1": x1,
                "bbox_y1": y1,
                "bbox_x2": x2,
                "bbox_y2": y2,
                "center_x": (x1 + x2) / 2.0,
                "center_y": (y1 + y2) / 2.0,
                "source_engine": "sixth_sense_traffic",
            })
        return results

    @staticmethod
    def from_safety_events(
        safety_events: List[Any],
        video_id: Any,
        job_id: Any,
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        for evt in safety_events:
            bbox = getattr(evt, "bounding_box", None)
            if not bbox:
                continue
            x1 = float(getattr(bbox, "x1", 0.0))
            y1 = float(getattr(bbox, "y1", 0.0))
            x2 = float(getattr(bbox, "x2", 0.0))
            y2 = float(getattr(bbox, "y2", 0.0))
            track = getattr(evt, "track", None)
            track_id_val = getattr(track, "track_id", None) if track else None
            obj_type = getattr(track, "object_type", "person") if track else "person"
            conf = float(getattr(bbox, "confidence", 0.0))

            frame_num = int(getattr(evt, "frame_index", 0))
            ts = 0.0
            raw_ts = getattr(evt, "timestamp", None)
            if raw_ts is not None:
                if hasattr(raw_ts, "timestamp"):
                    ts = float(raw_ts.timestamp())
                elif isinstance(raw_ts, (int, float)):
                    ts = float(raw_ts)

            results.append({
                "video_id": video_id,
                "job_id": job_id,
                "track_id": track_id_val,
                "class_name": obj_type,
                "class_id": 0,
                "confidence": conf,
                "frame_number": frame_num,
                "timestamp": ts,
                "bbox_x1": x1,
                "bbox_y1": y1,
                "bbox_x2": x2,
                "bbox_y2": y2,
                "center_x": (x1 + x2) / 2.0,
                "center_y": (y1 + y2) / 2.0,
                "source_engine": "module3_safety",
            })
        return results
