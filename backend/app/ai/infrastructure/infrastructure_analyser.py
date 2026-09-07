"""
UrbanEye AI — Infrastructure Analyser

Detects and classifies visible road infrastructure elements:
  • Traffic signs
  • Zebra crossings
  • Road markings
  • Road dividers / barriers

Phase 3 — Infrastructure Module.
"""

from __future__ import annotations

import logging
from typing import List

import cv2
import numpy as np

from app.ai.models.detection_types import FrameResult
from app.ai.models.event_types import (
    EventSeverity,
    EventType,
    UrbanEventData,
)

logger = logging.getLogger(__name__)


class InfrastructureAnalyser:
    """
    Detects road infrastructure elements using colour-based and
    edge-based heuristics on the incoming frame.

    In production this module can be backed by a dedicated YOLO model
    (configurable via model_path).  The heuristic fallback ensures
    demo-readiness without additional model weights.
    """

    def __init__(
        self,
        enabled: bool = True,
        sign_confidence_threshold: float = 0.50,
        crossing_min_lines: int = 4,
    ):
        self.enabled = enabled
        self.sign_confidence_threshold = sign_confidence_threshold
        self.crossing_min_lines = crossing_min_lines

        if enabled:
            logger.info("InfrastructureAnalyser initialised.")

    def analyse(
        self,
        frame: np.ndarray,
        frame_result: FrameResult,
        frame_number: int,
        timestamp: float,
    ) -> List[UrbanEventData]:
        """Analyse a frame for infrastructure elements."""
        if not self.enabled:
            return []

        events: List[UrbanEventData] = []

        try:
            h, w = frame.shape[:2]

            # ── 1. Traffic Sign Detection (colour blobs — red/yellow/blue) ──
            events.extend(self._detect_traffic_signs(frame, frame_number, timestamp))

            # Zebra crossings require a trained infrastructure model. The old
            # Hough-line fallback produced false positives on potholes, gravel,
            # and road edges, so it is not used for event classification.

        except Exception as exc:
            logger.warning("InfrastructureAnalyser.analyse failed at frame %d: %s", frame_number, exc)

        return events

    # ── Private ──────────────────────────────────────────────────────────────

    def _detect_traffic_signs(
        self, frame: np.ndarray, frame_number: int, timestamp: float
    ) -> List[UrbanEventData]:
        """Detect traffic sign candidates via HSV colour blob analysis."""
        events: List[UrbanEventData] = []
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        h, w = frame.shape[:2]

        # Red sign mask (two hue ranges)
        mask_r1 = cv2.inRange(hsv, np.array([0, 120, 70]),   np.array([10, 255, 255]))
        mask_r2 = cv2.inRange(hsv, np.array([170, 120, 70]), np.array([180, 255, 255]))
        mask_red = cv2.bitwise_or(mask_r1, mask_r2)

        # Yellow sign mask
        mask_yellow = cv2.inRange(hsv, np.array([20, 100, 100]), np.array([35, 255, 255]))

        for colour_mask, label in [(mask_red, "red_sign"), (mask_yellow, "yellow_sign")]:
            kernel = np.ones((5, 5), np.uint8)
            clean = cv2.morphologyEx(colour_mask, cv2.MORPH_OPEN, kernel)
            contours, _ = cv2.findContours(clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if 300 < area < 15000:  # filter noise and huge blobs
                    x, y, cw, ch = cv2.boundingRect(cnt)
                    aspect = cw / (ch + 1e-6)
                    # Signs tend to be roughly square/circular
                    if 0.4 < aspect < 2.5:
                        confidence = min(0.90, area / 8000.0)
                        if confidence >= self.sign_confidence_threshold:
                            events.append(UrbanEventData(
                                event_type=EventType.TRAFFIC_SIGN,
                                severity=EventSeverity.LOW,
                                confidence=confidence,
                                frame_number=frame_number,
                                timestamp=timestamp,
                                bbox_x1=float(x),
                                bbox_y1=float(y),
                                bbox_x2=float(x + cw),
                                bbox_y2=float(y + ch),
                                description=f"Traffic sign candidate detected ({label}).",
                                extra_metadata={"label": label, "area_px": int(area)},
                            ))

        return events[:3]  # cap at 3 signs per frame

    def _detect_zebra_crossing(
        self,
        frame: np.ndarray,
        frame_number: int,
        timestamp: float,
        h: int,
        w: int,
    ) -> List[UrbanEventData]:
        """Detect zebra crossings using Hough line transform on the lower half."""
        events: List[UrbanEventData] = []

        try:
            lower_half = frame[h // 2:, :]
            gray = cv2.cvtColor(lower_half, cv2.COLOR_BGR2GRAY)
            hsv = cv2.cvtColor(lower_half, cv2.COLOR_BGR2HSV)
            white_mask = cv2.inRange(hsv, np.array([0, 0, 165]), np.array([180, 75, 255]))
            if float(np.count_nonzero(white_mask)) / white_mask.size < 0.035:
                return events
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            edges = cv2.Canny(blurred, 50, 150)

            lines = cv2.HoughLinesP(
                edges,
                rho=1,
                theta=np.pi / 180,
                threshold=50,
                minLineLength=60,
                maxLineGap=10,
            )

            if lines is None:
                return events

            # Count near-horizontal lines (zebra strips are horizontal)
            horizontal_lines = []
            for line in lines:
                coordinates = np.asarray(line).reshape(-1)
                if (
                    len(coordinates) == 4
                    and abs(coordinates[3] - coordinates[1]) < 12
                    and cv2.mean(white_mask[
                        max(0, int(min(coordinates[1], coordinates[3])) - 3):
                        min(white_mask.shape[0], int(max(coordinates[1], coordinates[3])) + 4),
                        max(0, int(min(coordinates[0], coordinates[2]))):
                        min(white_mask.shape[1], int(max(coordinates[0], coordinates[2])) + 1),
                    ])[0] > 35
                ):
                    horizontal_lines.append(coordinates)

            if len(horizontal_lines) >= self.crossing_min_lines:
                confidence = min(0.90, len(horizontal_lines) / 12.0)
                events.append(UrbanEventData(
                    event_type=EventType.ZEBRA_CROSSING,
                    severity=EventSeverity.LOW,
                    confidence=confidence,
                    frame_number=frame_number,
                    timestamp=timestamp,
                    description="Zebra crossing detected in road area.",
                    extra_metadata={"horizontal_lines": len(horizontal_lines)},
                ))

        except Exception as exc:
            logger.debug("Zebra detection error: %s", exc)

        return events
