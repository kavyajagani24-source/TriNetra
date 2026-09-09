"""
Priority Engine — The Sixth Sense, Phase C
Deterministic, explainable priority scoring for PersistentIssues.

Uses ONLY fields already present in the issue schema.
No fake AI model. No invented risk values.
Every point added has a named, auditable reason.

Score breakdown (max 100 pts):
  Severity       0–40   (LOW=10, MEDIUM=20, HIGH=30, CRITICAL=40)
  Confidence     0–20   (confidence * 20, capped)
  Corroboration  0–20   (min(20, (bus_count-1)*10))
  Persistence    0–10   (min(10, observation_count*2))
  GPS quality    0–5    (DIRECT=5, INTERPOLATED=3, UNAVAILABLE=0)
  Type bonus     0–5    (road defects +5)

Band thresholds:
  CRITICAL  ≥ 75
  HIGH      ≥ 50
  MEDIUM    ≥ 25
  LOW       < 25
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Dict, Any

from sixth_sense.schemas.urban_event import (
    PersistentIssue, SeverityTier, GPSStatus, EventType
)

SCORE_VERSION = "priority_v1.0"


class PriorityBand(str):
    """String-valued priority bands for JSON compatibility."""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


# Road-defect event types that get the type bonus
_ROAD_DEFECT_TYPES = {
    EventType.POTHOLE,
    EventType.ROAD_CRACK,
    EventType.ROAD_DAMAGE,
    EventType.ROAD_REPAIR,
    EventType.WATERLOGGING,
}

_SEVERITY_POINTS: Dict[SeverityTier, int] = {
    SeverityTier.CRITICAL: 40,
    SeverityTier.HIGH:     30,
    SeverityTier.MEDIUM:   20,
    SeverityTier.LOW:      10,
    SeverityTier.UNKNOWN:   5,
}


@dataclass
class PriorityResult:
    priority_score: float          # 0.0 – 100.0
    priority_band: str             # PriorityBand constant
    reasons: List[str]             # Human-readable factor list
    score_breakdown: Dict[str, Any]  # Per-factor points for audit
    score_version: str = SCORE_VERSION

    def to_dict(self) -> Dict:
        return {
            "priority_score": round(self.priority_score, 2),
            "priority_band": self.priority_band,
            "reasons": self.reasons,
            "score_breakdown": self.score_breakdown,
            "score_version": self.score_version,
        }


class PriorityEngine:
    """
    Deterministic priority scorer.
    No ML model. Every point has an auditable source.
    """

    # Band thresholds (configurable at construction)
    def __init__(
        self,
        band_critical: float = 75.0,
        band_high:     float = 50.0,
        band_medium:   float = 25.0,
    ) -> None:
        self.band_critical = band_critical
        self.band_high     = band_high
        self.band_medium   = band_medium

    def score(self, issue: PersistentIssue) -> PriorityResult:
        reasons: List[str] = []
        breakdown: Dict[str, Any] = {}
        total = 0.0

        # ── 1. Severity (0–40 pts) ──────────────────────────────────── #
        sev_pts = _SEVERITY_POINTS.get(issue.severity, 5)
        total += sev_pts
        breakdown["severity_pts"] = sev_pts
        reasons.append(f"{issue.severity.value} severity (+{sev_pts}pts)")

        # ── 2. Confidence (0–20 pts) ────────────────────────────────── #
        conf_pts = min(20.0, round(issue.confidence * 20, 1))
        total += conf_pts
        breakdown["confidence_pts"] = conf_pts
        reasons.append(
            f"model confidence {issue.confidence:.3f} (+{conf_pts:.1f}pts)"
        )

        # ── 3. Corroboration (0–20 pts) ─────────────────────────────── #
        corr_pts = min(20.0, (issue.bus_count - 1) * 10.0)
        total += corr_pts
        breakdown["corroboration_pts"] = corr_pts
        if issue.bus_count >= 2:
            reasons.append(
                f"corroborated by {issue.bus_count} independent buses (+{corr_pts:.0f}pts)"
            )
        else:
            reasons.append("single-bus observation — not yet corroborated (+0pts)")

        # ── 4. Persistence / observation count (0–10 pts) ───────────── #
        # Capped at 5 observations (each worth 2 pts) to prevent runaway scoring
        obs_pts = min(10.0, issue.observation_count * 2.0)
        total += obs_pts
        breakdown["persistence_pts"] = obs_pts
        reasons.append(
            f"{issue.observation_count} confirmed observations (+{obs_pts:.0f}pts)"
        )

        # ── 5. GPS quality (0–5 pts) ─────────────────────────────────── #
        gps_pts = 0.0
        gps_label = "no GPS"
        if issue.center_gps:
            if issue.center_gps.status == GPSStatus.DIRECT:
                gps_pts = 5.0
                gps_label = f"DIRECT GPS ±{issue.center_gps.uncertainty_m:.0f}m"
            elif issue.center_gps.status == GPSStatus.INTERPOLATED:
                gps_pts = 3.0
                gps_label = f"INTERPOLATED GPS ±{issue.center_gps.uncertainty_m:.0f}m"
            else:
                gps_pts = 0.0
                gps_label = "UNAVAILABLE GPS"
        total += gps_pts
        breakdown["gps_quality_pts"] = gps_pts
        reasons.append(f"location: {gps_label} (+{gps_pts:.0f}pts)")

        # ── 6. Issue type bonus (0–5 pts) ───────────────────────────── #
        type_pts = 5.0 if issue.event_type in _ROAD_DEFECT_TYPES else 0.0
        total += type_pts
        breakdown["type_bonus_pts"] = type_pts
        if type_pts > 0:
            reasons.append(
                f"road / infrastructure defect [{issue.event_type.value}] (+{type_pts:.0f}pts)"
            )

        # ── Cap and band ─────────────────────────────────────────────── #
        total = min(100.0, total)
        breakdown["total"] = round(total, 2)

        band = self._band(total)

        return PriorityResult(
            priority_score=round(total, 2),
            priority_band=band,
            reasons=reasons,
            score_breakdown=breakdown,
            score_version=SCORE_VERSION,
        )

    def _band(self, score: float) -> str:
        if score >= self.band_critical:
            return PriorityBand.CRITICAL
        if score >= self.band_high:
            return PriorityBand.HIGH
        if score >= self.band_medium:
            return PriorityBand.MEDIUM
        return PriorityBand.LOW
