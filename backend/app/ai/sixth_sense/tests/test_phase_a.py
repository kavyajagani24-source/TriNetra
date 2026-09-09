"""
Tests — The Sixth Sense
Phase A focused tests:
- GPS interpolation / missing GPS
- IoU matching
- Track confirmation
- Temporal grouping / observation creation
- Severity scoring
- Duplicate issue deduplication
- Malformed frame handling
- Quality gate
"""
from __future__ import annotations
import sys
import os
import math
import unittest
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sixth_sense.schemas.urban_event import (
    Detection, EventType, ClassificationSource, GPSPoint, GPSStatus, SeverityTier,
)
from sixth_sense.association.gps_associator import GPSAssociator, _haversine_m
from sixth_sense.tracking.urban_tracker import _iou, UrbianTracker
from sixth_sense.events.severity_scorer import SeverityScorer
from sixth_sense.events.observation_builder import ObservationBuilder
from sixth_sense.events.issue_manager import IssueManager
from sixth_sense.core.quality_gate import QualityGate


def _make_det(
    class_name="D40",
    event_type=EventType.POTHOLE,
    bbox=(100, 200, 200, 300),
    confidence=0.75,
    frame_idx=0,
    timestamp=0.0,
    gps=None,
) -> Detection:
    x1, y1, x2, y2 = bbox
    area = (x2 - x1) * (y2 - y1)
    return Detection(
        det_id=Detection.make_id(),
        frame_idx=frame_idx,
        timestamp=timestamp,
        event_type=event_type,
        class_name=class_name,
        classification_source=ClassificationSource.DETECTED,
        raw_confidence=confidence,
        confidence=confidence,
        bbox=bbox,
        bbox_area_px=area,
        relative_area=area / (1920 * 1080),
        frame_width=1920,
        frame_height=1080,
        gps=gps,
        quality=None,
        model_name="test",
    )


class TestIoU(unittest.TestCase):
    def test_perfect_overlap(self):
        self.assertAlmostEqual(_iou((0, 0, 10, 10), (0, 0, 10, 10)), 1.0, places=4)

    def test_no_overlap(self):
        self.assertAlmostEqual(_iou((0, 0, 5, 5), (10, 10, 20, 20)), 0.0, places=4)

    def test_half_overlap(self):
        # Two 10x10 boxes shifted by 5 in x
        iou = _iou((0, 0, 10, 10), (5, 0, 15, 10))
        self.assertGreater(iou, 0.0)
        self.assertLess(iou, 1.0)

    def test_symmetric(self):
        a, b = (10, 10, 50, 50), (30, 30, 70, 70)
        self.assertAlmostEqual(_iou(a, b), _iou(b, a), places=6)


class TestTracker(unittest.TestCase):
    def _tracker(self):
        return UrbianTracker(iou_threshold=0.3, confirm_frames=3, max_lost_frames=5)

    def test_track_confirmation_requires_n_frames(self):
        t = self._tracker()
        det = _make_det(class_name="car", event_type=EventType.VEHICLE, bbox=(100, 100, 200, 200))
        det.frame_idx = 0
        # Frame 0: 1 detection → not confirmed yet
        active = t.update([det], 0)
        self.assertEqual(len(active), 0, "Track should not be confirmed after 1 frame")

        # Frames 1,2: same bbox
        for i in range(1, 3):
            d = _make_det(class_name="car", event_type=EventType.VEHICLE, bbox=(105, 105, 205, 205))
            d.frame_idx = i
            active = t.update([d], i)

        # After 3 frames it should be confirmed
        self.assertEqual(len(active), 1)
        self.assertTrue(active[0].confirmed)

    def test_different_classes_do_not_merge(self):
        t = self._tracker()
        car = _make_det(class_name="car", event_type=EventType.VEHICLE, bbox=(100, 100, 200, 200))
        truck = _make_det(class_name="truck", event_type=EventType.VEHICLE, bbox=(105, 105, 205, 205))
        car.frame_idx = truck.frame_idx = 0
        t.update([car, truck], 0)
        # Two distinct tracks should exist for same bbox but different classes
        self.assertEqual(t._next_id, 2)


class TestGPSAssociator(unittest.TestCase):
    def _make_associator_from_samples(self, samples):
        """Build a GPSAssociator directly from sample list (no file needed)."""
        assoc = GPSAssociator(gps_source=None, video_start_unix=0.0)
        assoc._samples = sorted(samples, key=lambda s: s["timestamp"])
        return assoc

    def test_direct_match(self):
        samples = [
            {"timestamp": 0.0, "lat": 12.9716, "lon": 77.5946, "heading": 90.0},
            {"timestamp": 5.0, "lat": 12.9720, "lon": 77.5950, "heading": 90.0},
        ]
        assoc = self._make_associator_from_samples(samples)
        pt = assoc.get_location(0.0)
        self.assertEqual(pt.status, GPSStatus.DIRECT)
        self.assertAlmostEqual(pt.lat, 12.9716, places=4)

    def test_interpolation(self):
        samples = [
            {"timestamp": 0.0, "lat": 12.0, "lon": 77.0, "heading": None},
            {"timestamp": 10.0, "lat": 13.0, "lon": 78.0, "heading": None},
        ]
        assoc = self._make_associator_from_samples(samples)
        pt = assoc.get_location(5.0)
        self.assertEqual(pt.status, GPSStatus.INTERPOLATED)
        self.assertAlmostEqual(pt.lat, 12.5, places=4)
        self.assertAlmostEqual(pt.lon, 77.5, places=4)

    def test_large_gap_returns_unavailable(self):
        samples = [
            {"timestamp": 0.0, "lat": 12.0, "lon": 77.0, "heading": None},
            {"timestamp": 60.0, "lat": 13.0, "lon": 78.0, "heading": None},
        ]
        assoc = self._make_associator_from_samples(samples)
        # Default max gap is 10s — gap of 60s should be UNAVAILABLE
        pt = assoc.get_location(30.0)
        self.assertEqual(pt.status, GPSStatus.UNAVAILABLE)

    def test_empty_gps_returns_unavailable(self):
        assoc = GPSAssociator(gps_source=None)
        pt = assoc.get_location(5.0)
        self.assertEqual(pt.status, GPSStatus.UNAVAILABLE)

    def test_haversine_known_distance(self):
        # Approx 111km per degree of latitude
        d = _haversine_m(0.0, 0.0, 1.0, 0.0)
        self.assertAlmostEqual(d / 1000.0, 111.0, delta=1.0)


class TestSeverityScorer(unittest.TestCase):
    def setUp(self):
        self.scorer = SeverityScorer()

    def test_small_pothole_is_low(self):
        tier = self.scorer.score(EventType.POTHOLE, 0.0001, 5, 0.6)
        self.assertEqual(tier, SeverityTier.LOW)

    def test_large_pothole_is_high_or_critical(self):
        tier = self.scorer.score(EventType.POTHOLE, 0.01, 20, 0.85)
        self.assertIn(tier, [SeverityTier.HIGH, SeverityTier.CRITICAL])

    def test_vehicle_returns_unknown(self):
        tier = self.scorer.score(EventType.VEHICLE, 0.05, 10, 0.9)
        self.assertEqual(tier, SeverityTier.UNKNOWN)

    def test_low_confidence_reduces_tier(self):
        tier_high_conf = self.scorer.score(EventType.POTHOLE, 0.005, 15, 0.9)
        tier_low_conf = self.scorer.score(EventType.POTHOLE, 0.005, 15, 0.3)
        # Low confidence should not increase severity
        self.assertLessEqual(
            [SeverityTier.LOW, SeverityTier.MEDIUM, SeverityTier.HIGH, SeverityTier.CRITICAL].index(tier_low_conf),
            [SeverityTier.LOW, SeverityTier.MEDIUM, SeverityTier.HIGH, SeverityTier.CRITICAL].index(tier_high_conf),
        )


class TestObservationBuilder(unittest.TestCase):
    def _profile(self):
        return {
            "observation": {
                "max_gap_frames": 10,
                "min_spatial_overlap_iou": 0.3,
                "min_detections": 3,
            },
            "severity": {},
        }

    def test_multiple_detections_become_one_observation(self):
        builder = ObservationBuilder(self._profile(), bus_id="BUS_001", run_id="r1")
        # Simulate 10 frames of the same pothole
        for i in range(10):
            det = _make_det(frame_idx=i, timestamp=float(i), bbox=(100, 200, 200, 300))
            builder.ingest([det])

        obs = builder.finalise()
        self.assertEqual(len(obs), 1, "10 detections of same pothole must produce 1 observation")
        self.assertEqual(obs[0].detection_count, 10)

    def test_spatially_separate_detections_become_separate_observations(self):
        builder = ObservationBuilder(self._profile(), bus_id="BUS_001", run_id="r1")
        # Pothole A at left, pothole B at right — no spatial overlap
        for i in range(5):
            detA = _make_det(frame_idx=i, timestamp=float(i), bbox=(50, 200, 150, 300))
            detB = _make_det(frame_idx=i, timestamp=float(i), bbox=(700, 200, 800, 300))
            builder.ingest([detA, detB])

        obs = builder.finalise()
        self.assertEqual(len(obs), 2, "Two spatially separated potholes should be 2 observations")

    def test_too_few_detections_suppressed(self):
        builder = ObservationBuilder(self._profile(), bus_id="BUS_001", run_id="r1")
        # Only 2 detections — below min_detections=3
        for i in range(2):
            det = _make_det(frame_idx=i, timestamp=float(i))
            builder.ingest([det])

        obs = builder.finalise()
        self.assertEqual(len(obs), 0, "Fewer than min_detections should produce no observation")

    def test_temporal_gap_creates_separate_observations(self):
        builder = ObservationBuilder(self._profile(), bus_id="BUS_001", run_id="r1")
        # Group 1: frames 0-4
        for i in range(5):
            det = _make_det(frame_idx=i, timestamp=float(i))
            builder.ingest([det])
        # Gap of 20 frames (> max_gap_frames=10)
        # Group 2: frames 25-29
        for i in range(25, 30):
            det = _make_det(frame_idx=i, timestamp=float(i))
            builder.ingest([det])

        obs = builder.finalise()
        self.assertEqual(len(obs), 2, "Temporal gap should produce separate observations")


class TestIssueManager(unittest.TestCase):
    def _make_obs(self, lat, lon, bus_id="BUS_001", confidence=0.7):
        from sixth_sense.schemas.urban_event import Observation, SeverityTier
        gps = GPSPoint(lat=lat, lon=lon, timestamp=100.0,
                       uncertainty_m=8.0, heading=None, status=GPSStatus.INTERPOLATED)
        return Observation(
            obs_id=f"obs_{lat:.4f}",
            bus_id=bus_id,
            camera_id="CAM_FRONT",
            run_id="r1",
            event_type=EventType.POTHOLE,
            class_name="D40",
            first_seen_frame=0,
            last_seen_frame=10,
            first_seen_ts=0.0,
            last_seen_ts=1.0,
            representative_frame=5,
            confidence=confidence,
            severity=SeverityTier.MEDIUM,
            bbox=(100, 200, 200, 300),
            bbox_area_px=10000,
            relative_area=0.005,
            gps=gps,
            evidence_ref=None,
            detection_count=5,
            model_name="test",
        )

    def test_same_location_two_buses_become_one_issue(self):
        mgr = IssueManager(dedup_radius_m=30.0)
        obs1 = self._make_obs(12.9716, 77.5946, bus_id="BUS_001")
        obs2 = self._make_obs(12.9716, 77.5946, bus_id="BUS_002")
        mgr.ingest(obs1)
        mgr.ingest(obs2)
        issues = mgr.get_all_issues()
        self.assertEqual(len(issues), 1, "Same GPS location, two buses → ONE issue")
        self.assertEqual(issues[0].bus_count, 2)
        self.assertEqual(issues[0].observation_count, 2)

    def test_far_locations_become_separate_issues(self):
        mgr = IssueManager(dedup_radius_m=30.0)
        # ~500m apart
        obs1 = self._make_obs(12.9716, 77.5946)
        obs2 = self._make_obs(12.9762, 77.5960)
        mgr.ingest(obs1)
        mgr.ingest(obs2)
        issues = mgr.get_all_issues()
        self.assertEqual(len(issues), 2, "Distant locations should produce separate issues")

    def test_severity_escalates_not_downgrade(self):
        from sixth_sense.schemas.urban_event import SeverityTier
        mgr = IssueManager(dedup_radius_m=30.0)
        obs1 = self._make_obs(12.9716, 77.5946)
        obs1.severity = SeverityTier.LOW
        obs2 = self._make_obs(12.9716, 77.5946)
        obs2.severity = SeverityTier.CRITICAL
        obs3 = self._make_obs(12.9716, 77.5946)
        obs3.severity = SeverityTier.MEDIUM  # after critical — should stay CRITICAL

        mgr.ingest(obs1)
        mgr.ingest(obs2)
        mgr.ingest(obs3)
        issue = mgr.get_all_issues()[0]
        self.assertEqual(issue.severity, SeverityTier.CRITICAL)


class TestQualityGate(unittest.TestCase):
    def setUp(self):
        self.gate = QualityGate(
            min_blur_score=80.0, min_brightness=30.0,
            max_brightness=230.0, max_glare_ratio=0.15,
        )

    def test_sharp_normal_frame(self):
        # Create a frame with high-frequency noise (high Laplacian variance)
        rng = np.random.default_rng(42)
        frame = rng.integers(80, 180, (480, 640, 3), dtype=np.uint8)
        score = self.gate.assess(frame)
        # High-noise frame should have high blur score → usable
        self.assertGreater(score.blur_score, 80.0)
        self.assertEqual(score.is_usable, True)

    def test_dark_frame(self):
        frame = np.zeros((480, 640, 3), dtype=np.uint8)  # Pure black
        score = self.gate.assess(frame)
        self.assertFalse(score.is_usable)
        self.assertLess(score.conf_multiplier, 1.0)

    def test_glare_frame(self):
        frame = np.full((480, 640, 3), 255, dtype=np.uint8)  # Pure white
        score = self.gate.assess(frame)
        self.assertFalse(score.is_usable)
        self.assertLess(score.conf_multiplier, 1.0)

    def test_malformed_tiny_frame(self):
        # Single pixel — should not crash
        frame = np.zeros((1, 1, 3), dtype=np.uint8)
        try:
            score = self.gate.assess(frame)
            self.assertIsNotNone(score)
        except Exception as e:
            self.fail(f"QualityGate raised on tiny frame: {e}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
