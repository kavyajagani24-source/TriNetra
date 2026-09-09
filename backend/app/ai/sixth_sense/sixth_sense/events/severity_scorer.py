"""
Severity Scorer — The Sixth Sense
Assigns LOW/MEDIUM/HIGH/CRITICAL to road damage observations.

ALL THRESHOLDS ARE HEURISTIC.
They must be calibrated against ground-truth data before use in production.
2D visual features only — no depth or volume claims.
"""
from __future__ import annotations
import logging
from typing import Dict, Any

from sixth_sense.schemas.urban_event import SeverityTier, EventType

logger = logging.getLogger(__name__)

# Default thresholds — all configurable via profile
_DEFAULT_THRESHOLDS = {
    "relative_area_low":      0.0005,
    "relative_area_medium":   0.002,
    "relative_area_high":     0.008,
    "persistence_weight":     0.3,
}


class SeverityScorer:
    """
    Heuristic severity scoring for road damage observations.

    Inputs (all 2D visual features):
      - relative_area: bbox / frame area
      - detection_count: how many frames the defect appeared in
      - confidence: peak detection confidence

    Output: LOW / MEDIUM / HIGH / CRITICAL

    NOTE: These tiers are heuristic labels, not engineering measurements.
          They should not be used to make automated legal or compliance decisions.
    """

    def __init__(self, thresholds: Dict[str, Any] = None) -> None:
        t = thresholds or _DEFAULT_THRESHOLDS
        self.area_low = t.get("relative_area_low", _DEFAULT_THRESHOLDS["relative_area_low"])
        self.area_medium = t.get("relative_area_medium", _DEFAULT_THRESHOLDS["relative_area_medium"])
        self.area_high = t.get("relative_area_high", _DEFAULT_THRESHOLDS["relative_area_high"])
        self.persistence_weight = t.get("persistence_weight", _DEFAULT_THRESHOLDS["persistence_weight"])

    def score(
        self,
        event_type: EventType,
        relative_area: float,
        detection_count: int,
        confidence: float,
    ) -> SeverityTier:
        """
        Compute severity tier for a road damage observation.

        For non-road-damage events (vehicles, pedestrians), returns UNKNOWN
        because severity doesn't apply in the same dimension.
        """
        _ROAD_DAMAGE_TYPES = {
            EventType.POTHOLE,
            EventType.ROAD_CRACK,
            EventType.ROAD_DAMAGE,
            EventType.WATERLOGGING,
            EventType.GARBAGE,
        }

        if event_type not in _ROAD_DAMAGE_TYPES:
            return SeverityTier.UNKNOWN

        # Base tier from 2D bounding-box area (HEURISTIC)
        if relative_area < self.area_low:
            base_tier = 0  # LOW
        elif relative_area < self.area_medium:
            base_tier = 1  # MEDIUM
        elif relative_area < self.area_high:
            base_tier = 2  # HIGH
        else:
            base_tier = 3  # CRITICAL

        # Persistence bonus: more frame detections → slightly higher severity
        # Represents temporal confidence, not physical size change
        persistence_bonus = min(1, int(detection_count * self.persistence_weight / 10))

        # Confidence penalty: low-confidence detections should not be CRITICAL
        conf_penalty = 0
        if confidence < 0.5:
            conf_penalty = 1

        final = max(0, min(3, base_tier + persistence_bonus - conf_penalty))

        tier_map = {0: SeverityTier.LOW, 1: SeverityTier.MEDIUM,
                    2: SeverityTier.HIGH, 3: SeverityTier.CRITICAL}
        tier = tier_map[final]

        logger.debug(
            "Severity: %s | area=%.5f base=%d persist_bonus=%d conf_pen=%d → %s",
            event_type.value, relative_area, base_tier, persistence_bonus, conf_penalty, tier.value,
        )
        return tier
