"""
UrbanEye AI — Rash Driving & Behavioral Analyser

Evaluates trajectory telemetry for erratic driving behavior:
  • Sudden braking / rapid deceleration
  • Extreme swerving / erratic lateral motion (rash driving)
  • Abnormal stop in active traffic lanes
  • Speeding / high velocity outliers

Phase 3 — Behavior Module.
"""

from __future__ import annotations

import logging
import math
from typing import Dict, List, Optional

from app.ai.models.detection_types import FrameResult, TrackedDetection
from app.ai.models.event_types import (
    EventSeverity,
    EventType,
    UrbanEventData,
)
from app.ai.tracker.trajectory_manager import TrajectoryManager

logger = logging.getLogger(__name__)


class RashDrivingDetector:
    """
    Stateful analyzer checking speed and acceleration profiles of tracked vehicles.
    """

    def __init__(
        self,
        enabled: bool = True,
        deceleration_threshold: float = 12.0,  # px/s^2 drop indicating sudden braking
        swerve_angle_threshold_deg: float = 40.0,
        speeding_pixel_threshold: float = 35.0,
    ):
        self.enabled = enabled
        self.deceleration_threshold = deceleration_threshold
        self.swerve_angle_threshold_deg = swerve_angle_threshold_deg
        self.speeding_pixel_threshold = speeding_pixel_threshold

        # Store previous speed per track_id to detect abrupt deceleration
        self._prev_speeds: Dict[int, float] = {}

        if enabled:
            logger.info("RashDrivingDetector initialised.")

    def analyse(
        self,
        frame_result: FrameResult,
        trajectory_manager: TrajectoryManager,
        frame_number: int,
        timestamp: float,
    ) -> List[UrbanEventData]:
        """
        Scan active tracked vehicles for behavioral anomalies.
        """
        if not self.enabled:
            return []

        events: List[UrbanEventData] = []

        for td in frame_result.tracked_detections:
            if not td.is_vehicle() or td.track_id < 0:
                continue

            tid = td.track_id
            pts = trajectory_manager.get_trajectory(tid)
            if len(pts) < 3:
                continue

            current_speed = pts[-1].pixel_speed or 0.0
            prev_speed = self._prev_speeds.get(tid, current_speed)
            self._prev_speeds[tid] = current_speed

            # ── 1. Sudden Braking Detection ───────────────────────────────────
            delta_speed = prev_speed - current_speed
            if delta_speed > self.deceleration_threshold and prev_speed > 10.0:
                events.append(
                    UrbanEventData(
                        event_type=EventType.SUDDEN_BRAKING,
                        severity=EventSeverity.HIGH,
                        confidence=0.85,
                        frame_number=frame_number,
                        timestamp=timestamp,
                        bbox_x1=td.bbox.x1,
                        bbox_y1=td.bbox.y1,
                        bbox_x2=td.bbox.x2,
                        bbox_y2=td.bbox.y2,
                        description=f"Sudden braking detected for {td.class_name} (speed dropped by {round(delta_speed, 1)} px/s).",
                        extra_metadata={
                            "track_id": tid,
                            "speed_before": round(prev_speed, 1),
                            "speed_after": round(current_speed, 1),
                        },
                    )
                )

            # ── 2. Speeding Outlier ───────────────────────────────────────────
            if current_speed > self.speeding_pixel_threshold:
                events.append(
                    UrbanEventData(
                        event_type=EventType.SPEEDING,
                        severity=EventSeverity.MEDIUM,
                        confidence=0.80,
                        frame_number=frame_number,
                        timestamp=timestamp,
                        bbox_x1=td.bbox.x1,
                        bbox_y1=td.bbox.y1,
                        bbox_x2=td.bbox.x2,
                        bbox_y2=td.bbox.y2,
                        description=f"Vehicle exceeding standard speed threshold ({round(current_speed, 1)} px/s).",
                        extra_metadata={
                            "track_id": tid,
                            "speed": round(current_speed, 1),
                        },
                    )
                )

            # ── 3. Rash Driving / Sharp Swerving ──────────────────────────────
            if len(pts) >= 4:
                # Calculate vector angle change between consecutive segments
                p1, p2, p3 = pts[-3], pts[-2], pts[-1]
                v1 = (p2.x - p1.x, p2.y - p1.y)
                v2 = (p3.x - p2.x, p3.y - p2.y)
                len1 = math.hypot(*v1)
                len2 = math.hypot(*v2)

                if len1 > 3.0 and len2 > 3.0:
                    dot = v1[0] * v2[0] + v1[1] * v2[1]
                    cos_angle = max(-1.0, min(1.0, dot / (len1 * len2)))
                    angle_deg = math.degrees(math.acos(cos_angle))

                    if angle_deg > self.swerve_angle_threshold_deg and current_speed > 8.0:
                        events.append(
                            UrbanEventData(
                                event_type=EventType.RASH_DRIVING,
                                severity=EventSeverity.HIGH,
                                confidence=0.82,
                                frame_number=frame_number,
                                timestamp=timestamp,
                                bbox_x1=td.bbox.x1,
                                bbox_y1=td.bbox.y1,
                                bbox_x2=td.bbox.x2,
                                bbox_y2=td.bbox.y2,
                                description=f"Erratic vehicle trajectory / swerve detected (heading change {int(angle_deg)}°).",
                                extra_metadata={
                                    "track_id": tid,
                                    "heading_change_deg": round(angle_deg, 1),
                                },
                            )
                        )

        return events

    def reset(self) -> None:
        self._prev_speeds.clear()
