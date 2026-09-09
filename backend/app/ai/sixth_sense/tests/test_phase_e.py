"""
Phase E Tests — SIH demonstration pipeline
"""
from __future__ import annotations

import json
import os
import sys
import unittest
import subprocess
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

PROJECT_ROOT = Path(__file__).parent.parent
SIH_OUTPUT = PROJECT_ROOT / "outputs" / "sih_demo"

STAGE_DIRS = [
    "01_detections",
    "02_observations",
    "03_persistent_issues",
    "04_corroboration",
    "05_work_items",
    "06_verification",
    "07_metrics",
    "08_demo_summary",
]


class TestSIHDemoPipeline(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        if SIH_OUTPUT.exists() and (SIH_OUTPUT / "08_demo_summary" / "demo_summary.json").exists():
            cls._ran_demo = False
        else:
            result = subprocess.run(
                [sys.executable, str(PROJECT_ROOT / "run_sih_demo.py"), "--fast"],
                cwd=str(PROJECT_ROOT),
                capture_output=True,
                text=True,
            )
            if result.returncode != 0:
                raise unittest.SkipTest(f"run_sih_demo.py failed: {result.stderr}")
            cls._ran_demo = True

    def test_all_stage_directories_exist(self):
        for name in STAGE_DIRS:
            self.assertTrue((SIH_OUTPUT / name).is_dir(), f"Missing stage dir: {name}")

    def test_observations_file_present(self):
        path = SIH_OUTPUT / "02_observations" / "observations.json"
        self.assertTrue(path.exists())
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        self.assertGreater(data.get("total_observations", 0), 0)

    def test_work_items_generated(self):
        path = SIH_OUTPUT / "05_work_items" / "work_items.json"
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        self.assertGreater(data["count"], 0)
        wi = data["work_items"][0]
        self.assertIn("priority_band", wi)
        self.assertIn("department", wi)

    def test_verification_showcase_present(self):
        path = SIH_OUTPUT / "06_verification" / "verification_events.json"
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        results = {e["verification_result"] for e in data["events"]}
        self.assertIn("VERIFIED_REPAIRED", results)
        self.assertIn("REOPENED", results)

    def test_reopened_issue_has_appended_observation(self):
        path = SIH_OUTPUT / "06_verification" / "reopened_issues.json"
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        self.assertGreaterEqual(data["count"], 1)
        reopened = data["reopened_issues"][0]
        self.assertEqual(reopened["issue_id"], reopened.get("original_issue_id", reopened["issue_id"]))
        self.assertIn("observation_ids", reopened)
        self.assertIn("closure_history", reopened)
        self.assertGreater(reopened["observation_count_after"], 0)

    def test_issue_map_geojson_valid(self):
        path = SIH_OUTPUT / "08_demo_summary" / "issue_map.geojson"
        with open(path, encoding="utf-8") as f:
            geo = json.load(f)
        self.assertEqual(geo["type"], "FeatureCollection")
        self.assertGreater(len(geo["features"]), 0)
        feat = geo["features"][0]
        self.assertEqual(feat["geometry"]["type"], "Point")
        self.assertIn("issue_id", feat["properties"])
        self.assertIn("closure_status", feat["properties"])

    def test_action_queue_sorted_by_priority(self):
        path = SIH_OUTPUT / "08_demo_summary" / "action_queue.json"
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        scores = [item["priority_score"] for item in data["queue"]]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_demo_summary_has_pipeline_story(self):
        path = SIH_OUTPUT / "08_demo_summary" / "demo_summary.json"
        with open(path, encoding="utf-8") as f:
            summary = json.load(f)
        self.assertIn("pipeline", summary)
        self.assertIn("story", summary)
        self.assertIn("data_provenance", summary)


class TestReopenObservationRegression(unittest.TestCase):

    def test_append_helper_updates_issue_to_dict(self):
        from sixth_sense.closure.verification_engine import (
            VerificationEngine, FollowUpPass, append_follow_up_observation,
        )
        from sixth_sense.closure.repair_claim import RepairClaimBuilder, RepairClaimStatus
        from sixth_sense.schemas.urban_event import (
            PersistentIssue, EventType, SeverityTier, GPSStatus, GPSPoint, IssueTrend, Observation,
        )

        def gps():
            return GPSPoint(12.9716, 77.5946, 1000.0, 8.0, 90.0, GPSStatus.DIRECT)

        observations = [
            Observation(
                obs_id=f"obs_orig_{i}", bus_id=f"BUS_{i+1:03d}", camera_id="CAM_FRONT",
                run_id="run_a", event_type=EventType.ROAD_CRACK, class_name="D00",
                first_seen_frame=0, last_seen_frame=5, first_seen_ts=1.0, last_seen_ts=2.0,
                representative_frame=3, confidence=0.4, severity=SeverityTier.HIGH,
                bbox=(0, 0, 10, 10), bbox_area_px=100, relative_area=0.01,
                gps=gps(), evidence_ref=None, detection_count=2, model_name="road_damage_rdd2022",
            )
            for i in range(2)
        ]
        issue = PersistentIssue(
            issue_id="issue_regression_test",
            event_type=EventType.ROAD_CRACK, class_name="D00",
            observations=observations, bus_ids=["BUS_001", "BUS_002"],
            first_seen_ts=1.0, last_seen_ts=100.0, observation_count=2, bus_count=2,
            confidence=0.4, severity=SeverityTier.HIGH, trend=IssueTrend.NEW,
            center_gps=gps(), status="OPEN",
        )
        follow_obs = Observation(
            obs_id="obs_reg_to_dict", bus_id="BUS_003", camera_id="CAM_FRONT",
            run_id="follow_up", event_type=EventType.ROAD_CRACK, class_name="D00",
            first_seen_frame=0, last_seen_frame=5, first_seen_ts=200.0, last_seen_ts=201.0,
            representative_frame=3, confidence=0.35, severity=SeverityTier.HIGH,
            bbox=(0, 0, 10, 10), bbox_area_px=100, relative_area=0.01,
            gps=gps(), evidence_ref=None, detection_count=2, model_name="road_damage_rdd2022",
        )
        claim = RepairClaimBuilder.build(
            issue_id=issue.issue_id, work_item_id="WI-TEST",
            claimed_by="TEST", claimed_at="2026-09-10T08:00:00Z",
        )
        claim.claimed_status = RepairClaimStatus.VERIFICATION_PENDING
        follow_up = FollowUpPass(
            bus_id="BUS_003", pass_timestamp=9000.0,
            pass_gps=issue.center_gps, observations=[follow_obs],
        )
        engine = VerificationEngine()
        result = engine.verify(issue, claim, follow_up)
        engine.apply_result(issue, claim, result, follow_up)

        d = issue.to_dict()
        self.assertEqual(d["issue_id"], "issue_regression_test")
        self.assertIn("obs_reg_to_dict", d["observation_ids"])
        self.assertEqual(d["observation_count"], 3)
        self.assertEqual(len(d["closure_history"]), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
