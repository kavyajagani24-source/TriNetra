"""
UrbanEye AI — Trajectory Manager

Maintains moving trajectories and calculates pixel-based movement speeds
for active object tracks.
"""

from __future__ import annotations

import math
from collections import deque
from typing import Deque, Dict, List, Optional, Set

from app.ai.models.detection_types import TrajectoryPoint


class TrajectoryManager:
    """
    Manages historical trajectory paths and velocities for tracked objects.
    """

    def __init__(self, max_points: int = 100):
        self.max_points = max_points
        self._trajectories: Dict[int, Deque[TrajectoryPoint]] = {}

    def add_point(
        self,
        track_id: int,
        x: float,
        y: float,
        frame_number: int,
        timestamp: float,
    ) -> TrajectoryPoint:
        """
        Record a new centroid point for a track and compute instantaneous pixel speed.
        """
        if track_id not in self._trajectories:
            self._trajectories[track_id] = deque(maxlen=self.max_points)

        history = self._trajectories[track_id]
        pixel_speed: Optional[float] = None

        if len(history) > 0:
            last_pt = history[-1]
            dt = timestamp - last_pt.timestamp
            dx = x - last_pt.x
            dy = y - last_pt.y
            dist = math.hypot(dx, dy)

            if dt > 0:
                pixel_speed = dist / dt
            else:
                # Same timestamp or zero delta fallback to distance per 1 frame
                pixel_speed = dist

        pt = TrajectoryPoint(
            x=x,
            y=y,
            frame_number=frame_number,
            timestamp=timestamp,
            pixel_speed=pixel_speed,
        )
        history.append(pt)
        return pt

    def get_trajectory(self, track_id: int) -> List[TrajectoryPoint]:
        """Return full points list for a specific track ID."""
        if track_id not in self._trajectories:
            return []
        return list(self._trajectories[track_id])

    def get_all_active_trajectories(self, active_track_ids: Optional[Set[int]] = None) -> Dict[int, List[TrajectoryPoint]]:
        """Return dictionary of trajectories, optionally filtered by active track IDs."""
        if active_track_ids is None:
            return {tid: list(pts) for tid, pts in self._trajectories.items()}
        return {
            tid: list(pts)
            for tid, pts in self._trajectories.items()
            if tid in active_track_ids
        }

    def calculate_track_average_speed(self, track_id: int) -> float:
        """Calculate average pixel speed of a track over its recorded points."""
        pts = self.get_trajectory(track_id)
        speeds = [p.pixel_speed for p in pts if p.pixel_speed is not None]
        if not speeds:
            return 0.0
        return sum(speeds) / len(speeds)

    def calculate_current_fleet_average_speed(self, active_track_ids: Set[int]) -> float:
        """Calculate average speed across currently active tracks."""
        if not active_track_ids:
            return 0.0

        speeds: List[float] = []
        for tid in active_track_ids:
            pts = self.get_trajectory(tid)
            if pts and pts[-1].pixel_speed is not None:
                speeds.append(pts[-1].pixel_speed)

        if not speeds:
            return 0.0
        return sum(speeds) / len(speeds)

    def clear(self) -> None:
        """Clear all stored trajectories."""
        self._trajectories.clear()
