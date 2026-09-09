"""
Annotated Writer — The Sixth Sense
Streaming annotated video writer using cv2.VideoWriter.
Adapted from TCE Compressor._annotate_frame pattern — extended for urban intelligence.
Never loads the full video into RAM.
"""
from __future__ import annotations
import cv2
import numpy as np
import logging
import os
from pathlib import Path
from typing import List, Optional, Tuple, Dict

from sixth_sense.schemas.urban_event import Detection, Track, Observation, SeverityTier, EventType

logger = logging.getLogger(__name__)

# Color palette (BGR)
_COLORS: Dict[str, Tuple[int, int, int]] = {
    "vehicle":      (50, 205, 50),     # Green
    "pedestrian":   (0, 220, 255),     # Yellow
    "cyclist":      (255, 180, 0),     # Blue-orange
    "road_damage":  (0, 0, 230),       # Red
    "pothole":      (0, 0, 255),       # Bright red
    "road_crack":   (0, 80, 200),      # Dark red
    "waterlogging": (220, 140, 0),     # Blue
    "garbage":      (180, 0, 180),     # Purple
    "unknown":      (180, 180, 180),   # Grey
}

_SEVERITY_COLORS: Dict[SeverityTier, Tuple[int, int, int]] = {
    SeverityTier.LOW:      (0, 200, 0),
    SeverityTier.MEDIUM:   (0, 165, 255),
    SeverityTier.HIGH:     (0, 0, 255),
    SeverityTier.CRITICAL: (0, 0, 180),
    SeverityTier.UNKNOWN:  (180, 180, 180),
}

_ROAD_DAMAGE_TYPES = {
    EventType.POTHOLE, EventType.ROAD_CRACK,
    EventType.ROAD_DAMAGE, EventType.WATERLOGGING,
    EventType.GARBAGE, EventType.ROAD_REPAIR,
}


class AnnotatedWriter:
    """
    Streaming annotated video writer.
    Call write_frame() once per processed frame; call close() at end.
    """

    def __init__(
        self,
        output_path: str,
        width: int,
        height: int,
        fps: float,
    ) -> None:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        self._writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        if not self._writer.isOpened():
            raise IOError(f"Cannot open VideoWriter at {output_path}")
        self.output_path = output_path
        self._frame_count = 0
        logger.info("AnnotatedWriter opened: %s (%dx%d @ %.0ffps)", output_path, width, height, fps)

    def write_frame(
        self,
        frame: np.ndarray,
        detections: List[Detection],
        active_tracks: List[Track],
        frame_idx: int,
        timestamp: float,
        gps_str: Optional[str] = None,
        quality_ok: bool = True,
    ) -> None:
        """Draw overlays and write frame to output video."""
        annotated = frame.copy()
        h, w = annotated.shape[:2]

        # ── Detection bounding boxes ─────────────────────────────────── #
        for det in detections:
            x1, y1, x2, y2 = det.bbox
            color = self._det_color(det)
            thickness = 3 if det.event_type in _ROAD_DAMAGE_TYPES else 2
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, thickness)

            label = f"{det.class_name} {det.confidence:.2f}"
            if det.event_type in _ROAD_DAMAGE_TYPES:
                label = f"⚠ {label}"
            self._put_label(annotated, label, x1, y1, color)

        # ── Track trajectories (vehicle paths) ──────────────────────── #
        for track in active_tracks:
            if len(track.trajectory) >= 2:
                pts = np.array(track.trajectory, dtype=np.int32)
                cv2.polylines(annotated, [pts], False, (0, 255, 200), 1)
            if track.latest_bbox:
                x1, y1, x2, y2 = track.latest_bbox
                tid_label = f"T{track.track_id}:{track.class_name}"
                self._put_label(annotated, tid_label, x1, y2 + 2, (0, 255, 200))

        # ── HUD overlay (top-left) ───────────────────────────────────── #
        hud_lines = [
            f"Frame: {frame_idx} | T: {timestamp:.1f}s",
            f"Det: {len(detections)} | Trk: {len(active_tracks)}",
        ]
        if gps_str:
            hud_lines.append(f"GPS: {gps_str}")
        if not quality_ok:
            hud_lines.append("! LOW QUALITY FRAME")

        for i, line in enumerate(hud_lines):
            cv2.putText(
                annotated, line, (10, 25 + i * 22),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2,
            )

        self._writer.write(annotated)
        self._frame_count += 1

    def close(self) -> None:
        self._writer.release()
        logger.info("AnnotatedWriter closed: %d frames → %s", self._frame_count, self.output_path)

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _det_color(det: Detection) -> Tuple[int, int, int]:
        if det.event_type in _ROAD_DAMAGE_TYPES:
            return _COLORS.get("road_damage", (0, 0, 255))
        name = det.class_name.lower()
        if name in ("car", "bus", "truck", "motorcycle", "auto_rickshaw"):
            return _COLORS["vehicle"]
        if name == "person":
            return _COLORS["pedestrian"]
        if name == "bicycle":
            return _COLORS["cyclist"]
        return _COLORS.get(name, _COLORS["unknown"])

    @staticmethod
    def _put_label(
        img: np.ndarray,
        text: str,
        x: int,
        y: int,
        color: Tuple[int, int, int],
    ) -> None:
        """Draw a label with dark background for readability."""
        font = cv2.FONT_HERSHEY_SIMPLEX
        scale, thickness = 0.55, 2
        (tw, th), _ = cv2.getTextSize(text, font, scale, thickness)
        y0 = max(y - th - 4, 0)
        cv2.rectangle(img, (x, y0), (x + tw + 4, y + 2), (0, 0, 0), -1)
        cv2.putText(img, text, (x + 2, y - 2), font, scale, color, thickness)
