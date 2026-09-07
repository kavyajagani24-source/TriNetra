"""
Unit tests for AI internal data types and enums.
"""

from app.ai.models.detection_types import (
    BoundingBox,
    CongestionLevel,
    DensityLevel,
    Detection,
    TrackedDetection,
    TrajectoryPoint,
)


def test_bounding_box_geometry():
    bbox = BoundingBox(x1=10.0, y1=20.0, x2=110.0, y2=120.0)
    assert bbox.width == 100.0
    assert bbox.height == 100.0
    assert bbox.center_x == 60.0
    assert bbox.center_y == 70.0
    assert bbox.area == 10000.0
    assert bbox.to_tuple() == (10.0, 20.0, 110.0, 120.0)
    assert bbox.to_int_tuple() == (10, 20, 110, 120)


def test_detection_classification_helpers():
    car_det = Detection(
        bbox=BoundingBox(0, 0, 10, 10),
        class_id=2,
        class_name="car",
        confidence=0.9,
    )
    assert car_det.is_vehicle() is True
    assert car_det.is_vulnerable() is False

    person_det = Detection(
        bbox=BoundingBox(0, 0, 10, 10),
        class_id=0,
        class_name="person",
        confidence=0.85,
    )
    assert person_det.is_vehicle() is False
    assert person_det.is_vulnerable() is True


def test_tracked_detection():
    td = TrackedDetection(
        bbox=BoundingBox(0, 0, 50, 50),
        class_id=5,
        class_name="bus",
        confidence=0.95,
        track_id=42,
    )
    assert td.track_id == 42
    assert td.is_vehicle() is True


def test_trajectory_point():
    pt = TrajectoryPoint(x=15.5, y=30.2, frame_number=1, timestamp=0.033, pixel_speed=12.5)
    assert pt.x == 15.5
    assert pt.pixel_speed == 12.5
