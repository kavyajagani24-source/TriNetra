"""
Phase C Tests — The Sixth Sense
Deterministic tests for priority engine, department router, work item builder,
and evidence chain. All 35 Phase A+B tests must continue to pass.

Tests:
  PriorityEngine:
    - CRITICAL issue scores CRITICAL/HIGH band
    - LOW confidence single-bus issue does not become CRITICAL
    - Repeated observations increase score within defined bounds
    - Corroboration increases score
    - Score is always 0–100
    - Score breakdown sums to total

  DepartmentRouter:
    - Road defects route to PWD
    - Waterlogging routes to Sanitation
    - Traffic issues route to ICCC
    - Default/unknown routes to Municipal
    - Routing result has required fields

  WorkItemBuilder:
    - WorkItem has required fields
    - Evidence provenance preserved (obs IDs, bus IDs, GPS)
    - why_priority is human-readable non-empty string
    - why_department is human-readable non-empty string

  EvidenceChain:
    - Chain links work_item_id → issue_id → observations
    - Every observation record has bus_id, gps_status, confidence
    - Priority and routing decisions are embedded

  Integration:
    - Priority never changes without explainable reason
    - Complete pipeline: issue → work_item → evidence_chain
"""
from __future__ import annotations

import sys
import os
import json
import unittest
from typing import Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sixth_sense.schemas.urban_event import (
    PersistentIssue, EventType, SeverityTier, GPSStatus, GPSPoint,
    IssueTrend, Observation, ClassificationSource,
)
from sixth_sense.actionable.priority_engine import PriorityEngine, PriorityBand
from sixth_sense.actionable.department_router import DepartmentRouter
from sixth_sense.actionable.work_item import WorkItemBuilder, WorkItemStatus
from sixth_sense.actionable.evidence_chain import EvidenceChainBuilder

from generate_actionable import (
    load_observation_index,
    issue_from_dict,
    process_issues,
    ROUTING_RULES_PATH,
)


# ── Test helpers ─────────────────────────────────────────────────────── #

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
) -> Observation:
    return Observation(
        obs_id=Observation.make_id(),
        bus_id=bus_id,
        camera_id="CAM_FRONT",
        run_id="run_test",
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
    bus_count=1,
    obs_count=3,
    trend=IssueTrend.NEW,
    gps_status=GPSStatus.DIRECT,
    bus_ids=None,
    observations=None,
) -> PersistentIssue:
    if bus_ids is None:
        bus_ids = [f"BUS_{i+1:03d}" for i in range(bus_count)]
    if observations is None:
        observations = [_obs(bus_id=bus_ids[i % len(bus_ids)]) for i in range(obs_count)]

    return PersistentIssue(
        issue_id=PersistentIssue.make_id(),
        event_type=event_type,
        class_name="D00",
        observations=observations,
        bus_ids=bus_ids,
        first_seen_ts=100.0,
        last_seen_ts=3700.0,
        observation_count=obs_count,
        bus_count=bus_count,
        confidence=confidence,
        severity=severity,
        trend=trend,
        center_gps=_gps(status=gps_status),
        status="OPEN",
        severity_history=["UNKNOWN"],
    )


engine = PriorityEngine()
router = DepartmentRouter()


# ════════════════════════════════════════════════════════════
#   PRIORITY ENGINE TESTS
# ════════════════════════════════════════════════════════════

class TestPriorityEngine(unittest.TestCase):

    def test_critical_severity_corroborated_scores_critical_or_high(self):
        issue = _issue(
            severity=SeverityTier.CRITICAL,
            confidence=0.90,
            bus_count=3,
            obs_count=6,
            gps_status=GPSStatus.DIRECT,
        )
        result = engine.score(issue)
        self.assertIn(result.priority_band, [PriorityBand.CRITICAL, PriorityBand.HIGH],
                      "CRITICAL severity + 3 buses must score CRITICAL or HIGH")
        self.assertGreaterEqual(result.priority_score, 50.0)

    def test_low_confidence_single_bus_does_not_score_critical(self):
        issue = _issue(
            severity=SeverityTier.LOW,
            confidence=0.26,
            bus_count=1,
            obs_count=1,
            gps_status=GPSStatus.UNAVAILABLE,
        )
        result = engine.score(issue)
        self.assertNotEqual(result.priority_band, PriorityBand.CRITICAL,
                            "Low confidence single-bus LOW severity must not be CRITICAL")

    def test_score_is_always_0_to_100(self):
        for severity in SeverityTier:
            for conf in [0.0, 0.5, 1.0]:
                for bus_count in [1, 5, 20]:
                    issue = _issue(severity=severity, confidence=conf, bus_count=bus_count, obs_count=50)
                    result = engine.score(issue)
                    self.assertGreaterEqual(result.priority_score, 0.0)
                    self.assertLessEqual(result.priority_score, 100.0)

    def test_corroboration_increases_score(self):
        single = _issue(bus_count=1, confidence=0.7, severity=SeverityTier.HIGH)
        multi  = _issue(bus_count=2, confidence=0.7, severity=SeverityTier.HIGH)
        s1 = engine.score(single).priority_score
        s2 = engine.score(multi).priority_score
        self.assertGreater(s2, s1, "Two-bus corroboration must score higher than single bus")

    def test_more_observations_increase_score_up_to_cap(self):
        low_obs  = _issue(obs_count=1, confidence=0.7, severity=SeverityTier.MEDIUM)
        high_obs = _issue(obs_count=5, confidence=0.7, severity=SeverityTier.MEDIUM)
        very_high_obs = _issue(obs_count=100, confidence=0.7, severity=SeverityTier.MEDIUM)
        s_low  = engine.score(low_obs).priority_score
        s_high = engine.score(high_obs).priority_score
        s_cap  = engine.score(very_high_obs).priority_score
        self.assertGreater(s_high, s_low)
        self.assertEqual(s_cap, s_high,
                         "Score must be capped — 100 obs should not beat 5 obs")

    def test_direct_gps_scores_higher_than_unavailable(self):
        direct = _issue(gps_status=GPSStatus.DIRECT)
        unavail = _issue(gps_status=GPSStatus.UNAVAILABLE)
        s_direct  = engine.score(direct).priority_score
        s_unavail = engine.score(unavail).priority_score
        self.assertGreater(s_direct, s_unavail)

    def test_score_breakdown_sums_to_total(self):
        issue = _issue(severity=SeverityTier.HIGH, confidence=0.8, bus_count=2, obs_count=4)
        result = engine.score(issue)
        bd = result.score_breakdown
        component_sum = (
            bd["severity_pts"] + bd["confidence_pts"] + bd["corroboration_pts"] +
            bd["persistence_pts"] + bd["gps_quality_pts"] + bd["type_bonus_pts"]
        )
        self.assertAlmostEqual(
            min(100.0, component_sum), bd["total"], places=1,
            msg="Breakdown components must sum to reported total"
        )

    def test_reasons_list_is_non_empty_and_human_readable(self):
        issue = _issue()
        result = engine.score(issue)
        self.assertGreater(len(result.reasons), 0)
        for r in result.reasons:
            self.assertIsInstance(r, str)
            self.assertGreater(len(r), 5)

    def test_score_version_is_set(self):
        issue = _issue()
        result = engine.score(issue)
        self.assertTrue(result.score_version.startswith("priority_"))


# ════════════════════════════════════════════════════════════
#   DEPARTMENT ROUTER TESTS
# ════════════════════════════════════════════════════════════

class TestDepartmentRouter(unittest.TestCase):

    def test_road_crack_routes_to_pwd(self):
        issue = _issue(event_type=EventType.ROAD_CRACK)
        result = router.route(issue)
        self.assertIn("PWD", result.department,
                      "ROAD_CRACK must route to PWD department")

    def test_pothole_routes_to_pwd(self):
        issue = _issue(event_type=EventType.POTHOLE)
        result = router.route(issue)
        self.assertIn("PWD", result.department)

    def test_waterlogging_routes_to_sanitation(self):
        issue = _issue(event_type=EventType.WATERLOGGING)
        result = router.route(issue)
        self.assertIn("SANITATION", result.department,
                      "WATERLOGGING must route to SANITATION")

    def test_congestion_routes_to_iccc_or_traffic(self):
        issue = _issue(event_type=EventType.CONGESTION)
        result = router.route(issue)
        self.assertTrue(
            "TRAFFIC" in result.department or "ICCC" in result.department,
            "CONGESTION must route to TRAFFIC or ICCC department"
        )

    def test_incident_routes_to_police_or_review(self):
        issue = _issue(event_type=EventType.INCIDENT_CANDIDATE)
        result = router.route(issue)
        self.assertTrue(
            "POLICE" in result.department or "REVIEW" in result.department,
            "INCIDENT_CANDIDATE must route to police / review"
        )

    def test_routing_result_has_required_fields(self):
        issue = _issue(event_type=EventType.ROAD_CRACK)
        result = router.route(issue)
        d = result.to_dict()
        for key in ["department", "department_display", "routing_reason",
                    "matched_rule", "routing_rule_version"]:
            self.assertIn(key, d)
            self.assertIsNotNone(d[key])
            self.assertGreater(len(str(d[key])), 0)

    def test_routing_reason_is_human_readable(self):
        issue = _issue(event_type=EventType.ROAD_CRACK)
        result = router.route(issue)
        self.assertGreater(len(result.routing_reason), 20,
                           "Routing reason must be a substantive human-readable string")

    def test_unknown_type_routes_to_default(self):
        issue = _issue(event_type=EventType.UNKNOWN)
        result = router.route(issue)
        # Should not raise; should return a valid result
        self.assertIsNotNone(result.department)
        self.assertIsNotNone(result.routing_reason)


# ════════════════════════════════════════════════════════════
#   WORK ITEM BUILDER TESTS
# ════════════════════════════════════════════════════════════

class TestWorkItemBuilder(unittest.TestCase):

    def _make(self, **kwargs):
        issue = _issue(**kwargs)
        priority = engine.score(issue)
        routing  = router.route(issue)
        return WorkItemBuilder.build(issue, priority, routing), issue, priority, routing

    def test_work_item_has_required_fields(self):
        wi, _, _, _ = self._make()
        d = wi.to_dict()
        required = [
            "work_item_id", "issue_id", "department", "priority_band",
            "priority_score", "created_at", "status", "observation_ids",
            "location", "severity", "confidence", "routing_reason",
        ]
        for key in required:
            self.assertIn(key, d, f"WorkItem.to_dict() missing: '{key}'")

    def test_work_item_default_status_is_new(self):
        wi, _, _, _ = self._make()
        self.assertEqual(wi.status, WorkItemStatus.NEW)

    def test_evidence_provenance_preserved(self):
        issue = _issue(bus_count=2, obs_count=4, bus_ids=["BUS_001","BUS_002"])
        priority = engine.score(issue)
        routing  = router.route(issue)
        wi = WorkItemBuilder.build(issue, priority, routing)

        self.assertEqual(wi.issue_id, issue.issue_id)
        self.assertEqual(wi.bus_count, 2)
        self.assertIn("BUS_001", wi.bus_ids)
        self.assertIn("BUS_002", wi.bus_ids)
        self.assertEqual(len(wi.observation_ids), len(issue.observations))
        # All obs IDs in work item come from the issue
        for obs_id in wi.observation_ids:
            self.assertIn(obs_id, [o.obs_id for o in issue.observations])

    def test_gps_preserved_in_work_item(self):
        wi, _, _, _ = self._make(gps_status=GPSStatus.DIRECT)
        self.assertIsNotNone(wi.center_lat)
        self.assertIsNotNone(wi.center_lon)
        self.assertEqual(wi.center_gps_status, "DIRECT")

    def test_why_priority_is_non_empty_human_readable(self):
        wi, _, _, _ = self._make()
        self.assertGreater(len(wi.why_priority), 30)
        self.assertIn(wi.issue_id, wi.why_priority)

    def test_why_department_references_event_type(self):
        wi, issue, _, _ = self._make(event_type=EventType.ROAD_CRACK)
        self.assertIn("ROAD_CRACK", wi.why_department)

    def test_work_item_id_is_unique(self):
        ids = set()
        for _ in range(20):
            wi, _, _, _ = self._make()
            ids.add(wi.work_item_id)
        self.assertEqual(len(ids), 20, "All work_item_ids must be unique")


# ════════════════════════════════════════════════════════════
#   EVIDENCE CHAIN TESTS
# ════════════════════════════════════════════════════════════

class TestEvidenceChain(unittest.TestCase):

    def _make_chain(self, **kwargs):
        issue    = _issue(**kwargs)
        priority = engine.score(issue)
        routing  = router.route(issue)
        wi       = WorkItemBuilder.build(issue, priority, routing)
        chain    = EvidenceChainBuilder.build(issue, wi, priority, routing)
        return chain, wi, issue

    def test_chain_links_work_item_to_issue(self):
        chain, wi, issue = self._make_chain()
        self.assertEqual(chain.work_item_id, wi.work_item_id)
        self.assertEqual(chain.issue_id, issue.issue_id)

    def test_chain_contains_all_observation_records(self):
        chain, _, issue = self._make_chain(obs_count=4)
        self.assertEqual(len(chain.observation_records), 4)

    def test_observation_records_have_bus_id_gps_confidence(self):
        chain, _, _ = self._make_chain(bus_count=2, obs_count=3)
        for rec in chain.observation_records:
            d = rec.to_dict()
            self.assertIn("bus_id", d)
            self.assertIn("gps", d)
            self.assertIn("confidence", d)
            self.assertGreater(len(d["bus_id"]), 0)

    def test_priority_decision_embedded_in_chain(self):
        chain, _, _ = self._make_chain()
        self.assertIsNotNone(chain.priority_decision)
        self.assertIn("priority_band", chain.priority_decision)
        self.assertIn("priority_score", chain.priority_decision)
        self.assertIn("reasons", chain.priority_decision)
        self.assertIn("score_version", chain.priority_decision)

    def test_routing_decision_embedded_in_chain(self):
        chain, _, _ = self._make_chain()
        self.assertIsNotNone(chain.routing_decision)
        self.assertIn("department", chain.routing_decision)
        self.assertIn("routing_reason", chain.routing_decision)

    def test_chain_to_dict_is_serializable(self):
        import json
        chain, _, _ = self._make_chain(bus_count=2, obs_count=3)
        try:
            s = json.dumps(chain.to_dict())
            self.assertGreater(len(s), 100)
        except (TypeError, ValueError) as e:
            self.fail(f"EvidenceChain.to_dict() is not JSON-serializable: {e}")


# ════════════════════════════════════════════════════════════
#   INTEGRATION TESTS
# ════════════════════════════════════════════════════════════

class TestPhaseCIntegration(unittest.TestCase):

    def test_complete_pipeline_road_crack(self):
        """Full pipeline: ROAD_CRACK issue → WorkItem with PWD routing and HIGH+ priority."""
        issue = _issue(
            event_type=EventType.ROAD_CRACK,
            severity=SeverityTier.HIGH,
            confidence=0.80,
            bus_count=2,
            obs_count=4,
            gps_status=GPSStatus.DIRECT,
        )
        priority = engine.score(issue)
        routing  = router.route(issue)
        wi       = WorkItemBuilder.build(issue, priority, routing)
        chain    = EvidenceChainBuilder.build(issue, wi, priority, routing)

        # Priority
        self.assertIn(priority.priority_band, [PriorityBand.CRITICAL, PriorityBand.HIGH])
        # Routing
        self.assertIn("PWD", routing.department)
        # Work item
        self.assertEqual(wi.status, WorkItemStatus.NEW)
        self.assertEqual(wi.issue_id, issue.issue_id)
        # Chain
        self.assertEqual(chain.work_item_id, wi.work_item_id)

    def test_complete_pipeline_waterlogging(self):
        issue = _issue(event_type=EventType.WATERLOGGING, severity=SeverityTier.MEDIUM)
        priority = engine.score(issue)
        routing  = router.route(issue)
        self.assertIn("SANITATION", routing.department)

    def test_every_work_item_has_explainable_priority(self):
        """No work item may have an empty why_priority."""
        for severity in [SeverityTier.LOW, SeverityTier.MEDIUM, SeverityTier.HIGH, SeverityTier.CRITICAL]:
            issue    = _issue(severity=severity, bus_count=2, obs_count=3)
            priority = engine.score(issue)
            routing  = router.route(issue)
            wi       = WorkItemBuilder.build(issue, priority, routing)
            self.assertGreater(len(wi.why_priority), 0,
                               f"why_priority must be set for severity={severity}")

    def test_higher_severity_produces_higher_or_equal_priority_score(self):
        """Severity should be the dominant factor — all else equal."""
        scores = {}
        for severity in [SeverityTier.LOW, SeverityTier.MEDIUM, SeverityTier.HIGH, SeverityTier.CRITICAL]:
            issue = _issue(severity=severity, confidence=0.6, bus_count=1, obs_count=2,
                           gps_status=GPSStatus.INTERPOLATED)
            scores[severity] = engine.score(issue).priority_score

        self.assertLess(scores[SeverityTier.LOW], scores[SeverityTier.MEDIUM])
        self.assertLess(scores[SeverityTier.MEDIUM], scores[SeverityTier.HIGH])
        self.assertLess(scores[SeverityTier.HIGH], scores[SeverityTier.CRITICAL])


# ════════════════════════════════════════════════════════════
#   REAL DATA + REPRODUCIBILITY TESTS
# ════════════════════════════════════════════════════════════

class TestPhaseCRealData(unittest.TestCase):
    """Tests against verified Phase B multipass outputs — no fabricated fields."""

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
            raise unittest.SkipTest("Phase B multipass issues JSON not found")
        if not os.path.exists(cls.MULTIPASS_OBS):
            raise unittest.SkipTest("Phase B multipass observations JSON not found")

        with open(cls.MULTIPASS_ISSUES, encoding="utf-8") as f:
            raw = json.load(f)
        cls.issues_list = raw["issues"]
        cls.obs_index = load_observation_index(cls.MULTIPASS_OBS)

    def test_real_road_crack_issues_produce_pwd_work_items(self):
        road_issues = [d for d in self.issues_list if d["event_type"] == "ROAD_CRACK"]
        self.assertEqual(len(road_issues), 4, "Expected 4 corroborated ROAD_CRACK issues")

        work_items, _, _, _, dept_counts, _ = process_issues(
            road_issues, self.obs_index, ROUTING_RULES_PATH,
        )
        self.assertEqual(len(work_items), 4)
        self.assertEqual(dept_counts.get("PWD_ROAD_MAINTENANCE", 0), 4)

        for wi in work_items:
            d = wi.to_dict()
            self.assertEqual(d["event_type"], "ROAD_CRACK")
            self.assertIn("PWD", d["department"])
            self.assertGreater(len(d["routing_reason"]), 20)
            self.assertGreater(len(d["priority_reasons"]), 0)
            self.assertTrue(d["score_version"].startswith("priority_"))
            self.assertIsNotNone(d["location"]["lat"])
            self.assertIsNotNone(d["location"]["lon"])

    def test_real_observation_provenance_not_issue_level_stubs(self):
        """Per-observation confidence/timestamps must come from observations JSON."""
        issue_dict = next(d for d in self.issues_list if d["issue_id"] == "issue_5737cc9173")
        issue = issue_from_dict(issue_dict, self.obs_index)

        self.assertEqual(len(issue.observations), 4)
        confidences = {o.confidence for o in issue.observations}
        # Real observations have distinct per-pass confidence (not all == issue confidence)
        self.assertNotEqual(confidences, {issue.confidence})

        first = next(o for o in issue.observations if o.obs_id == "obs_a29226cb450a")
        self.assertAlmostEqual(first.confidence, 0.3688, places=4)
        self.assertEqual(first.run_id, "multipass_6f838080_A")
        self.assertEqual(first.detection_count, 2)

    def test_priority_scoring_is_deterministic(self):
        issue_dict = self.issues_list[0]
        issue_a = issue_from_dict(issue_dict, self.obs_index)
        issue_b = issue_from_dict(issue_dict, self.obs_index)

        score_a = engine.score(issue_a)
        score_b = engine.score(issue_b)

        self.assertEqual(score_a.priority_score, score_b.priority_score)
        self.assertEqual(score_a.priority_band, score_b.priority_band)
        self.assertEqual(score_a.reasons, score_b.reasons)

    def test_process_issues_scores_are_reproducible(self):
        _, _, rows_a, bands_a, _, _ = process_issues(
            self.issues_list, self.obs_index, ROUTING_RULES_PATH,
        )
        _, _, rows_b, bands_b, _, _ = process_issues(
            self.issues_list, self.obs_index, ROUTING_RULES_PATH,
        )

        self.assertEqual(bands_a, bands_b)
        scores_a = {r["issue_id"]: r["priority_score"] for r in rows_a}
        scores_b = {r["issue_id"]: r["priority_score"] for r in rows_b}
        self.assertEqual(scores_a, scores_b)

    def test_evidence_chain_preserves_per_observation_gps(self):
        issue_dict = next(d for d in self.issues_list if d["event_type"] == "ROAD_CRACK")
        issue = issue_from_dict(issue_dict, self.obs_index)
        priority = engine.score(issue)
        routing = router.route(issue)
        wi = WorkItemBuilder.build(issue, priority, routing)
        chain = EvidenceChainBuilder.build(issue, wi, priority, routing)

        for rec in chain.observation_records:
            d = rec.to_dict()
            self.assertIsNotNone(d["gps"]["lat"])
            self.assertIsNotNone(d["gps"]["status"])
            self.assertIn(d["gps"]["status"], ["DIRECT", "INTERPOLATED", "UNAVAILABLE"])

    def test_unavailable_gps_observation_has_null_coords_in_chain(self):
        obs = _obs(gps=GPSPoint(
            lat=0.0, lon=0.0, timestamp=0.0, uncertainty_m=0.0,
            heading=None, status=GPSStatus.UNAVAILABLE,
        ))
        issue = _issue(observations=[obs], obs_count=1, bus_count=1,
                       gps_status=GPSStatus.UNAVAILABLE)
        priority = engine.score(issue)
        routing = router.route(issue)
        wi = WorkItemBuilder.build(issue, priority, routing)
        chain = EvidenceChainBuilder.build(issue, wi, priority, routing)

        rec = chain.observation_records[0].to_dict()
        self.assertEqual(rec["gps"]["status"], "UNAVAILABLE")
        # Do not treat unavailable GPS as reliable spatial evidence
        self.assertEqual(priority.score_breakdown["gps_quality_pts"], 0.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
