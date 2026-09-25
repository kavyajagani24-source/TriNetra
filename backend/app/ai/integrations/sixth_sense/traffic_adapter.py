"""
TriNetra — Sixth Sense Traffic Adapter

Converts SixthSenseRunResult (traffic) into:
  1. list[NormalizedTrafficDetection] — vehicle tracks across the video
  2. NormalizedTrafficSummary — overall traffic density & counts
  3. Dict for TrafficAnalytics persistence
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.ai.integrations.sixth_sense.schemas import (
    NormalizedTrafficDetection,
    NormalizedTrafficSummary,
    SixthSenseRunResult,
)

logger = logging.getLogger(__name__)


class TrafficAdapter:
    """Transforms raw Sixth Sense traffic analysis into TriNetra domain models."""

    def to_normalized_detections(
        self,
        result: SixthSenseRunResult,
    ) -> List[NormalizedTrafficDetection]:
        """Convert confirmed vehicle tracks to NormalizedTrafficDetection list."""
        if not result.success:
            return []

        tracks: List[NormalizedTrafficDetection] = []
        for det in result.detections:
            track_id = str(det.get("track_id", "0"))
            class_name = det.get("class_name", "unknown")
            conf = float(det.get("latest_confidence", 0.0))
            frame_idx = int(det.get("first_seen_frame", 0))
            ts = float(det.get("first_seen_ts", 0.0))
            bbox = det.get("bbox", [])
            bbox_coords = [float(x) for x in bbox] if bbox else [0.0, 0.0, 0.0, 0.0]

            track = NormalizedTrafficDetection(
                track_id=track_id,
                class_name=class_name,
                confidence=conf,
                bbox=bbox_coords,
                frame_index=frame_idx,
                timestamp=ts,
                run_id=result.run_id,
                raw=det,
            )
            tracks.append(track)

        return tracks

    def to_traffic_summary(
        self,
        result: SixthSenseRunResult,
    ) -> NormalizedTrafficSummary:
        """Extract aggregate traffic counts and state from SixthSenseRunResult."""
        summary = result.summary or {}
        metrics = result.metrics or {}

        counts_by_class: Dict[str, int] = {
            "car": int(summary.get("cars", 0)),
            "bus": int(summary.get("buses", 0)),
            "truck": int(summary.get("trucks", 0)),
            "motorcycle": int(summary.get("motorcycles", 0)),
            "auto_rickshaw": int(summary.get("auto_rickshaws", 0)),
            "bicycle": int(summary.get("bicycles", 0)),
            "pedestrian": int(summary.get("pedestrians", 0)),
        }

        unique_tracks = int(
            summary.get("total_vehicles", metrics.get("unique_tracks", 0))
        )
        congestion = str(summary.get("congestion_level", "UNKNOWN")).upper()

        # Map congestion to traffic density description if needed
        density_map = {
            "LOW": "LOW",
            "MEDIUM": "MODERATE",
            "HIGH": "HIGH",
            "SEVERE": "VERY_HIGH",
        }
        traffic_density = density_map.get(congestion, "MODERATE")

        return NormalizedTrafficSummary(
            run_id=result.run_id,
            unique_vehicle_count=unique_tracks,
            counts_by_class=counts_by_class,
            traffic_density=traffic_density,
            congestion_level=congestion,
            processing_fps=float(metrics.get("target_fps", 0.0)) if metrics.get("target_fps") else None,
            model_checkpoint=str(metrics.get("model_checkpoint", "models/yolo11x.pt")),
            raw_summary=summary,
            raw_metrics=metrics,
        )

    def to_traffic_analytics_dict(
        self,
        result: SixthSenseRunResult,
        video_id: Any,
        job_id: Any,
    ) -> Dict[str, Any]:
        """Produce dictionary suitable for persisting to the traffic_analytics table."""
        summary_norm = self.to_traffic_summary(result)
        counts = summary_norm.counts_by_class

        active_vehicles = (
            counts.get("car", 0)
            + counts.get("bus", 0)
            + counts.get("truck", 0)
            + counts.get("motorcycle", 0)
            + counts.get("auto_rickshaw", 0)
            + counts.get("bicycle", 0)
        )

        return {
            "video_id": video_id,
            "job_id": job_id,
            "timestamp": 0.0,
            "frame_number": 0,
            "active_vehicle_count": active_vehicles,
            "car_count": counts.get("car", 0),
            "motorcycle_count": counts.get("motorcycle", 0),
            "bus_count": counts.get("bus", 0),
            "truck_count": counts.get("truck", 0),
            "person_count": counts.get("pedestrian", 0),
            "auto_rickshaw_count": counts.get("auto_rickshaw", 0),
            "bicycle_count": counts.get("bicycle", 0),
            "unique_vehicle_count": summary_norm.unique_vehicle_count,
            "average_pixel_speed": 0.0,
            "traffic_density": summary_norm.traffic_density,
            "congestion_level": summary_norm.congestion_level,
        }
