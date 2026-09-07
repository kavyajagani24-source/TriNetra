"""
UrbanEye AI — Vehicle Counter

Counts unique vehicles passing through the camera view by monitoring track IDs.
Prevents double-counting by tracking unique entity IDs per class.
"""

from __future__ import annotations

from typing import Dict, List, Set

from app.ai.models.detection_types import VEHICLE_CLASSES, TrackedDetection


class VehicleCounter:
    """
    Stateful vehicle counting engine based on unique track IDs.
    """

    def __init__(self):
        # Set of track IDs seen so far
        self._seen_track_ids: Set[int] = set()
        # Mapping from track_id to class_name
        self._track_class_map: Dict[int, str] = {}
        # Cumulative unique counts by class
        self._unique_counts_by_class: Dict[str, int] = {
            "car": 0,
            "motorcycle": 0,
            "bus": 0,
            "truck": 0,
            "person": 0,
            "bicycle": 0,
        }

    def update(self, tracked_detections: List[TrackedDetection]) -> Dict[str, int]:
        """
        Process tracked detections in current frame.
        Returns the instantaneous active vehicle counts by class for this frame.
        """
        frame_counts: Dict[str, int] = {
            "car": 0,
            "motorcycle": 0,
            "bus": 0,
            "truck": 0,
            "person": 0,
            "bicycle": 0,
        }

        for det in tracked_detections:
            tid = det.track_id
            cname = det.class_name

            if tid >= 0:
                # Active counts in current frame
                frame_counts[cname] = frame_counts.get(cname, 0) + 1

                # Cumulative unique counts
                if tid not in self._seen_track_ids:
                    self._seen_track_ids.add(tid)
                    self._track_class_map[tid] = cname
                    self._unique_counts_by_class[cname] = (
                        self._unique_counts_by_class.get(cname, 0) + 1
                    )

        return frame_counts

    @property
    def total_unique_vehicles(self) -> int:
        """Total unique motor vehicles (car, motorcycle, bus, truck) observed."""
        return sum(
            count for cname, count in self._unique_counts_by_class.items()
            if cname in VEHICLE_CLASSES
        )

    @property
    def total_unique_objects(self) -> int:
        """Total unique objects observed including VRUs."""
        return len(self._seen_track_ids)

    def get_cumulative_counts(self) -> Dict[str, int]:
        """Return cumulative counts of unique objects by class."""
        return dict(self._unique_counts_by_class)

    def reset(self) -> None:
        """Reset counter state."""
        self._seen_track_ids.clear()
        self._track_class_map.clear()
        for k in self._unique_counts_by_class:
            self._unique_counts_by_class[k] = 0
