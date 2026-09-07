"""
Unit tests for traffic density classifier.
"""

from app.ai.analytics.traffic_density import TrafficDensityAnalyzer
from app.ai.models.detection_types import DensityLevel


def test_traffic_density_thresholds():
    analyzer = TrafficDensityAnalyzer(
        low_threshold=5,
        medium_threshold=10,
        high_threshold=20,
    )

    assert analyzer.analyze(0) == DensityLevel.LOW
    assert analyzer.analyze(5) == DensityLevel.LOW
    assert analyzer.analyze(6) == DensityLevel.MEDIUM
    assert analyzer.analyze(10) == DensityLevel.MEDIUM
    assert analyzer.analyze(11) == DensityLevel.HIGH
    assert analyzer.analyze(20) == DensityLevel.HIGH
    assert analyzer.analyze(21) == DensityLevel.SEVERE
    assert analyzer.analyze(50) == DensityLevel.SEVERE
