"""
Vehicle Detector — The Sixth Sense
Wraps the YOLO general detector (YOLO11x / configurable).
Maps COCO class names to urban EventType taxonomy.
Auto-rickshaw: not in COCO — marked as INFERRED with heuristic, never as DETECTED.
"""
from __future__ import annotations
import logging
import time
import uuid
import numpy as np
from typing import List, Dict, Any, Optional, Tuple

from sixth_sense.schemas.urban_event import (
    Detection, EventType, ClassificationSource, QualityScore,
)

logger = logging.getLogger(__name__)

# COCO class names → EventType mapping
# Only classes relevant to urban road intelligence are mapped.
_COCO_TO_EVENT: Dict[str, EventType] = {
    "car":          EventType.VEHICLE,
    "bus":          EventType.VEHICLE,
    "truck":        EventType.VEHICLE,
    "motorcycle":   EventType.VEHICLE,
    "bicycle":      EventType.CYCLIST,
    "person":       EventType.PEDESTRIAN,
    "traffic light": EventType.TRAFFIC_SIGN,
    "stop sign":    EventType.TRAFFIC_SIGN,
}

# COCO classes that are relevant (all others skipped)
_RELEVANT_CLASSES = set(_COCO_TO_EVENT.keys())

# Aspect-ratio bounds for auto-rickshaw heuristic
# A three-wheeler typically has width > height in frontal view
_AUTORICKSHAW_ASPECT_MIN = 0.9   # width/height ratio lower bound
_AUTORICKSHAW_ASPECT_MAX = 2.5
_AUTORICKSHAW_AREA_MIN_REL = 0.005  # must be at least 0.5% of frame


class VehicleDetector:
    """
    General object detector for vehicles, pedestrians, cyclists.

    Wraps the YOLO general model from ModelRegistry.
    Per-class confidence thresholds applied here (not inside YOLO).
    """

    def __init__(
        self,
        model: Any,                          # YOLO model from ModelRegistry
        conf_thresholds: Dict[str, float],
        imgsz: int = 1280,
        device: str = "cuda:0",
        enable_autorickshaw_heuristic: bool = True,
    ) -> None:
        self.model = model
        self.conf_thresholds = conf_thresholds
        self.imgsz = imgsz
        self.device = device
        self.enable_autorickshaw = enable_autorickshaw_heuristic
        self._model_name = "general_detector"

    def detect(
        self,
        frame: np.ndarray,
        frame_idx: int,
        timestamp: float,
        quality: Optional[QualityScore],
        gps=None,
    ) -> List[Detection]:
        """
        Run inference and return filtered Detection objects.

        Args:
            frame: BGR image
            frame_idx: absolute frame index in video
            timestamp: video timestamp in seconds
            quality: QualityScore for this frame (used for conf_multiplier)
            gps: GPSPoint or None

        Returns:
            List of Detection objects (already quality-adjusted)
        """
        h, w = frame.shape[:2]
        frame_area = h * w
        conf_mult = quality.conf_multiplier if quality else 1.0

        t0 = time.perf_counter()
        results = self.model(
            frame,
            imgsz=self.imgsz,
            verbose=False,
            device=self.device,
        )
        _ = time.perf_counter() - t0  # inference time (captured in metrics reporter)

        detections: List[Detection] = []
        autorickshaw_candidates: List[Detection] = []

        for result in results:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                class_name: str = result.names[cls_id]

                if class_name not in _RELEVANT_CLASSES:
                    continue

                raw_conf = float(box.conf[0])
                threshold = self.conf_thresholds.get(class_name, 0.40)
                if raw_conf < threshold:
                    continue

                x1, y1, x2, y2 = map(int, box.xyxy[0])
                # Clamp to frame bounds
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)
                bbox_area = max(0, (x2 - x1) * (y2 - y1))
                rel_area = bbox_area / frame_area if frame_area > 0 else 0.0

                adj_conf = min(1.0, raw_conf * conf_mult)
                event_type = _COCO_TO_EVENT[class_name]

                det = Detection(
                    det_id=Detection.make_id(),
                    frame_idx=frame_idx,
                    timestamp=timestamp,
                    event_type=event_type,
                    class_name=class_name,
                    classification_source=ClassificationSource.DETECTED,
                    raw_confidence=round(raw_conf, 4),
                    confidence=round(adj_conf, 4),
                    bbox=(x1, y1, x2, y2),
                    bbox_area_px=bbox_area,
                    relative_area=round(rel_area, 6),
                    frame_width=w,
                    frame_height=h,
                    gps=gps,
                    quality=quality,
                    model_name=self._model_name,
                )
                detections.append(det)

                # Collect motorcycle detections for auto-rickshaw heuristic
                if class_name == "motorcycle" and self.enable_autorickshaw:
                    autorickshaw_candidates.append(det)

        # Auto-rickshaw heuristic — applied AFTER main detection loop
        if self.enable_autorickshaw:
            for det in autorickshaw_candidates:
                x1, y1, x2, y2 = det.bbox
                bw = x2 - x1
                bh = y2 - y1
                if bh == 0:
                    continue
                aspect = bw / bh
                if (
                    _AUTORICKSHAW_ASPECT_MIN <= aspect <= _AUTORICKSHAW_ASPECT_MAX
                    and det.relative_area >= _AUTORICKSHAW_AREA_MIN_REL
                ):
                    # Reclassify as inferred auto-rickshaw
                    # NOTE: This replaces the motorcycle detection, not adds to it
                    det.class_name = "auto_rickshaw"
                    det.classification_source = ClassificationSource.INFERRED
                    det.event_type = EventType.VEHICLE
                    # Reduce confidence to reflect heuristic nature
                    det.confidence = round(det.confidence * 0.75, 4)
                    det.raw_confidence = round(det.raw_confidence * 0.75, 4)

        return detections
