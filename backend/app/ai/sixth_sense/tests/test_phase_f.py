"""
Phase F Tests — Visual Command Center
UI layer only; does not modify Phase A–E engine logic.
"""
from __future__ import annotations

import json
import os
import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
SIH_DEMO = PROJECT_ROOT / "outputs" / "sih_demo"
COMMAND_CENTER = PROJECT_ROOT / "command_center"
TRAFFIC_DEMO = PROJECT_ROOT / "outputs" / "traffic_demo"


class TestCommandCenterArtifacts(unittest.TestCase):
    """Command center consumes existing sih_demo artifacts."""

    def test_command_center_files_exist(self):
        for path in [
            COMMAND_CENTER / "index.html",
            COMMAND_CENTER / "css" / "styles.css",
            COMMAND_CENTER / "js" / "app.js",
            PROJECT_ROOT / "serve_command_center.py",
        ]:
            self.assertTrue(path.exists(), f"Missing: {path}")

    def test_sih_demo_artifacts_for_ui(self):
        required = [
            SIH_DEMO / "08_demo_summary" / "issue_map.geojson",
            SIH_DEMO / "08_demo_summary" / "action_queue.json",
            SIH_DEMO / "08_demo_summary" / "demo_summary.json",
            SIH_DEMO / "05_work_items" / "work_items.json",
            SIH_DEMO / "05_work_items" / "evidence_chain.json",
            SIH_DEMO / "06_verification" / "lifecycle_evidence.json",
        ]
        for path in required:
            self.assertTrue(path.exists(), f"Run run_sih_demo.py first — missing {path}")

    def test_geojson_has_closure_status(self):
        with open(SIH_DEMO / "08_demo_summary" / "issue_map.geojson", encoding="utf-8") as f:
            geo = json.load(f)
        self.assertEqual(geo["type"], "FeatureCollection")
        self.assertGreater(len(geo["features"]), 0)
        for feat in geo["features"]:
            props = feat["properties"]
            self.assertIn("issue_id", props)
            self.assertIn("closure_status", props)
            self.assertIn("marker_color", props)

    def test_lifecycle_chains_include_verification(self):
        with open(SIH_DEMO / "06_verification" / "lifecycle_evidence.json", encoding="utf-8") as f:
            data = json.load(f)
        chains = data.get("chains", [])
        self.assertGreaterEqual(len(chains), 1)
        has_verification = any(c.get("verification_decision") for c in chains)
        self.assertTrue(has_verification)

    def test_reopened_issue_has_follow_up_observation(self):
        with open(SIH_DEMO / "06_verification" / "reopened_issues.json", encoding="utf-8") as f:
            data = json.load(f)
        if data.get("count", 0) == 0:
            self.skipTest("No reopened issues in demo")
        reopened = data["reopened_issues"][0]
        self.assertIn("observation_ids", reopened)
        self.assertIn("closure_history", reopened)
        self.assertGreater(reopened["observation_count_after"], 0)

    def test_traffic_artifacts_for_command_center(self):
        with open(TRAFFIC_DEMO / "traffic_summary.json", encoding="utf-8") as f:
            summary = json.load(f)
        with open(TRAFFIC_DEMO / "traffic_observations.json", encoding="utf-8") as f:
            windows = json.load(f)["windows"]
        self.assertEqual(summary["vehicles_observed"], 46)
        self.assertEqual(summary["persistent_bottlenecks"], 0)
        self.assertEqual(len(windows), 2)
        self.assertTrue(all("density_level" in window and "congestion_state" in window for window in windows))

    def test_command_center_loads_traffic_artifacts(self):
        app = (COMMAND_CENTER / "js" / "app.js").read_text(encoding="utf-8")
        server = (PROJECT_ROOT / "serve_command_center.py").read_text(encoding="utf-8")
        self.assertIn("/traffic-data/traffic_summary.json", app)
        self.assertIn("observation-level vehicle proxies", app)
        self.assertIn("/traffic-data/", server)

    def test_command_center_has_no_external_map_dependency(self):
        html = (COMMAND_CENTER / "index.html").read_text(encoding="utf-8")
        app = (COMMAND_CENTER / "js" / "app.js").read_text(encoding="utf-8")
        self.assertNotIn("unpkg.com", html)
        self.assertIn("Promise.allSettled", app)
        self.assertIn("GIS ISSUE MAP", app)


if __name__ == "__main__":
    unittest.main(verbosity=2)
