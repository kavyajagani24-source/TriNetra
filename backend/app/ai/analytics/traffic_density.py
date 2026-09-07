"""
UrbanEye AI — Traffic Density Analyzer

Classifies current traffic volume into discrete density levels
(LOW, MEDIUM, HIGH, SEVERE) based on active vehicle counts.
"""

from __future__ import annotations

from app.ai.models.detection_types import DensityLevel


class TrafficDensityAnalyzer:
    """
    Analyzes instantaneous traffic density from active vehicle counts.
    """

    def __init__(
        self,
        low_threshold: int = 5,
        medium_threshold: int = 10,
        high_threshold: int = 20,
    ):
        self.low_threshold = low_threshold
        self.medium_threshold = medium_threshold
        self.high_threshold = high_threshold

    def analyze(self, active_vehicle_count: int) -> DensityLevel:
        """
        Classify traffic density given active vehicle count in current frame.
        """
        if active_vehicle_count <= self.low_threshold:
            return DensityLevel.LOW
        elif active_vehicle_count <= self.medium_threshold:
            return DensityLevel.MEDIUM
        elif active_vehicle_count <= self.high_threshold:
            return DensityLevel.HIGH
        else:
            return DensityLevel.SEVERE
