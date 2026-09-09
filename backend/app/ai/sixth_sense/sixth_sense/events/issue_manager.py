"""
Issue Manager — The Sixth Sense
Maintains PersistentIssues from Observations across multiple bus passes.

Observation: one bus, one timestamp, one camera.
PersistentIssue: real-world physical problem, multiple observations.

Multiple buses observing the same defect → ONE PersistentIssue.
These are called MULTIPLE PASSES / CORROBORATION, not independent observations.
"""
from __future__ import annotations
import logging
import math
from typing import List, Optional, Dict

from sixth_sense.schemas.urban_event import (
    Observation, PersistentIssue, GPSPoint, EventType, SeverityTier, IssueTrend,
)

logger = logging.getLogger(__name__)

_SEVERITY_ORDER = {
    SeverityTier.UNKNOWN: -1,
    SeverityTier.LOW: 0,
    SeverityTier.MEDIUM: 1,
    SeverityTier.HIGH: 2,
    SeverityTier.CRITICAL: 3,
}

# Spatial dedup threshold in metres
_DEFAULT_DEDUP_RADIUS_M = 30.0


class IssueManager:
    """
    In-memory store for PersistentIssues.

    For Phase A: rule-based deduplication using:
      1. Same event_type / class
      2. GPS spatial distance within threshold
      3. Time window

    Phase C will optionally extend this with OPTICS clustering
    if real data shows variable GPS drift requires it.
    """

    def __init__(
        self,
        dedup_radius_m: float = _DEFAULT_DEDUP_RADIUS_M,
    ) -> None:
        self.dedup_radius_m = dedup_radius_m
        self._issues: Dict[str, PersistentIssue] = {}  # issue_id → PersistentIssue

    # ------------------------------------------------------------------ #
    # Ingestion
    # ------------------------------------------------------------------ #

    def ingest(self, observation: Observation) -> PersistentIssue:
        """
        Match observation to an existing issue or create a new one.

        Returns the (updated or new) PersistentIssue.
        """
        matched = self._find_matching_issue(observation)

        if matched:
            self._update_issue(matched, observation)
            logger.info(
                "Observation %s corroborated issue %s (now %d obs, %d buses)",
                observation.obs_id, matched.issue_id,
                matched.observation_count, matched.bus_count,
            )
            return matched
        else:
            issue = self._create_issue(observation)
            self._issues[issue.issue_id] = issue
            logger.info(
                "New issue %s created from observation %s [%s]",
                issue.issue_id, observation.obs_id, observation.event_type.value,
            )
            return issue

    def get_all_issues(self) -> List[PersistentIssue]:
        return list(self._issues.values())

    # ------------------------------------------------------------------ #
    # Matching
    # ------------------------------------------------------------------ #

    def _find_matching_issue(self, obs: Observation) -> Optional[PersistentIssue]:
        """Find an existing issue that spatially and typologically matches."""
        if obs.gps is None or obs.gps.status.value == "UNAVAILABLE":
            # Without GPS we cannot safely deduplicate spatially
            return None

        best: Optional[PersistentIssue] = None
        best_dist = float("inf")

        for issue in self._issues.values():
            if issue.event_type != obs.event_type:
                continue
            if issue.status in ("RESOLVED",):
                continue
            if issue.center_gps is None:
                continue

            dist = _haversine_m(
                issue.center_gps.lat, issue.center_gps.lon,
                obs.gps.lat, obs.gps.lon,
            )
            if dist <= self.dedup_radius_m and dist < best_dist:
                best = issue
                best_dist = dist

        return best

    # ------------------------------------------------------------------ #
    # Create / Update
    # ------------------------------------------------------------------ #

    def _create_issue(self, obs: Observation) -> PersistentIssue:
        issue = PersistentIssue(
            issue_id=PersistentIssue.make_id(),
            event_type=obs.event_type,
            class_name=obs.class_name,
        )
        self._update_issue(issue, obs)
        issue.trend = IssueTrend.NEW
        return issue

    def _update_issue(self, issue: PersistentIssue, obs: Observation) -> None:
        issue.observations.append(obs)
        issue.observation_count = len(issue.observations)

        if obs.bus_id not in issue.bus_ids:
            issue.bus_ids.append(obs.bus_id)
        issue.bus_count = len(issue.bus_ids)

        # Timestamps
        if issue.first_seen_ts == 0.0 or obs.first_seen_ts < issue.first_seen_ts:
            issue.first_seen_ts = obs.first_seen_ts
        if obs.last_seen_ts > issue.last_seen_ts:
            issue.last_seen_ts = obs.last_seen_ts

        # Confidence: take the max across observations (peak corroboration)
        issue.confidence = max(o.confidence for o in issue.observations)

        # Severity: escalate if new observation is worse; never auto-downgrade
        new_sev_ord = _SEVERITY_ORDER.get(obs.severity, -1)
        cur_sev_ord = _SEVERITY_ORDER.get(issue.severity, -1)
        if new_sev_ord > cur_sev_ord:
            issue.severity_history.append(issue.severity.value)
            issue.severity = obs.severity

        # GPS centroid: mean of all observations with valid GPS
        valid_gps = [
            o.gps for o in issue.observations
            if o.gps and o.gps.status.value != "UNAVAILABLE"
        ]
        if valid_gps:
            avg_lat = sum(g.lat for g in valid_gps) / len(valid_gps)
            avg_lon = sum(g.lon for g in valid_gps) / len(valid_gps)
            max_unc = max(g.uncertainty_m for g in valid_gps)
            issue.center_gps = GPSPoint(
                lat=round(avg_lat, 7),
                lon=round(avg_lon, 7),
                timestamp=obs.last_seen_ts,
                uncertainty_m=round(max_unc, 2),
                heading=None,
                status=valid_gps[-1].status,
            )

        # Trend
        issue.trend = self._compute_trend(issue)

    @staticmethod
    def _compute_trend(issue: PersistentIssue) -> IssueTrend:
        """
        Simple trend from severity history.
        Only meaningful with ≥ 2 observations.
        """
        if issue.observation_count < 2:
            return IssueTrend.NEW

        history = [_SEVERITY_ORDER.get(SeverityTier(s), -1) for s in issue.severity_history]
        current = _SEVERITY_ORDER.get(issue.severity, -1)
        if history and current > history[-1]:
            return IssueTrend.DETERIORATING
        elif history and current < history[-1]:
            return IssueTrend.IMPROVING
        return IssueTrend.STABLE


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in metres."""
    R = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))
