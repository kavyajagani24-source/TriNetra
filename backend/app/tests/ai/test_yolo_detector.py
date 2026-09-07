"""
Unit tests for YOLO detector wrapper with mocked Ultralytics model.
"""

from unittest.mock import MagicMock, patch

import numpy as np
import pytest
import torch

from app.ai.detector.yolo_detector import YOLODetector


def test_yolo_detector_mocked_detection():
    detector = YOLODetector(confidence_threshold=0.3, iou_threshold=0.4)

    # Synthetic frame (black image)
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)

    # Mock ultralytics YOLO prediction output
    mock_box = MagicMock()
    mock_box.__len__.return_value = 1
    mock_box.xyxy = torch.tensor([[50.0, 60.0, 150.0, 200.0]])
    mock_box.conf = torch.tensor([0.88])
    mock_box.cls = torch.tensor([2])  # class 2 = car in COCO
    mock_box.id = None

    mock_result = MagicMock()
    mock_result.boxes = mock_box

    mock_model = MagicMock()
    mock_model.predict.return_value = [mock_result]
    detector._model = mock_model

    detections = detector.detect(dummy_frame)
    assert len(detections) == 1
    det = detections[0]
    assert det.class_name == "car"
    assert det.confidence == pytest.approx(0.88, abs=1e-3)
    assert det.bbox.x1 == 50.0
    assert det.bbox.y1 == 60.0


def test_yolo_detector_mocked_tracking():
    detector = YOLODetector()

    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)

    # Mock ultralytics YOLO tracking output
    mock_box = MagicMock()
    mock_box.__len__.return_value = 1
    mock_box.xyxy = torch.tensor([[100.0, 100.0, 250.0, 300.0]])
    mock_box.conf = torch.tensor([0.92])
    mock_box.cls = torch.tensor([5])  # class 5 = bus in COCO
    mock_box.id = torch.tensor([17])   # track id = 17

    mock_result = MagicMock()
    mock_result.boxes = mock_box

    mock_model = MagicMock()
    mock_model.track.return_value = [mock_result]
    detector._model = mock_model

    tracked = detector.detect_and_track(dummy_frame)
    assert len(tracked) == 1
    t = tracked[0]
    assert t.class_name == "bus"
    assert t.track_id == 17
    assert t.confidence == pytest.approx(0.92, abs=1e-3)
