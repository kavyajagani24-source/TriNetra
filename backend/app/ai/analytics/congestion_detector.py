"""
UrbanEye AI — Congestion Detector

Detects traffic bottlenecks and gridlock by correlating vehicle density
with average pixel speed.
"""

from __future__ import annotations

from app.ai.models.detection_types import CongestionLevel


class CongestionDetector:
    """
    Evaluates traffic congestion based on vehicle count and fleet movement speed.
    """

    def __init__(
        self,
        vehicle_threshold: int = 15,
        speed_threshold: float = 10.0,
    ):
        self.vehicle_threshold = vehicle_threshold
        self.speed_threshold = speed_threshold

    def analyze(self, vehicle_count: int, avg_speed: float) -> CongestionLevel:
        """
        Classify congestion level:
        - SEVERE: Very high vehicle count (> threshold * 1.5) and low speed (< speed_threshold)
        - HIGH: High vehicle count (> threshold) and low speed (< speed_threshold)
        - MODERATE: Moderate count (> threshold * 0.6) with slowing speed (< speed_threshold * 1.5)
        - LOW: Normal flow, low count or healthy speeds
        """
        if vehicle_count == 0:
            return CongestionLevel.LOW

        is_high_volume = vehicle_count >= self.vehicle_threshold
        is_slow_moving = avg_speed < self.speed_threshold

        if vehicle_count >= self.vehicle_threshold * 1.5 and is_slow_moving:
            return CongestionLevel.SEVERE
        elif is_high_volume and is_slow_moving:
            return CongestionLevel.HIGH
        elif vehicle_count >= self.vehicle_threshold * 0.6 and avg_speed < self.speed_threshold * 1.5:
            return CongestionLevel.MODERATE
        else:
            return CongestionLevel.LOW
