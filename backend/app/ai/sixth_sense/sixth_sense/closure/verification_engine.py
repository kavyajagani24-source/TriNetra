"""
Verification Engine — The Sixth Sense, Phase D
Deterministic closure verification: repair claim + follow-up re-observation.

This is closure verification / verification discrepancy analysis.
It is NOT automatic fraud detection and does NOT claim legal certainty.
"""
from __future__ import annotations

import uuid
import datetime
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

from sixth_sense.schemas.urban_event import (
    PersistentIssue, Observation, GPSPoint, GPSStatus, IssueTrend,
    SeverityTier,
)
from sixth_sense.closure.repair_claim import RepairClaim, RepairClaimStatus
from sixth_sense.closure.reobservation_matcher import ReObservationMatcher, MatchResult


VERIFICATION_VERSION = "closure_v1.0"

_SEVERITY_ORDER = {
    SeverityTier.UNKNOWN: -1,
    SeverityTier.LOW: 0,
    SeverityTier.MEDIUM: 1,
    SeverityTier.HIGH: 2,
    SeverityTier.CRITICAL: 3,
}


def append_follow_up_observation(
    issue: PersistentIssue,
    observation: Observation,
    verification_id: str,
) -> bool:
    """
    Append a verified follow-up observation to an existing issue.
    Preserves issue_id; does not create a new issue.
    Returns True if the observation was appended (False if duplicate obs_id).
    """
    if any(o.obs_id == observation.obs_id for o in issue.observations):
        return False

    issue.observations.append(observation)
    issue.observation_count = len(issue.observations)

    if observation.bus_id not in issue.bus_ids:
        issue.bus_ids.append(observation.bus_id)
    issue.bus_count = len(issue.bus_ids)

    if issue.first_seen_ts == 0.0 or observation.first_seen_ts < issue.first_seen_ts:
        issue.first_seen_ts = observation.first_seen_ts
    if observation.last_seen_ts > issue.last_seen_ts:
        issue.last_seen_ts = observation.last_seen_ts

    issue.confidence = max(o.confidence for o in issue.observations)

    new_sev_ord = _SEVERITY_ORDER.get(observation.severity, -1)
    cur_sev_ord = _SEVERITY_ORDER.get(issue.severity, -1)
    if new_sev_ord > cur_sev_ord:
        issue.severity_history.append(issue.severity.value)
        issue.severity = observation.severity

    valid_gps = [
        o.gps for o in issue.observations
        if o.gps and o.gps.status != GPSStatus.UNAVAILABLE
    ]
    if valid_gps:
        avg_lat = sum(g.lat for g in valid_gps) / len(valid_gps)
        avg_lon = sum(g.lon for g in valid_gps) / len(valid_gps)
        max_unc = max(g.uncertainty_m for g in valid_gps)
        issue.center_gps = GPSPoint(
            lat=round(avg_lat, 7),
            lon=round(avg_lon, 7),
            timestamp=observation.last_seen_ts,
            uncertainty_m=round(max_unc, 2),
            heading=None,
            status=valid_gps[-1].status,
        )

    if not issue.closure_history:
        issue.closure_history = []
    issue.closure_history.append({
        "event": "VERIFICATION_FOLLOW_UP",
        "verification_id": verification_id,
        "obs_id": observation.obs_id,
        "bus_id": observation.bus_id,
        "run_id": observation.run_id,
        "confidence": round(observation.confidence, 4),
    })
    return True


class VerificationOutcome:
    VERIFIED_REPAIRED = "VERIFIED_REPAIRED"
    STILL_PRESENT = "STILL_PRESENT"
    REOPENED = "REOPENED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"


@dataclass
class FollowUpPass:
    """
    A subsequent bus pass through the issue area.
    observations may be empty (no defect detected during pass).
    """
    bus_id: str
    pass_timestamp: float
    pass_gps: Optional[GPSPoint]
    observations: List[Observation] = field(default_factory=list)
    run_id: str = "follow_up_pass"
    data_provenance: str = "REAL"  # REAL | SIMULATED_SCENARIO

    def to_dict(self) -> Dict:
        return {
            "bus_id": self.bus_id,
            "pass_timestamp": round(self.pass_timestamp, 3),
            "pass_gps": self.pass_gps.to_dict() if self.pass_gps else None,
            "observation_ids": [o.obs_id for o in self.observations],
            "run_id": self.run_id,
            "data_provenance": self.data_provenance,
        }


@dataclass
class VerificationResult:
    verification_id: str
    issue_id: str
    claim_id: str
    verification_result: str
    verification_confidence: float
    reasons: List[str]
    verification_basis: str
    verification_version: str = VERIFICATION_VERSION
    claim_status_after: str = RepairClaimStatus.VERIFICATION_PENDING
    issue_status_after: str = "OPEN"
    matched_observation_id: Optional[str] = None
    match_details: Optional[Dict] = None
    follow_up_pass: Optional[Dict] = None
    reopened_at: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "verification_id": self.verification_id,
            "issue_id": self.issue_id,
            "claim_id": self.claim_id,
            "verification_result": self.verification_result,
            "verification_confidence": round(self.verification_confidence, 4),
            "reasons": self.reasons,
            "verification_basis": self.verification_basis,
            "verification_version": self.verification_version,
            "claim_status_after": self.claim_status_after,
            "issue_status_after": self.issue_status_after,
            "matched_observation_id": self.matched_observation_id,
            "match_details": self.match_details,
            "follow_up_pass": self.follow_up_pass,
            "reopened_at": self.reopened_at,
        }


class VerificationEngine:
    """
    Deterministic closure verification.

    Decision tree:
      1. Repair must be claimed (not already verified/discrepant without re-check)
      2. Follow-up pass GPS must be usable for spatial decisions
      3. If matching same-type defect with confidence >= threshold → STILL_PRESENT / REOPENED
      4. If matching defect with low confidence → REVIEW_REQUIRED
      5. If pass covers location with no matching defect → VERIFIED_REPAIRED (qualified)
      6. If pass does not cover location or GPS unreliable → REVIEW_REQUIRED
    """

    def __init__(
        self,
        min_defect_confidence: float = 0.25,
        review_confidence_floor: float = 0.15,
        matcher: Optional[ReObservationMatcher] = None,
    ) -> None:
        self.min_defect_confidence = min_defect_confidence
        self.review_confidence_floor = review_confidence_floor
        self.matcher = matcher or ReObservationMatcher()

    def verify(
        self,
        issue: PersistentIssue,
        claim: RepairClaim,
        follow_up: FollowUpPass,
    ) -> VerificationResult:
        reasons: List[str] = []
        vid = f"VER-{uuid.uuid4().hex[:8].upper()}"

        if claim.claimed_status not in (
            RepairClaimStatus.REPAIR_CLAIMED,
            RepairClaimStatus.VERIFICATION_PENDING,
        ):
            return self._result(
                vid, issue, claim, follow_up,
                outcome=VerificationOutcome.REVIEW_REQUIRED,
                confidence=0.0,
                reasons=[f"claim status [{claim.claimed_status}] not eligible for verification"],
                basis="Claim not in verifiable state",
                claim_after=RepairClaimStatus.MANUAL_REVIEW,
                issue_after=issue.status,
            )

        reasons.append(f"repair claimed at {claim.claimed_at} by {claim.claimed_by}")
        reasons.append(
            f"follow-up bus {follow_up.bus_id} pass at t={follow_up.pass_timestamp:.1f}s "
            f"[provenance: {follow_up.data_provenance}]"
        )

        # Find spatially matching defects among follow-up observations
        defect_matches = self.matcher.find_matching_defects(issue, follow_up.observations)

        if defect_matches:
            best = min(defect_matches, key=lambda m: m.distance_m or float("inf"))
            obs = best.observation
            assert obs is not None

            reasons.extend(best.reasons)
            reasons.append(
                f"matching {issue.event_type.value} detected "
                f"(confidence {obs.confidence:.3f}, class {obs.class_name})"
            )

            if obs.confidence < self.review_confidence_floor:
                reasons.append(
                    f"confidence {obs.confidence:.3f} below review floor "
                    f"{self.review_confidence_floor} — insufficient for closure decision"
                )
                return self._result(
                    vid, issue, claim, follow_up,
                    outcome=VerificationOutcome.REVIEW_REQUIRED,
                    confidence=round(obs.confidence * 0.5, 4),
                    reasons=reasons,
                    basis="Low-confidence follow-up detection — human review required",
                    claim_after=RepairClaimStatus.MANUAL_REVIEW,
                    issue_after=issue.status,
                    matched_obs_id=obs.obs_id,
                    match_details=best.to_dict(),
                )

            if obs.confidence >= self.min_defect_confidence:
                reasons.append(
                    f"confidence {obs.confidence:.3f} at/above verification threshold "
                    f"{self.min_defect_confidence}"
                )
                reasons.append(
                    "verification discrepancy: same defect type re-observed after repair claim"
                )
                reasons.append(
                    "NOTE: this indicates a closure discrepancy, not contractor fraud"
                )
                reopened_ts = (
                    datetime.datetime.now(datetime.timezone.utc)
                    .isoformat()
                    .replace("+00:00", "Z")
                )
                return self._result(
                    vid, issue, claim, follow_up,
                    outcome=VerificationOutcome.REOPENED,
                    confidence=round(min(1.0, obs.confidence + 0.2), 4),
                    reasons=reasons,
                    basis=(
                        f"Same {issue.class_name} ({issue.event_type.value}) re-detected "
                        f"at issue location after repair claim"
                    ),
                    claim_after=RepairClaimStatus.REOPENED,
                    issue_after="REOPENED",
                    matched_obs_id=obs.obs_id,
                    match_details=best.to_dict(),
                    reopened_at=reopened_ts,
                )

            # Between review floor and verification threshold
            return self._result(
                vid, issue, claim, follow_up,
                outcome=VerificationOutcome.REVIEW_REQUIRED,
                confidence=round(obs.confidence, 4),
                reasons=reasons + [
                    f"confidence between review floor and verification threshold "
                    f"({self.review_confidence_floor}–{self.min_defect_confidence})",
                ],
                basis="Ambiguous follow-up detection — human review required",
                claim_after=RepairClaimStatus.MANUAL_REVIEW,
                issue_after=issue.status,
                matched_obs_id=obs.obs_id,
                match_details=best.to_dict(),
            )

        # No matching defect — check whether pass covered the issue location
        coverage = self.matcher.pass_covers_issue_location(issue, follow_up.pass_gps)

        if not coverage.matched:
            reasons.extend(coverage.reasons)
            return self._result(
                vid, issue, claim, follow_up,
                outcome=VerificationOutcome.REVIEW_REQUIRED,
                confidence=0.0,
                reasons=reasons,
                basis="Cannot verify closure — follow-up did not reliably cover issue location",
                claim_after=RepairClaimStatus.MANUAL_REVIEW,
                issue_after=issue.status,
                match_details=coverage.to_dict(),
            )

        reasons.extend(coverage.reasons)
        reasons.append(
            f"no corresponding {issue.event_type.value} observation during follow-up pass"
        )

        # Absence of detection is NOT absolute proof — qualify the result
        gps_bonus = 0.0
        if follow_up.pass_gps and follow_up.pass_gps.status == GPSStatus.DIRECT:
            gps_bonus = 0.15
        elif follow_up.pass_gps and follow_up.pass_gps.status == GPSStatus.INTERPOLATED:
            gps_bonus = 0.08

        confidence = round(min(0.85, 0.55 + gps_bonus), 4)

        return self._result(
            vid, issue, claim, follow_up,
            outcome=VerificationOutcome.VERIFIED_REPAIRED,
            confidence=confidence,
            reasons=reasons,
            basis=(
                "No corresponding defect detected during follow-up observation "
                "at the issue location. Absence of detection is not absolute proof "
                "that the road is fixed."
            ),
            claim_after=RepairClaimStatus.VERIFIED_REPAIRED,
            issue_after="RESOLVED",
            match_details=coverage.to_dict(),
        )

    def apply_result(
        self,
        issue: PersistentIssue,
        claim: RepairClaim,
        result: VerificationResult,
        follow_up: Optional[FollowUpPass] = None,
    ) -> None:
        """Update issue and claim in-place after verification (preserves issue_id)."""
        claim.claimed_status = result.claim_status_after
        claim.verification_events.append(result.verification_id)
        issue.status = result.issue_status_after

        if result.verification_result == VerificationOutcome.REOPENED:
            issue.trend = IssueTrend.REOPENED
            if follow_up and result.matched_observation_id:
                matched = next(
                    (
                        o for o in follow_up.observations
                        if o.obs_id == result.matched_observation_id
                    ),
                    None,
                )
                if matched:
                    append_follow_up_observation(
                        issue, matched, result.verification_id,
                    )

        elif result.verification_result == VerificationOutcome.VERIFIED_REPAIRED:
            issue.trend = IssueTrend.RESOLVED

    @staticmethod
    def _result(
        verification_id: str,
        issue: PersistentIssue,
        claim: RepairClaim,
        follow_up: FollowUpPass,
        outcome: str,
        confidence: float,
        reasons: List[str],
        basis: str,
        claim_after: str,
        issue_after: str,
        matched_obs_id: Optional[str] = None,
        match_details: Optional[Dict] = None,
        reopened_at: Optional[str] = None,
    ) -> VerificationResult:
        return VerificationResult(
            verification_id=verification_id,
            issue_id=issue.issue_id,
            claim_id=claim.claim_id,
            verification_result=outcome,
            verification_confidence=confidence,
            reasons=reasons,
            verification_basis=basis,
            claim_status_after=claim_after,
            issue_status_after=issue_after,
            matched_observation_id=matched_obs_id,
            match_details=match_details,
            follow_up_pass=follow_up.to_dict(),
            reopened_at=reopened_at,
        )
