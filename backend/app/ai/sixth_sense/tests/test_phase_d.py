"""
Phase D Tests — The Sixth Sense
Proof-of-Closure verification: repair claim → re-observation → verification.

All 75 Phase A/B/C tests must continue passing.
"""
from __future__ import annotations

import sys
import os
import json
import unittest
from copy import deepcopy
from typing import Optional, List

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sixth_sense.schemas.urban_event import (
    PersistentIssue, EventType, SeverityTier, GPSStatus, GPSPoint,
    IssueTrend, Observation,
)
from sixth_sense.closure.repair_claim import (
    RepairClaimBuilder, RepairClaimStatus,
)
from sixth_sense.closure.reobservation_matcher import ReObservationMatcher
from sixth_sense.closure.verification_engine import (
    VerificationEngine, FollowUpPass, VerificationOutcome,
    append_follow_up_observation,
)
from sixth_sense.closure.lifecycle_evidence import LifecycleEvidenceBuilder
from sixth_sense.actionable.priority_engine import PriorityEngine
from sixth_sense.actionable.department_router import DepartmentRouter
from sixth_sense.actionable.work_item import WorkItemBuilder

from generate_actionable import load_observation_index, issue_from_dict, observation_from_dict


# ── Helpers ──────────────────────────────────────────────────────────── #

def _gps(lat=12.9716, lon=77.5946, status=GPSStatus.DIRECT, unc=8.0) -> GPSPoint:
    return GPSPoint(lat=lat, lon=lon, timestamp=1000.0,
                    uncertainty_m=unc, heading=90.0, status=status)


def _obs(
    bus_id="BUS_001",
    event_type=EventType.ROAD_CRACK,
    class_name="D00",
    conf=0.75,
    severity=SeverityTier.HIGH,
    gps: Optional[GPSPoint] = None,
    obs_id: Optional[str] = None,
    run_id: str = "run_test",
) -> Observation:
    return Observation(
        obs_id=obs_id or Observation.make_id(),
        bus_id=bus_id,
        camera_id="CAM_FRONT",
        run_id=run_id,
        event_type=event_type,
        class_name=class_name,
        first_seen_frame=10,
        last_seen_frame=20,
        first_seen_ts=5.0,
        last_seen_ts=5.8,
        representative_frame=15,
        confidence=conf,
        severity=severity,
        bbox=(100, 200, 300, 400),
        bbox_area_px=40000,
        relative_area=0.01,
        gps=gps or _gps(),
        evidence_ref=None,
        detection_count=10,
        model_name="road_damage_rdd2022",
    )


def _issue(
    event_type=EventType.ROAD_CRACK,
    severity=SeverityTier.HIGH,
    confidence=0.75,
    bus_count=2,
    obs_count=3,
    gps_status=GPSStatus.DIRECT,
    observations=None,
    issue_id=None,
) -> PersistentIssue:
    if observations is None:
        observations = [_obs(bus_id=f"BUS_{i+1:03d}") for i in range(obs_count)]

    return PersistentIssue(
        issue_id=issue_id or PersistentIssue.make_id(),
        event_type=event_type,
        class_name="D00",
        observations=observations,
        bus_ids=[f"BUS_{i+1:03d}" for i in range(bus_count)],
        first_seen_ts=100.0,
        last_seen_ts=3700.0,
        observation_count=len(observations),
        bus_count=bus_count,
        confidence=confidence,
        severity=severity,
        trend=IssueTrend.NEW,
        center_gps=_gps(status=gps_status),
        status="OPEN",
    )


def _claim(issue: PersistentIssue, work_item_id="WI-TEST") -> object:
    claim = RepairClaimBuilder.build(
        issue_id=issue.issue_id,
        work_item_id=work_item_id,
        claimed_by="PWD_TEST",
        claimed_at="2026-09-10T08:00:00Z",
    )
    claim.claimed_status = RepairClaimStatus.VERIFICATION_PENDING
    return claim


verifier = VerificationEngine()
matcher = ReObservationMatcher()


# ════════════════════════════════════════════════════════════
#   REPAIR CLAIM TESTS
# ════════════════════════════════════════════════════════════

class TestRepairClaim(unittest.TestCase):

    def test_repair_claim_does_not_auto_close_issue(self):
        issue = _issue()
        self.assertEqual(issue.status, "OPEN")
        claim = _claim(issue)
        self.assertEqual(claim.claimed_status, RepairClaimStatus.VERIFICATION_PENDING)
        self.assertEqual(issue.status, "OPEN")

    def test_repair_claim_has_required_fields(self):
        claim = RepairClaimBuilder.build(
            issue_id="issue_test123",
            work_item_id="WI-ABC",
            claimed_by="PWD_CREW",
            repair_reference="WO-123",
            notes="Test claim",
        )
        d = claim.to_dict()
        for key in ["claim_id", "issue_id", "work_item_id", "claimed_at",
                    "claimed_by", "claimed_status", "repair_reference", "notes"]:
            self.assertIn(key, d)


# ════════════════════════════════════════════════════════════
#   VERIFICATION ENGINE TESTS
# ════════════════════════════════════════════════════════════

class TestVerificationEngine(unittest.TestCase):

    def test_no_defect_after_repair_claim_verified_repaired(self):
        issue = _issue()
        claim = _claim(issue)
        follow_up = FollowUpPass(
            bus_id="BUS_003",
            pass_timestamp=4000.0,
            pass_gps=_gps(),
            observations=[],
        )
        result = verifier.verify(issue, claim, follow_up)
        self.assertEqual(result.verification_result, VerificationOutcome.VERIFIED_REPAIRED)
        self.assertIn("not absolute proof", result.verification_basis.lower())

    def test_same_defect_detected_reopened(self):
        issue = _issue()
        claim = _claim(issue)
        follow_obs = _obs(conf=0.35, bus_id="BUS_003")
        follow_up = FollowUpPass(
            bus_id="BUS_003",
            pass_timestamp=4000.0,
            pass_gps=_gps(),
            observations=[follow_obs],
        )
        result = verifier.verify(issue, claim, follow_up)
        self.assertEqual(result.verification_result, VerificationOutcome.REOPENED)
        self.assertIsNotNone(result.reopened_at)
        self.assertIn("discrepancy", " ".join(result.reasons).lower())

    def test_low_confidence_follow_up_review_required(self):
        issue = _issue()
        claim = _claim(issue)
        follow_obs = _obs(conf=0.18, bus_id="BUS_003")
        follow_up = FollowUpPass(
            bus_id="BUS_003", pass_timestamp=4000.0,
            pass_gps=_gps(), observations=[follow_obs],
        )
        result = verifier.verify(issue, claim, follow_up)
        self.assertEqual(result.verification_result, VerificationOutcome.REVIEW_REQUIRED)

    def test_gps_unavailable_does_not_verify_or_reopen(self):
        issue = _issue()
        claim = _claim(issue)
        unavail_obs = _obs(
            conf=0.40,
            gps=GPSPoint(0, 0, 0, 0, None, GPSStatus.UNAVAILABLE),
        )
        follow_up = FollowUpPass(
            bus_id="BUS_003", pass_timestamp=4000.0,
            pass_gps=GPSPoint(0, 0, 0, 999, None, GPSStatus.UNAVAILABLE),
            observations=[unavail_obs],
        )
        result = verifier.verify(issue, claim, follow_up)
        self.assertNotEqual(result.verification_result, VerificationOutcome.REOPENED)
        self.assertNotEqual(result.verification_result, VerificationOutcome.VERIFIED_REPAIRED)
        self.assertEqual(result.verification_result, VerificationOutcome.REVIEW_REQUIRED)

    def test_distant_defect_does_not_match_original_issue(self):
        issue = _issue()
        distant_gps = _gps(lat=12.9806, lon=77.5946)  # ~1 km north
        distant_obs = _obs(conf=0.40, gps=distant_gps)
        match = matcher.match_observation(issue, distant_obs)
        self.assertFalse(match.matched)

        claim = _claim(issue)
        follow_up = FollowUpPass(
            bus_id="BUS_003", pass_timestamp=4000.0,
            pass_gps=distant_gps, observations=[distant_obs],
        )
        result = verifier.verify(issue, claim, follow_up)
        self.assertNotEqual(result.verification_result, VerificationOutcome.REOPENED)

    def test_different_issue_type_does_not_match(self):
        issue = _issue(event_type=EventType.ROAD_CRACK)
        water_obs = _obs(event_type=EventType.WATERLOGGING, class_name="water")
        match = matcher.match_observation(issue, water_obs)
        self.assertFalse(match.matched)

        claim = _claim(issue)
        follow_up = FollowUpPass(
            bus_id="BUS_003", pass_timestamp=4000.0,
            pass_gps=_gps(), observations=[water_obs],
        )
        result = verifier.verify(issue, claim, follow_up)
        self.assertNotEqual(result.verification_result, VerificationOutcome.REOPENED)

    def test_original_issue_id_preserved_after_reopening(self):
        issue = _issue(issue_id="issue_p001_original")
        original_id = issue.issue_id
        claim = _claim(issue)
        follow_up = FollowUpPass(
            bus_id="BUS_003", pass_timestamp=4000.0,
            pass_gps=_gps(), observations=[_obs(conf=0.35)],
        )
        result = verifier.verify(issue, claim, follow_up)
        verifier.apply_result(issue, claim, result, follow_up)
        self.assertEqual(issue.issue_id, original_id)
        self.assertEqual(issue.status, "REOPENED")
        self.assertEqual(result.issue_id, original_id)

    def test_reopen_appends_follow_up_observation_to_issue_history(self):
        issue = _issue(obs_count=2, bus_count=2)
        original_obs_ids = [o.obs_id for o in issue.observations]
        original_count = issue.observation_count

        follow_obs = _obs(
            bus_id="BUS_003",
            conf=0.35,
            obs_id="obs_followup_verification_001",
        )
        claim = _claim(issue)
        follow_up = FollowUpPass(
            bus_id="BUS_003", pass_timestamp=4000.0,
            pass_gps=_gps(), observations=[follow_obs],
        )
        result = verifier.verify(issue, claim, follow_up)
        verifier.apply_result(issue, claim, result, follow_up)

        self.assertEqual(result.verification_result, VerificationOutcome.REOPENED)
        self.assertEqual(issue.observation_count, original_count + 1)
        self.assertIn(follow_obs.obs_id, [o.obs_id for o in issue.observations])
        for oid in original_obs_ids:
            self.assertIn(oid, [o.obs_id for o in issue.observations])
        self.assertIn("BUS_003", issue.bus_ids)
        self.assertEqual(issue.bus_count, 3)
        self.assertEqual(len(issue.closure_history), 1)
        self.assertEqual(issue.closure_history[0]["obs_id"], follow_obs.obs_id)
        self.assertEqual(issue.closure_history[0]["verification_id"], result.verification_id)

    def test_reopen_does_not_duplicate_observation_on_reapply(self):
        issue = _issue(obs_count=2)
        follow_obs = _obs(bus_id="BUS_003", conf=0.35, obs_id="obs_dup_test")
        claim = _claim(issue)
        follow_up = FollowUpPass(
            bus_id="BUS_003", pass_timestamp=4000.0,
            pass_gps=_gps(), observations=[follow_obs],
        )
        result = verifier.verify(issue, claim, follow_up)
        verifier.apply_result(issue, claim, result, follow_up)
        count_after_first = issue.observation_count

        append_follow_up_observation(issue, follow_obs, result.verification_id)
        self.assertEqual(issue.observation_count, count_after_first)
        self.assertEqual(len(issue.closure_history), 1)

    def test_reopen_preserves_original_observation_provenance(self):
        issue = _issue(obs_count=3, bus_count=2)
        original_obs = list(issue.observations)
        follow_obs = _obs(
            bus_id="BUS_003", conf=0.40, obs_id="obs_reopen_prov",
            run_id="follow_up_run_xyz",
        )
        claim = _claim(issue)
        follow_up = FollowUpPass(
            bus_id="BUS_003", pass_timestamp=5000.0,
            pass_gps=_gps(), observations=[follow_obs],
            run_id="follow_up_run_xyz",
        )
        result = verifier.verify(issue, claim, follow_up)
        verifier.apply_result(issue, claim, result, follow_up)

        for orig in original_obs:
            current = next(o for o in issue.observations if o.obs_id == orig.obs_id)
            self.assertEqual(current.bus_id, orig.bus_id)
            self.assertEqual(current.confidence, orig.confidence)
            self.assertEqual(current.run_id, orig.run_id)

        appended = next(o for o in issue.observations if o.obs_id == follow_obs.obs_id)
        self.assertEqual(appended.bus_id, "BUS_003")
        self.assertEqual(appended.run_id, follow_obs.run_id)

    def test_verification_is_deterministic(self):
        issue = _issue()
        claim = _claim(issue)
        follow_up = FollowUpPass(
            bus_id="BUS_003", pass_timestamp=4000.0,
            pass_gps=_gps(), observations=[_obs(conf=0.35)],
        )
        r1 = verifier.verify(issue, claim, follow_up)
        r2 = verifier.verify(issue, claim, follow_up)
        self.assertEqual(r1.verification_result, r2.verification_result)
        self.assertEqual(r1.verification_confidence, r2.verification_confidence)
        self.assertEqual(r1.reasons, r2.reasons)

    def test_repeated_follow_up_observations_handled(self):
        issue = _issue()
        claim = _claim(issue)
        obs_list = [_obs(conf=0.30, obs_id=f"obs_{i}") for i in range(3)]
        follow_up = FollowUpPass(
            bus_id="BUS_003", pass_timestamp=4000.0,
            pass_gps=_gps(), observations=obs_list,
        )
        result = verifier.verify(issue, claim, follow_up)
        self.assertEqual(result.verification_result, VerificationOutcome.REOPENED)
        self.assertIsNotNone(result.matched_observation_id)

    def test_verification_result_has_version_and_reasons(self):
        issue = _issue()
        claim = _claim(issue)
        follow_up = FollowUpPass(
            bus_id="BUS_003", pass_timestamp=4000.0,
            pass_gps=_gps(), observations=[],
        )
        result = verifier.verify(issue, claim, follow_up)
        d = result.to_dict()
        self.assertTrue(d["verification_version"].startswith("closure_"))
        self.assertGreater(len(d["reasons"]), 0)
        self.assertGreater(len(d["verification_basis"]), 10)


# ════════════════════════════════════════════════════════════
#   LIFECYCLE EVIDENCE TESTS
# ════════════════════════════════════════════════════════════

class TestLifecycleEvidence(unittest.TestCase):

    def _run_pipeline(self, with_defect: bool):
        issue = _issue()
        engine = PriorityEngine()
        router = DepartmentRouter()
        priority = engine.score(issue)
        routing = router.route(issue)
        wi = WorkItemBuilder.build(issue, priority, routing)
        claim = _claim(issue)
        obs = [_obs(conf=0.35)] if with_defect else []
        follow_up = FollowUpPass(
            bus_id="BUS_003", pass_timestamp=4000.0,
            pass_gps=_gps(), observations=obs,
        )
        result = verifier.verify(issue, claim, follow_up)
        return LifecycleEvidenceBuilder.build(
            issue, wi, priority, routing, claim, follow_up, result,
            verification_obs=obs[0] if obs else None,
        )

    def test_evidence_chain_contains_repair_claim_and_verification(self):
        chain = self._run_pipeline(with_defect=True)
        d = chain.to_dict()
        self.assertIsNotNone(d["repair_claim"])
        self.assertIsNotNone(d["verification_decision"])
        self.assertIsNotNone(d["follow_up_pass"])
        self.assertIn("repair_claim", d["lifecycle_stages"])
        self.assertIn("verification_decision", d["lifecycle_stages"])
        self.assertIn("priority_decision", d)
        self.assertIn("routing_decision", d)

    def test_lifecycle_chain_is_json_serializable(self):
        chain = self._run_pipeline(with_defect=False)
        try:
            s = json.dumps(chain.to_dict())
            self.assertGreater(len(s), 200)
        except (TypeError, ValueError) as e:
            self.fail(f"LifecycleEvidenceChain not serializable: {e}")


# ════════════════════════════════════════════════════════════
#   REAL DATA INTEGRATION
# ════════════════════════════════════════════════════════════

class TestPhaseDRealData(unittest.TestCase):
    MULTIPASS_ISSUES = os.path.join(
        os.path.dirname(__file__), "..", "outputs", "multipass2",
        "multipass_6f838080_issues.json",
    )
    MULTIPASS_OBS = os.path.join(
        os.path.dirname(__file__), "..", "outputs", "multipass2",
        "multipass_6f838080_observations.json",
    )

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(cls.MULTIPASS_ISSUES):
            raise unittest.SkipTest("Phase B multipass issues not found")
        with open(cls.MULTIPASS_ISSUES, encoding="utf-8") as f:
            cls.road_issue_dict = next(
                i for i in json.load(f)["issues"] if i["event_type"] == "ROAD_CRACK"
            )
        cls.obs_index = load_observation_index(cls.MULTIPASS_OBS)

    def test_real_issue_verified_repaired_scenario(self):
        issue = issue_from_dict(self.road_issue_dict, self.obs_index)
        original_id = issue.issue_id
        claim = _claim(issue, "WI-P001")
        follow_up = FollowUpPass(
            bus_id="BUS_003",
            pass_timestamp=issue.last_seen_ts + 86400,
            pass_gps=issue.center_gps,
            observations=[],
            data_provenance="SIMULATED_CLEAR_PASS",
        )
        result = verifier.verify(issue, claim, follow_up)
        self.assertEqual(result.verification_result, VerificationOutcome.VERIFIED_REPAIRED)
        self.assertEqual(issue.issue_id, original_id)

    def test_real_observation_reopen_scenario(self):
        from copy import deepcopy
        issue = issue_from_dict(self.road_issue_dict, self.obs_index)
        obs_id = self.road_issue_dict["observation_ids"][0]
        # Clone real detection as a new follow-up observation (BUS_003 post-repair pass)
        follow_raw = deepcopy(self.obs_index[obs_id])
        follow_raw["obs_id"] = "obs_followup_real_clone"
        follow_raw["bus_id"] = "BUS_003"
        follow_raw["run_id"] = "sih_follow_up_pass"
        real_obs = observation_from_dict(follow_raw)
        claim = _claim(issue, "WI-P002")
        follow_up = FollowUpPass(
            bus_id="BUS_003",
            pass_timestamp=issue.last_seen_ts + 86400,
            pass_gps=issue.center_gps,
            observations=[real_obs],
            data_provenance="REAL_OBS_IN_SIMULATED_PASS",
        )
        result = verifier.verify(issue, claim, follow_up)
        self.assertEqual(result.verification_result, VerificationOutcome.REOPENED)
        self.assertEqual(result.matched_observation_id, real_obs.obs_id)

        verifier.apply_result(issue, claim, result, follow_up)
        self.assertIn(real_obs.obs_id, [o.obs_id for o in issue.observations])
        self.assertGreater(
            issue.observation_count,
            len(self.road_issue_dict["observation_ids"]),
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
