"""
UrbanEye AI — YOLO Object Detector

Wraps Ultralytics YOLO (v11/v8) to provide clean object detection
and integrated ByteTrack tracking on individual video frames.
"""

from __future__ import annotations

import logging
from typing import Any, List, Optional, Set

import numpy as np

from app.ai.models.detection_types import (
    ALL_TARGET_CLASSES,
    COCO_TRAFFIC_CLASSES,
    BoundingBox,
    Detection,
    TrackedDetection,
)

logger = logging.getLogger(__name__)


class YOLODetector:
    """
    Object detector and tracker wrapping Ultralytics YOLO.
    """

    def __init__(
        self,
        model_name: str = "yolo11n.pt",
        confidence_threshold: float = 0.40,
        iou_threshold: float = 0.50,
        device: str = "cpu",
        target_classes: Optional[Set[str]] = None,
        tracker_type: str = "bytetrack.yaml",
    ):
        self.model_name = model_name
        self.confidence_threshold = confidence_threshold
        self.iou_threshold = iou_threshold
        self.device = self._resolve_device(device)
        self.tracker_type = (
            f"{tracker_type}.yaml" if not tracker_type.endswith(".yaml") else tracker_type
        )
        self.target_classes = target_classes or ALL_TARGET_CLASSES

        # Filter target class IDs from COCO
        self.target_class_ids = [
            cid for cid, name in COCO_TRAFFIC_CLASSES.items()
            if name in self.target_classes
        ]

        self._model: Any = None

    @staticmethod
    def _resolve_device(device: str) -> str:
        if device.lower() != "auto":
            return device
        try:
            import torch
            return "cuda:0" if torch.cuda.is_available() else "cpu"
        except ImportError:
            return "cpu"

    def _ensure_model_loaded(self) -> Any:
        """Lazy load the YOLO model."""
        if self._model is None:
            logger.info("Loading YOLO model: %s on device: %s", self.model_name, self.device)
            from ultralytics import YOLO
            self._model = YOLO(self.model_name)
        return self._model

    def detect(self, frame: np.ndarray) -> List[Detection]:
        """
        Run raw detection without tracking.
        """
        if frame is None or frame.size == 0:
            return []

        model = self._ensure_model_loaded()
        results = model.predict(
            source=frame,
            conf=self.confidence_threshold,
            iou=self.iou_threshold,
            classes=self.target_class_ids,
            device=self.device,
            verbose=False,
        )

        detections: List[Detection] = []
        if not results:
            return detections

        res = results[0]
        if res.boxes is None or len(res.boxes) == 0:
            return detections

        boxes = res.boxes.xyxy.cpu().numpy()
        confs = res.boxes.conf.cpu().numpy()
        class_ids = res.boxes.cls.cpu().numpy().astype(int)

        for box, conf, cid in zip(boxes, confs, class_ids):
            class_name = COCO_TRAFFIC_CLASSES.get(cid, str(cid))
            if class_name not in self.target_classes:
                continue

            bbox = BoundingBox(
                x1=float(box[0]),
                y1=float(box[1]),
                x2=float(box[2]),
                y2=float(box[3]),
            )
            detections.append(
                Detection(
                    bbox=bbox,
                    class_id=int(cid),
                    class_name=class_name,
                    confidence=float(conf),
                )
            )

        return detections

    def detect_and_track(self, frame: np.ndarray, persist: bool = True) -> List[TrackedDetection]:
        """
        Run detection and ByteTrack tracking simultaneously.
        """
        if frame is None or frame.size == 0:
            return []

        model = self._ensure_model_loaded()
        results = model.track(
            source=frame,
            conf=self.confidence_threshold,
            iou=self.iou_threshold,
            classes=self.target_class_ids,
            device=self.device,
            tracker=self.tracker_type,
            persist=persist,
            verbose=False,
        )

        tracked_detections: List[TrackedDetection] = []
        if not results:
            return tracked_detections

        res = results[0]
        if res.boxes is None or len(res.boxes) == 0:
            return tracked_detections

        boxes = res.boxes.xyxy.cpu().numpy()
        confs = res.boxes.conf.cpu().numpy()
        class_ids = res.boxes.cls.cpu().numpy().astype(int)
        track_ids = (
            res.boxes.id.int().cpu().tolist()
            if res.boxes.id is not None
            else [-1] * len(boxes)
        )

        for box, conf, cid, tid in zip(boxes, confs, class_ids, track_ids):
            class_name = COCO_TRAFFIC_CLASSES.get(cid, str(cid))
            if class_name not in self.target_classes:
                continue

            bbox = BoundingBox(
                x1=float(box[0]),
                y1=float(box[1]),
                x2=float(box[2]),
                y2=float(box[3]),
            )
            tracked_detections.append(
                TrackedDetection(
                    bbox=bbox,
                    class_id=int(cid),
                    class_name=class_name,
                    confidence=float(conf),
                    track_id=int(tid) if tid is not None else -1,
                )
            )

        return tracked_detections

    def reset_tracker(self) -> None:
        """Reset internal tracker state if supported by the underlying model."""
        if self._model is not None and hasattr(self._model, "predictor"):
            if hasattr(self._model.predictor, "trackers"):
                self._model.predictor.trackers = []
