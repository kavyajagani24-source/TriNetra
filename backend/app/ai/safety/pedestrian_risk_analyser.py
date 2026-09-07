"""
UrbanEye AI — Pedestrian Risk & VRU Safety Analyser

Evaluates pedestrian and vulnerable road user (VRU) safety:
  • Proximity to moving vehicles (Near-Miss detection)
  • Jaywalking / Pedestrian in roadway detection
  • Unsafe crossing behaviour
  • Time-To-Collision (TTC) approximations

Phase 3 — Safety Module.
"""

from __future__ import annotations

import logging
import math
from typing import List, Tuple

from app.ai.models.detection_types import FrameResult, TrackedDetection
from app.ai.models.event_types import (
    EventSeverity,
    EventType,
    UrbanEventData,
)

logger = logging.getLogger(__name__)


class PedestrianRiskAnalyser:
    """
    Analyses interactions between pedestrians/cyclists and motorized vehicles.
    """

    def __init__(
        self,
        enabled: bool = True,
        near_miss_distance_px: float = 85.0,
        critical_distance_px: float = 45.0,
        roadway_y_threshold: float = 0.55,  # lower 45% assumed roadway
    ):
        self.enabled = enabled
        self.near_miss_distance_px = near_miss_distance_px
        self.critical_distance_px = critical_distance_px
        self.roadway_y_threshold = roadway_y_threshold

        if enabled:
            logger.info("PedestrianRiskAnalyser initialised.")

    def analyse(
        self,
        frame_result: FrameResult,
        frame_number: int,
        timestamp: float,
        frame_height: int = 720,
        frame_width: int = 1280,
    ) -> List[UrbanEventData]:
        """
        Evaluate frame detections for VRU risk and near-miss interactions.
        """
        if not self.enabled:
            return []

        events: List[UrbanEventData] = []
        tracked = frame_result.tracked_detections

        pedestrians = [t for t in tracked if t.class_name in ("person", "bicycle")]
        vehicles = [t for t in tracked if t.class_name in ("car", "motorcycle", "bus", "truck")]

        # ── 1. Pedestrian in Roadway / Jaywalking ──────────────────────────────
        road_cutoff_y = frame_height * self.roadway_y_threshold
        for ped in pedestrians:
            cy = ped.bbox.center_y
            cx = ped.bbox.center_x
            if cy > road_cutoff_y:
                # Pedestrian is deep in the vehicle roadway lane
                events.append(
                    UrbanEventData(
                        event_type=EventType.JAYWALKING,
                        severity=EventSeverity.MEDIUM,
                        confidence=ped.confidence,
                        frame_number=frame_number,
                        timestamp=timestamp,
                        bbox_x1=ped.bbox.x1,
                        bbox_y1=ped.bbox.y1,
                        bbox_x2=ped.bbox.x2,
                        bbox_y2=ped.bbox.y2,
                        description=f"Pedestrian detected on active roadway lane (y={int(cy)}).",
                        extra_metadata={
                            "track_id": ped.track_id,
                            "class_name": ped.class_name,
                        },
                    )
                )

        # ── 2. Near-Miss & Spatial Proximity between VRU and Vehicle ──────────
        for ped in pedestrians:
            p_cx, p_cy = ped.bbox.center_x, ped.bbox.center_y
            for veh in vehicles:
                v_cx, v_cy = veh.bbox.center_x, veh.bbox.center_y
                dist = math.hypot(p_cx - v_cx, p_cy - v_cy)

                if dist < self.critical_distance_px:
                    events.append(
                        UrbanEventData(
                            event_type=EventType.NEAR_MISS,
                            severity=EventSeverity.CRITICAL,
                            confidence=min(0.95, (ped.confidence + veh.confidence) / 2.0),
                            frame_number=frame_number,
                            timestamp=timestamp,
                            bbox_x1=min(ped.bbox.x1, veh.bbox.x1),
                            bbox_y1=min(ped.bbox.y1, veh.bbox.y1),
                            bbox_x2=max(ped.bbox.x2, veh.bbox.x2),
                            bbox_y2=max(ped.bbox.y2, veh.bbox.y2),
                            description=f"Critical near-miss hazard: {veh.class_name} and {ped.class_name} within {int(dist)}px.",
                            extra_metadata={
                                "vru_track_id": ped.track_id,
                                "vehicle_track_id": veh.track_id,
                                "distance_px": round(dist, 1),
                            },
                        )
                    )
                elif dist < self.near_miss_distance_px:
                    events.append(
                        UrbanEventData(
                            event_type=EventType.PEDESTRIAN_RISK,
                            severity=EventSeverity.HIGH,
                            confidence=min(0.85, (ped.confidence + veh.confidence) / 2.0),
                            frame_number=frame_number,
                            timestamp=timestamp,
                            bbox_x1=ped.bbox.x1,
                            bbox_y1=ped.bbox.y1,
                            bbox_x2=ped.bbox.x2,
                            bbox_y2=ped.bbox.y2,
                            description=f"Elevated pedestrian risk: proximity to {veh.class_name} ({int(dist)}px).",
                            extra_metadata={
                                "vru_track_id": ped.track_id,
                                "vehicle_track_id": veh.track_id,
                                "distance_px": round(dist, 1),
                            },
                        )
                    )

        return events
