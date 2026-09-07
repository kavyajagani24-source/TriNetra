"""
UrbanEye AI — Video Annotator

Draws bounding boxes, track IDs, trajectory trails, and a real-time HUD
telemetry dashboard onto video frames using OpenCV.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

from app.ai.models.detection_types import (
    CongestionLevel,
    DensityLevel,
    TrackedDetection,
    TrajectoryPoint,
)
from app.ai.models.event_types import UrbanEventData

# Harmonious BGR colors for annotations
CLASS_COLORS_BGR: Dict[str, Tuple[int, int, int]] = {
    "car": (255, 140, 0),         # Vibrant Deep Sky Blue in BGR
    "motorcycle": (0, 165, 255),  # Orange
    "bus": (50, 205, 50),         # Lime / Green
    "truck": (211, 0, 148),       # Purple / Violet
    "person": (0, 215, 255),      # Gold / Yellow
    "bicycle": (238, 130, 238),   # Violet
}
DEFAULT_COLOR_BGR = (200, 200, 200)

DENSITY_COLORS_BGR: Dict[DensityLevel, Tuple[int, int, int]] = {
    DensityLevel.LOW: (50, 205, 50),       # Green
    DensityLevel.MEDIUM: (0, 215, 255),    # Yellow
    DensityLevel.HIGH: (0, 140, 255),      # Orange
    DensityLevel.SEVERE: (0, 0, 255),      # Red
}

CONGESTION_COLORS_BGR: Dict[CongestionLevel, Tuple[int, int, int]] = {
    CongestionLevel.LOW: (50, 205, 50),
    CongestionLevel.MODERATE: (0, 215, 255),
    CongestionLevel.HIGH: (0, 140, 255),
    CongestionLevel.SEVERE: (0, 0, 255),
}


class VideoAnnotator:
    """
    Renders visual detections, tracking trails, and HUD telemetry onto video frames.
    """

    def __init__(self, draw_trajectories: bool = True):
        self.draw_trajectories = draw_trajectories

    def annotate_frame(
        self,
        frame: np.ndarray,
        tracked_detections: List[TrackedDetection],
        urban_events: Optional[List[UrbanEventData]] = None,
        trajectories: Optional[Dict[int, List[TrajectoryPoint]]] = None,
        frame_number: int = 0,
        timestamp: float = 0.0,
        active_vehicle_count: int = 0,
        density_level: DensityLevel = DensityLevel.LOW,
        congestion_level: CongestionLevel = CongestionLevel.LOW,
    ) -> np.ndarray:
        """
        Produce a copy of the input frame with bounding boxes, badges, trajectories, and HUD overlay.
        """
        annotated = frame.copy()
        h, w = annotated.shape[:2]

        # 1. Draw trajectories if enabled
        if self.draw_trajectories and trajectories:
            for det in tracked_detections:
                tid = det.track_id
                if tid in trajectories:
                    pts = trajectories[tid]
                    if len(pts) > 1:
                        color = CLASS_COLORS_BGR.get(det.class_name, DEFAULT_COLOR_BGR)
                        for i in range(1, len(pts)):
                            pt1 = (int(pts[i - 1].x), int(pts[i - 1].y))
                            pt2 = (int(pts[i].x), int(pts[i].y))
                            # Fading alpha or simple thickness
                            cv2.line(annotated, pt1, pt2, color, 2, cv2.LINE_AA)

        # 2. Draw bounding boxes and labels
        for det in tracked_detections:
            color = CLASS_COLORS_BGR.get(det.class_name, DEFAULT_COLOR_BGR)
            x1, y1, x2, y2 = det.bbox.to_int_tuple()

            # Bounding box
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2, cv2.LINE_AA)

            # Label badge
            label = (
                f"#{det.track_id} {det.class_name} {det.confidence:.2f}"
                if det.track_id >= 0
                else f"{det.class_name} {det.confidence:.2f}"
            )
            (lw, lh), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)

            # Badge background
            badge_y1 = max(0, y1 - lh - baseline - 4)
            badge_y2 = y1
            cv2.rectangle(
                annotated,
                (x1, badge_y1),
                (x1 + lw + 6, badge_y2),
                color,
                -1,
            )
            # Text on badge (dark text if bright color)
            cv2.putText(
                annotated,
                label,
                (x1 + 3, badge_y2 - baseline - 1),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 0, 0),
                1,
                cv2.LINE_AA,
            )

        # Draw event boxes separately so hazards remain visually distinct from YOLO objects.
        for event in urban_events or []:
            if None in (event.bbox_x1, event.bbox_y1, event.bbox_x2, event.bbox_y2):
                continue
            x1, y1 = int(event.bbox_x1), int(event.bbox_y1)
            x2, y2 = int(event.bbox_x2), int(event.bbox_y2)
            color = (0, 0, 255)
            label = f"EVENT: {event.event_type.value} {event.confidence:.2f}"
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 3, cv2.LINE_AA)
            (lw, lh), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
            badge_y1 = max(0, y1 - lh - baseline - 4)
            cv2.rectangle(annotated, (x1, badge_y1), (x1 + lw + 6, y1), color, -1)
            cv2.putText(
                annotated,
                label,
                (x1 + 3, y1 - baseline - 1),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (255, 255, 255),
                1,
                cv2.LINE_AA,
            )

        # 3. Draw Top HUD Banner
        hud_height = 42
        hud_overlay = annotated.copy()
        cv2.rectangle(hud_overlay, (0, 0), (w, hud_height), (20, 20, 20), -1)
        # 60% opacity blend
        cv2.addWeighted(hud_overlay, 0.75, annotated, 0.25, 0, annotated)

        # HUD Text items
        hud_text_items = [
            f"FRAME: {frame_number}",
            f"TIME: {timestamp:.1f}s",
            f"ACTIVE VEHICLES: {active_vehicle_count}",
        ]
        curr_x = 15
        for item in hud_text_items:
            cv2.putText(
                annotated,
                item,
                (curr_x, 26),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (240, 240, 240),
                1,
                cv2.LINE_AA,
            )
            (tw, _), _ = cv2.getTextSize(item, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
            curr_x += tw + 25

        # Density Pill
        density_color = DENSITY_COLORS_BGR.get(density_level, DEFAULT_COLOR_BGR)
        density_label = f"DENSITY: {density_level.value}"
        (dw, dh), _ = cv2.getTextSize(density_label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(
            annotated,
            (curr_x, 10),
            (curr_x + dw + 12, 32),
            density_color,
            -1,
        )
        cv2.putText(
            annotated,
            density_label,
            (curr_x + 6, 26),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (0, 0, 0),
            1,
            cv2.LINE_AA,
        )
        curr_x += dw + 25

        # Congestion Pill
        congestion_color = CONGESTION_COLORS_BGR.get(congestion_level, DEFAULT_COLOR_BGR)
        congestion_label = f"CONGESTION: {congestion_level.value}"
        (cw, ch), _ = cv2.getTextSize(congestion_label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(
            annotated,
            (curr_x, 10),
            (curr_x + cw + 12, 32),
            congestion_color,
            -1,
        )
        cv2.putText(
            annotated,
            congestion_label,
            (curr_x + 6, 26),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (0, 0, 0),
            1,
            cv2.LINE_AA,
        )

        return annotated

    @staticmethod
    def create_video_writer(
        output_path: str,
        fps: float,
        width: int,
        height: int,
        codec: str = "mp4v",
    ) -> cv2.VideoWriter:
        """Create an OpenCV VideoWriter."""
        fourcc = cv2.VideoWriter_fourcc(*codec)
        return cv2.VideoWriter(output_path, fourcc, fps, (width, height))
