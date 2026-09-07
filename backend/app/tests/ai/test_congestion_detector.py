"""
Unit tests for congestion detector heuristic engine.
"""

from app.ai.analytics.congestion_detector import CongestionDetector
from app.ai.models.detection_types import CongestionLevel


def test_congestion_detector():
    detector = CongestionDetector(
        vehicle_threshold=15,
        speed_threshold=10.0,
    )

    # Zero vehicles -> LOW
    assert detector.analyze(0, 0.0) == CongestionLevel.LOW

    # High volume, fast traffic -> LOW
    assert detector.analyze(18, 45.0) == CongestionLevel.LOW

    # Moderate volume, slower traffic -> MODERATE
    assert detector.analyze(10, 8.0) == CongestionLevel.MODERATE

    # High volume, slow traffic -> HIGH
    assert detector.analyze(16, 5.0) == CongestionLevel.HIGH

    # Extreme volume, crawl/stop -> SEVERE
    assert detector.analyze(25, 2.0) == CongestionLevel.SEVERE
