"""
Re-Observation Matcher — The Sixth Sense, Phase D
Matches follow-up bus observations to an existing PersistentIssue location.

Reuses the same spatial/event-type logic as IssueManager deduplication.
GPS uncertainty is respected — unavailable GPS never forces a match.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List, Optional

from sixth_sense.schemas.urban_event import (
    PersistentIssue, Observation, GPSStatus, GPSPoint,
)


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@dataclass
class MatchResult:
    matched: bool
    distance_m: Optional[float]
    observation: Optional[Observation]
    reasons: List[str]

    def to_dict(self) -> dict:
        return {
            "matched": self.matched,
            "distance_m": round(self.distance_m, 2) if self.distance_m is not None else None,
            "obs_id": self.observation.obs_id if self.observation else None,
            "reasons": self.reasons,
        }


class ReObservationMatcher:
    """
    Determines whether a follow-up observation relates to an existing issue.

    Match criteria (all must hold):
      - Same event_type as the issue
      - Follow-up observation has usable GPS (DIRECT or INTERPOLATED)
      - Issue has usable center GPS
      - Haversine distance <= match_radius_m
      - Distance <= match_radius_m + combined GPS uncertainty (when strict_gps=True)
    """

    def __init__(
        self,
        match_radius_m: float = 30.0,
        strict_gps: bool = True,
        max_gps_uncertainty_m: float = 25.0,
    ) -> None:
        self.match_radius_m = match_radius_m
        self.strict_gps = strict_gps
        self.max_gps_uncertainty_m = max_gps_uncertainty_m

    def match_observation(
        self,
        issue: PersistentIssue,
        observation: Observation,
    ) -> MatchResult:
        reasons: List[str] = []

        if issue.event_type != observation.event_type:
            return MatchResult(
                matched=False,
                distance_m=None,
                observation=observation,
                reasons=[
                    f"event type mismatch: issue={issue.event_type.value}, "
                    f"obs={observation.event_type.value}",
                ],
            )

        if issue.center_gps is None or issue.center_gps.status == GPSStatus.UNAVAILABLE:
            return MatchResult(
                matched=False,
                distance_m=None,
                observation=observation,
                reasons=["issue has no reliable center GPS for spatial matching"],
            )

        if observation.gps is None or observation.gps.status == GPSStatus.UNAVAILABLE:
            return MatchResult(
                matched=False,
                distance_m=None,
                observation=observation,
                reasons=["follow-up observation GPS UNAVAILABLE — cannot match spatially"],
            )

        if observation.gps.uncertainty_m > self.max_gps_uncertainty_m:
            return MatchResult(
                matched=False,
                distance_m=None,
                observation=observation,
                reasons=[
                    f"follow-up GPS uncertainty {observation.gps.uncertainty_m:.1f}m "
                    f"exceeds limit {self.max_gps_uncertainty_m:.1f}m",
                ],
            )

        dist = _haversine_m(
            issue.center_gps.lat, issue.center_gps.lon,
            observation.gps.lat, observation.gps.lon,
        )

        allowed = self.match_radius_m
        if self.strict_gps:
            allowed += issue.center_gps.uncertainty_m + observation.gps.uncertainty_m

        if dist > allowed:
            return MatchResult(
                matched=False,
                distance_m=dist,
                observation=observation,
                reasons=[
                    f"distance {dist:.1f}m exceeds allowed {allowed:.1f}m "
                    f"(radius {self.match_radius_m}m + GPS uncertainty)",
                ],
            )

        reasons.append(
            f"same event type [{issue.event_type.value}] at {dist:.1f}m "
            f"(within {allowed:.1f}m threshold)"
        )
        return MatchResult(
            matched=True,
            distance_m=dist,
            observation=observation,
            reasons=reasons,
        )

    def find_matching_defects(
        self,
        issue: PersistentIssue,
        observations: List[Observation],
    ) -> List[MatchResult]:
        """Return all follow-up observations that match the issue location/type."""
        matches: List[MatchResult] = []
        for obs in observations:
            result = self.match_observation(issue, obs)
            if result.matched:
                matches.append(result)
        return matches

    def pass_covers_issue_location(
        self,
        issue: PersistentIssue,
        pass_gps: Optional[GPSPoint],
    ) -> MatchResult:
        """
        Check whether a follow-up bus pass reached the issue location.
        Used when no defect was detected (absence-of-detection verification).
        """
        if issue.center_gps is None or issue.center_gps.status == GPSStatus.UNAVAILABLE:
            return MatchResult(
                matched=False,
                distance_m=None,
                observation=None,
                reasons=["issue has no reliable center GPS"],
            )

        if pass_gps is None or pass_gps.status == GPSStatus.UNAVAILABLE:
            return MatchResult(
                matched=False,
                distance_m=None,
                observation=None,
                reasons=["follow-up pass GPS UNAVAILABLE — cannot confirm location coverage"],
            )

        dist = _haversine_m(
            issue.center_gps.lat, issue.center_gps.lon,
            pass_gps.lat, pass_gps.lon,
        )
        allowed = self.match_radius_m + issue.center_gps.uncertainty_m + pass_gps.uncertainty_m

        if dist > allowed:
            return MatchResult(
                matched=False,
                distance_m=dist,
                observation=None,
                reasons=[
                    f"follow-up pass did not cover issue location "
                    f"({dist:.1f}m > {allowed:.1f}m)",
                ],
            )

        return MatchResult(
            matched=True,
            distance_m=dist,
            observation=None,
            reasons=[f"follow-up pass covered issue location ({dist:.1f}m from centroid)"],
        )
