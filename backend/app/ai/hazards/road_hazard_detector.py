"""
UrbanEye AI — Road Hazard Detector

Detects road surface defects and hazards using a combination of:
1. YOLO object detection (if a specialised model is loaded)
2. Heuristic frame analysis (optical flow, brightness, texture) as fallback

Phase 3 — Hazard Module.
"""

from __future__ import annotations

import logging
from typing import List, Optional

import cv2
import numpy as np

from app.ai.models.detection_types import FrameResult, TrackedDetection
from app.ai.models.event_types import (
    EventSeverity,
    EventType,
    UrbanEventData,
)

logger = logging.getLogger(__name__)


def _confidence_to_severity(confidence: float) -> EventSeverity:
    """Map detection confidence to a severity level."""
    if confidence >= 0.85:
        return EventSeverity.CRITICAL
    elif confidence >= 0.70:
        return EventSeverity.HIGH
    elif confidence >= 0.55:
        return EventSeverity.MEDIUM
    return EventSeverity.LOW


class RoadHazardDetector:
    """
    Stateless road surface hazard detector.

    In production this module would load a dedicated YOLO model trained on
    pothole / road-damage datasets.  During hackathon / demo mode it uses a
    heuristic analyser on the lower-third of each frame (road area) combined
    with COCO-class debris-proxy detection.

    Graceful degradation: if OpenCV is unavailable, the module logs a warning
    and returns an empty list.
    """

    # COCO classes that can proxy road obstacles
    _OBSTACLE_PROXY_CLASSES = {"suitcase", "backpack", "umbrella", "sports ball"}

    def __init__(
        self,
        enabled: bool = True,
        confidence_threshold: float = 0.50,
        heuristic_sensitivity: float = 1.0,
    ):
        self.enabled = enabled
        self.confidence_threshold = confidence_threshold
        self.heuristic_sensitivity = heuristic_sensitivity
        self._prev_gray: Optional[np.ndarray] = None

        if enabled:
            logger.info("RoadHazardDetector initialised (heuristic mode)")

    def analyse(
        self,
        frame: np.ndarray,
        frame_result: FrameResult,
        frame_number: int,
        timestamp: float,
        video_width: int = 0,
        video_height: int = 0,
    ) -> List[UrbanEventData]:
        """
        Analyse a single frame for road hazards.

        Returns a (possibly empty) list of UrbanEventData events.
        """
        if not self.enabled:
            return []

        events: List[UrbanEventData] = []

        try:
            h, w = frame.shape[:2]

            # ── 1. Heuristic road-surface analysis ──────────────────────────
            events.extend(
                self._heuristic_road_analysis(frame, frame_number, timestamp, w, h)
            )

            # ── 2. Proxy obstacle detection from COCO classes ────────────────
            events.extend(
                self._detect_proxy_obstacles(
                    frame_result.tracked_detections, frame_number, timestamp
                )
            )

        except Exception as exc:
            logger.warning("RoadHazardDetector.analyse failed at frame %d: %s", frame_number, exc)

        return events

    # ── Private ──────────────────────────────────────────────────────────────

    def _heuristic_road_analysis(
        self,
        frame: np.ndarray,
        frame_number: int,
        timestamp: float,
        w: int,
        h: int,
    ) -> List[UrbanEventData]:
        """
        Analyse the lower-third of the frame (road surface) for texture anomalies
        using Laplacian variance as a proxy for surface roughness / potholes.
        """
        events: List[UrbanEventData] = []

        # Keep a broad road view, but exclude image borders where shadows and
        # dashboard artifacts commonly become one giant connected contour.
        roi_top = int(h * 0.12)
        roi_bottom = int(h * 0.85)
        roi_left = int(w * 0.05)
        roi_right = int(w * 0.95)
        road_region = frame[roi_top:roi_bottom, roi_left:roi_right]

        if road_region.size == 0:
            return events

        gray = cv2.cvtColor(road_region, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()

        threshold = 800 * self.heuristic_sensitivity
        blurred = cv2.GaussianBlur(gray, (11, 11), 0)
        dark_limit = max(45.0, min(110.0, float(np.percentile(blurred, 38))))
        dark_mask = cv2.inRange(blurred, 0, dark_limit)
        kernel = np.ones((11, 11), np.uint8)
        dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_CLOSE, kernel)
        dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_OPEN, kernel)
        contours, _ = cv2.findContours(dark_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        roi_area = float(gray.shape[0] * gray.shape[1])
        candidates = []
        for contour in contours:
            area = cv2.contourArea(contour)
            x, y, cw, ch = cv2.boundingRect(contour)
            fraction = area / roi_area
            aspect = cw / max(ch, 1)
            touches_border = (
                x <= 2 or y <= 2
                or x + cw >= gray.shape[1] - 2
                or y + ch >= gray.shape[0] - 2
            )
            if 0.02 <= fraction <= 0.55 and 0.30 <= aspect <= 5.0 and not touches_border:
                candidates.append((area, x, y, cw, ch))

        # Water-filled potholes often fragment into several dark components.
        # Group lower-road components into one defect box instead of dropping them.
        if not candidates:
            fragments = []
            for contour in contours:
                area = cv2.contourArea(contour)
                x, y, cw, ch = cv2.boundingRect(contour)
                if (
                    area / roi_area >= 0.001
                    and y > gray.shape[0] * 0.55
                    and x > gray.shape[1] * 0.08
                    and x + cw < gray.shape[1] * 0.92
                ):
                    fragments.append((x, y, x + cw, y + ch, area))
            if len(fragments) >= 2:
                candidates.append((
                    sum(fragment[4] for fragment in fragments),
                    min(fragment[0] for fragment in fragments),
                    min(fragment[1] for fragment in fragments),
                    max(fragment[2] for fragment in fragments) - min(fragment[0] for fragment in fragments),
                    max(fragment[3] for fragment in fragments) - min(fragment[1] for fragment in fragments),
                ))

        if candidates:
            _, rx, ry, rw, rh = max(candidates, key=lambda item: item[0])
            fx1 = roi_left + rx
            fx2 = roi_left + rx + rw
            fy1 = roi_top + ry
            fy2 = roi_top + ry + rh
            patch = gray[ry:ry + rh, rx:rx + rw]
            contrast = max(0.0, (float(np.mean(gray)) - float(np.mean(patch))) / 80.0)
            compactness = min(1.0, (rw * rh) / (gray.shape[1] * gray.shape[0] * 0.35))
            confidence = min(0.92, 0.48 + contrast * 0.25 + compactness * 0.12)
            events.append(UrbanEventData(
                event_type=EventType.POTHOLE,
                severity=_confidence_to_severity(confidence),
                confidence=confidence,
                frame_number=frame_number,
                timestamp=timestamp,
                bbox_x1=float(fx1),
                bbox_y1=float(fy1),
                bbox_x2=float(fx2),
                bbox_y2=float(fy2),
                description="Road texture anomaly detected — possible pothole or surface damage.",
                extra_metadata={"laplacian_var": round(laplacian_var, 2), "dark_limit": round(dark_limit, 2)},
            ))

        # Optical-flow based waterlogging: bright, low-texture patches
        gray_full = cv2.cvtColor(frame[int(h * 0.70):, :], cv2.COLOR_BGR2GRAY)
        mean_brightness = float(np.mean(gray_full))
        if mean_brightness > 220 and laplacian_var < threshold * 0.35:
            confidence = min(0.80, mean_brightness / 255.0)
            events.append(UrbanEventData(
                event_type=EventType.WATERLOGGING,
                severity=EventSeverity.MEDIUM,
                confidence=confidence,
                frame_number=frame_number,
                timestamp=timestamp,
                description="Bright low-texture road surface — possible waterlogging or wet road.",
                extra_metadata={"mean_brightness": round(mean_brightness, 1)},
            ))

        return events

    def _detect_proxy_obstacles(
        self,
        tracked: list,
        frame_number: int,
        timestamp: float,
    ) -> List[UrbanEventData]:
        """
        Use COCO tracked detections to infer road obstacles.
        Any stationary non-vehicle object on the road is flagged.
        """
        events: List[UrbanEventData] = []
        for td in tracked:
            if td.class_name in self._OBSTACLE_PROXY_CLASSES and td.confidence >= self.confidence_threshold:
                events.append(UrbanEventData(
                    event_type=EventType.ROAD_OBSTACLE,
                    severity=EventSeverity.MEDIUM,
                    confidence=td.confidence,
                    frame_number=frame_number,
                    timestamp=timestamp,
                    bbox_x1=td.bbox.x1,
                    bbox_y1=td.bbox.y1,
                    bbox_x2=td.bbox.x2,
                    bbox_y2=td.bbox.y2,
                    description=f"Road obstacle detected: {td.class_name}.",
                    extra_metadata={"class_name": td.class_name, "track_id": td.track_id},
                ))
        return events
