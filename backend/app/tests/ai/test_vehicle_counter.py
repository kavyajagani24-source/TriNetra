"""
Unit tests for vehicle counting engine.
"""

from app.ai.analytics.vehicle_counter import VehicleCounter
from app.ai.models.detection_types import BoundingBox, TrackedDetection


def test_vehicle_counter_unique_counting():
    counter = VehicleCounter()
    box = BoundingBox(0, 0, 10, 10)

    # Frame 1: Vehicle 1 (car) and Vehicle 2 (motorcycle) appear
    f1 = [
        TrackedDetection(box, 2, "car", 0.9, track_id=1),
        TrackedDetection(box, 3, "motorcycle", 0.85, track_id=2),
    ]
    counter.update(f1)
    assert counter.total_unique_vehicles == 2
    assert counter.get_cumulative_counts()["car"] == 1
    assert counter.get_cumulative_counts()["motorcycle"] == 1

    # Frame 2: Vehicle 1 is still in view, Vehicle 3 (bus) appears
    f2 = [
        TrackedDetection(box, 2, "car", 0.92, track_id=1),
        TrackedDetection(box, 5, "bus", 0.94, track_id=3),
    ]
    counter.update(f2)
    # Vehicle 1 should NOT be double counted! Total unique vehicles = 3
    assert counter.total_unique_vehicles == 3
    assert counter.get_cumulative_counts()["car"] == 1
    assert counter.get_cumulative_counts()["bus"] == 1

    # Frame 3: Pedestrian appears (VRU, not motor vehicle)
    f3 = [
        TrackedDetection(box, 0, "person", 0.88, track_id=4),
    ]
    counter.update(f3)
    assert counter.total_unique_vehicles == 3
    assert counter.total_unique_objects == 4
    assert counter.get_cumulative_counts()["person"] == 1


def test_vehicle_counter_reset():
    counter = VehicleCounter()
    box = BoundingBox(0, 0, 10, 10)
    counter.update([TrackedDetection(box, 2, "car", 0.9, track_id=10)])
    assert counter.total_unique_vehicles == 1
    counter.reset()
    assert counter.total_unique_vehicles == 0
    assert counter.total_unique_objects == 0
