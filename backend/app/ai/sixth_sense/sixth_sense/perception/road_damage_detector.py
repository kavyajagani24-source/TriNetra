"""
Road Damage Detector — The Sixth Sense
Wraps RDD2022 pretrained YOLOv8 model (keremberke/yolov8-road-damage-detection).

CRITICAL: DO NOT use COCO YOLO for road damage detection.
          This module MUST use the specialized road-damage model.

NO DEPTH ESTIMATION. Only 2D visual features are used for severity.
"""
from __future__ import annotations
import logging
import time
import numpy as np
from typing import List, Dict, Any, Optional

from sixth_sense.schemas.urban_event import (
    Detection, EventType, ClassificationSource, QualityScore,
)

logger = logging.getLogger(__name__)

# RDD2022 class names → EventType mapping
# RDD2022 dataset classes (D00=longitudinal crack, D10=transverse crack,
# D20=alligator crack, D40=pothole)
_RDD_CLASS_MAP: Dict[str, EventType] = {
    "D00": EventType.ROAD_CRACK,       # Longitudinal crack
    "D10": EventType.ROAD_CRACK,       # Transverse crack
    "D20": EventType.ROAD_CRACK,       # Alligator/fatigue crack
    "D40": EventType.POTHOLE,          # Pothole
    "pothole": EventType.POTHOLE,
    "crack": EventType.ROAD_CRACK,
    "road_damage": EventType.ROAD_DAMAGE,
    "repair": EventType.ROAD_REPAIR,
    # Generic fallbacks if model uses different labels
    "0": EventType.ROAD_CRACK,
    "1": EventType.ROAD_CRACK,
    "2": EventType.ROAD_CRACK,
    "3": EventType.POTHOLE,
}


class RoadDamageDetector:
    """
    Specialized road damage detector using RDD2022 pretrained YOLOv8.

    Only uses 2D visual features for severity assessment:
      - bbox_area_px
      - relative_area (bbox / frame)
      - confidence
      - persistence across frames (handled by ObservationBuilder)

    Does NOT claim pothole depth or physical volume.
    """

    def __init__(
        self,
        model: Any,                    # From ModelRegistry — may be None
        conf_threshold: float = 0.35,
        per_class_thresholds: Optional[dict] = None,
        imgsz: int = 640,
        device: str = "cuda:0",
    ) -> None:
        self.model = model             # None → road damage disabled this run
        self.conf_threshold = conf_threshold
        # Per-class thresholds take priority over global threshold
        self._per_class = per_class_thresholds or {}
        self.imgsz = imgsz
        self.device = device
        self._model_name = "road_damage_rdd2022"
        self._disabled_warned = False

    @property
    def available(self) -> bool:
        return self.model is not None

    def detect(
        self,
        frame: np.ndarray,
        frame_idx: int,
        timestamp: float,
        quality: Optional[QualityScore],
        gps=None,
    ) -> List[Detection]:
        """
        Run road damage inference on a frame.

        Returns empty list (not an error) if model is disabled.
        """
        if self.model is None:
            if not self._disabled_warned:
                logger.warning(
                    "Road damage detector is disabled (model not loaded). "
                    "Road-damage observations will not be produced this run."
                )
                self._disabled_warned = True
            return []

        h, w = frame.shape[:2]
        frame_area = h * w
        conf_mult = quality.conf_multiplier if quality else 1.0

        results = self.model(
            frame,
            imgsz=self.imgsz,
            verbose=False,
            device=self.device,
        )

        detections: List[Detection] = []
        for result in results:
            names = result.names  # class index → name mapping
            for box in result.boxes:
                cls_id = int(box.cls[0])
                raw_class = names.get(cls_id, str(cls_id))
                raw_conf = float(box.conf[0])

                # Per-class threshold takes priority over global conf_threshold
                threshold = self._per_class.get(
                    raw_class,
                    self._per_class.get(str(cls_id), self.conf_threshold)
                )
                if raw_conf < threshold:
                    continue

                # Map to EventType — try exact name, then index string
                event_type = _RDD_CLASS_MAP.get(
                    raw_class,
                    _RDD_CLASS_MAP.get(str(cls_id), EventType.ROAD_DAMAGE)
                )

                x1, y1, x2, y2 = map(int, box.xyxy[0])
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)
                bbox_area = max(0, (x2 - x1) * (y2 - y1))
                rel_area = bbox_area / frame_area if frame_area > 0 else 0.0

                adj_conf = min(1.0, raw_conf * conf_mult)

                det = Detection(
                    det_id=Detection.make_id(),
                    frame_idx=frame_idx,
                    timestamp=timestamp,
                    event_type=event_type,
                    class_name=raw_class,
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

        return detections
