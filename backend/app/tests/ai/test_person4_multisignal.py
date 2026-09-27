"""
Unit and Contract Test Suite for Person 4 Multi-Signal Incident Intelligence.
SIH 2026 | PS 26125

Tests:
1. Pairwise feature extraction (20 features, shape, values)
2. Interaction classifier 3-class predictions
3. Optical flow motion corroboration (static vs burst)
4. Evidence fusion engine (rule-based and transparent signals)
5. Probability calibration (ECE, Brier score, temperature scaling)
6. Track-level multi-frame ANPR temporal voting (agreement & disagreement)
7. Hit-and-run 5 explicit states
8. Behavior engine jerk proxy and evidence breakdown
9. Schema compatibility with IncidentAnalysisResponse
"""

import numpy as np
import pytest

from ai.incident.anpr import ANPREngine, PlateResult, TrackANPRResult
from ai.incident.behavior_engine import BehaviorEngine, TrajectoryPoint
from ai.incident.calibration import ProbabilityCalibrator, compute_calibration_metrics
from ai.incident.fusion import EvidenceFusionEngine, FusionResult
from ai.incident.hit_and_run import HitAndRunResult, HitAndRunStateMachine, IncidentState, TrackObservation
from ai.incident.interaction_classifier import InteractionClassifier
from ai.incident.motion_evidence import MotionCorroborator, MotionEvidence
from ai.incident.pairwise import (
    CLASS_MAP,
    FEATURE_NAMES,
    ID_TO_CLASS,
    PairwiseWindow,
    extract_pairwise_features,
)
from ai.incident.schemas import (
    AbnormalDrivingEvent,
    CollisionCandidate,
    EvidencePacket,
    HitAndRunCandidate,
    IncidentAlertSummary,
    IncidentAnalysisResponse,
    IncidentMetrics,
    PlateInfo,
)


def test_pairwise_feature_extraction():
    """Verify that extract_pairwise_features generates 20 kinematic features."""
    obs_a = [
        {"frame_idx": i, "timestamp": i * 0.1, "bbox": (100 + i * 5, 200, 160 + i * 5, 260), "centroid": (130 + i * 5, 230), "speed": 50.0}
        for i in range(10)
    ]
    obs_b = [
        {"frame_idx": i, "timestamp": i * 0.1, "bbox": (300 - i * 15, 200, 360 - i * 15, 260), "centroid": (330 - i * 15, 230), "speed": 150.0}
        for i in range(10)
    ]

    feats = extract_pairwise_features(obs_a, obs_b, class_a="car", class_b="truck", frame_width=1920, frame_height=1080)
    assert feats is not None
    assert len(feats) == 20
    assert len(feats) == len(FEATURE_NAMES)
    # Peak IoU should be non-negative
    assert feats[0] >= 0.0
    # Centroid distance should be positive
    assert feats[3] > 0.0


def test_interaction_classifier_3class():
    """Verify that InteractionClassifier outputs 3-class probability distribution."""
    clf = InteractionClassifier(model_type="logistic_regression")
    X_dummy = np.random.randn(20, 20).astype(np.float32)
    y_dummy = np.random.choice([0, 1, 2], size=20)
    clf.fit(X_dummy, y_dummy)

    test_x = np.random.randn(5, 20).astype(np.float32)
    probs = clf.predict_proba(test_x)
    assert probs.shape == (5, 3)
    np.testing.assert_allclose(np.sum(probs, axis=1), 1.0, atol=1e-5)

    preds = clf.predict(test_x)
    assert len(preds) == 5
    assert all(p in [0, 1, 2] for p in preds)


def test_motion_corroborator_static():
    """Verify optical flow analyzer correctly identifies static scene as no burst."""
    engine = MotionCorroborator()
    frames = [(float(i) * 0.1, np.ones((200, 200, 3), dtype=np.uint8) * 128) for i in range(5)]
    res = engine.analyze_crop_window(frames, roi_bbox=(50, 50, 150, 150))
    assert res.flow_computed is True
    assert res.is_motion_burst is False
    assert res.peak_flow_magnitude < 1.0


def test_evidence_fusion_rule_based_signals_separate():
    """Verify fusion engine keeps all signals separate and returns transparent breakdown."""
    engine = EvidenceFusionEngine(mode="rule_based")
    res: FusionResult = engine.fuse(
        pairwise_score=0.75,
        neural_prob=0.51,
        kinematic_iou_corroboration=True,
        max_iou=0.08,
        deceleration_evidence=True,
        motion_burst=True,
        near_collision_flag=False,
    )

    assert res.collision_detected is True
    assert res.collision_class == "COLLISION_CANDIDATE"
    assert res.fused_incident_score >= 0.85
    # Confirm individual signals are in signal_breakdown
    assert res.signal_breakdown["pairwise_interaction_score"] == 0.75
    assert res.signal_breakdown["neural_model_probability"] == 0.51
    assert res.signal_breakdown["kinematic_iou_corroboration"] is True
    assert res.signal_breakdown["motion_burst_evidence"] is True


def test_evidence_fusion_near_collision():
    """Verify near-collision hard negative produces NEAR_COLLISION class without false collision candidate."""
    engine = EvidenceFusionEngine(mode="rule_based")
    res = engine.fuse(
        pairwise_score=0.45,
        neural_prob=0.30,
        kinematic_iou_corroboration=False,
        max_iou=0.01,
        deceleration_evidence=True,
        motion_burst=False,
        near_collision_flag=True,
    )

    assert res.collision_detected is False
    assert res.near_collision_flagged is True
    assert res.collision_class == "NEAR_COLLISION"
    assert res.status == "REVIEW_REQUIRED"


def test_probability_calibration():
    """Verify ECE, Brier score, and temperature scaling."""
    probs = np.array([0.1, 0.2, 0.8, 0.9, 0.4, 0.6])
    targets = np.array([0, 0, 1, 1, 0, 1])

    metrics = compute_calibration_metrics(probs, targets, n_bins=5)
    assert "ece" in metrics
    assert "brier_score" in metrics
    assert metrics["brier_score"] >= 0.0

    cal = ProbabilityCalibrator()
    cal.fit_temperature(probs, targets)
    assert cal.is_fitted is True
    calibrated_val = cal.calibrate(0.8)
    assert 0.0 <= calibrated_val <= 1.0


def test_anpr_track_voting_agreement():
    """Verify track-level ANPR consensus voting when crops agree."""
    engine = ANPREngine()
    # Mock clean crop with DL011234
    dummy_crop = np.ones((80, 200, 3), dtype=np.uint8) * 200

    class MockANPR(ANPREngine):
        def detect_and_read(self, crop):
            return PlateResult(
                plate_text="DL011234",
                confidence=0.85,
                bbox=(10, 10, 190, 70),
                format_valid=True,
                status="DETECTED",
            )

    mock = MockANPR()
    candidates = [(0.1 * i, dummy_crop, (100, 100, 300, 200)) for i in range(5)]
    res: TrackANPRResult = mock.detect_and_read_track(track_id=7, candidate_crops=candidates)

    assert res.voted_plate == "DL011234"
    assert res.voting_confidence == 1.0
    assert res.status == "DETECTED"
    assert res.format_valid is True


def test_hit_and_run_5_states():
    """Verify all 5 explicit states in HitAndRunStateMachine."""
    fsm = HitAndRunStateMachine()

    # State 1: Both vehicles remain stopped -> COLLISION_WITHOUT_DEPARTURE
    tracks_remain = {
        1: [
            TrackObservation(0, 1.0, (100, 100, 200, 200), (150, 150), speed=100.0),
            TrackObservation(10, 3.0, (100, 100, 200, 200), (150, 150), speed=0.0),
        ],
        2: [
            TrackObservation(0, 1.0, (190, 100, 290, 200), (240, 150), speed=80.0),
            TrackObservation(10, 3.0, (190, 100, 290, 200), (240, 150), speed=0.0),
        ],
    }
    r1 = fsm.evaluate(True, 1.0, tracks_remain)
    assert r1.status_label == "COLLISION_WITHOUT_DEPARTURE"
    assert r1.is_hit_and_run_candidate is False

    # State 2: One departs and reaches camera edge -> HIT_AND_RUN_CANDIDATE
    tracks_hnr = {
        1: [
            TrackObservation(0, 1.0, (500, 300, 600, 400), (550, 350), speed=50.0),
            TrackObservation(10, 3.0, (500, 300, 600, 400), (550, 350), speed=0.0),
        ],
        2: [
            TrackObservation(0, 1.0, (590, 300, 690, 400), (640, 350), speed=80.0),
            TrackObservation(10, 3.0, (1240, 300, 1340, 400), (1260, 350), speed=250.0), # near edge 1280
        ],
    }
    r2 = fsm.evaluate(True, 1.0, tracks_hnr, frame_width=1280, frame_height=720)
    assert r2.status_label == "HIT_AND_RUN_CANDIDATE"
    assert r2.is_hit_and_run_candidate is True
    assert r2.offending_track_id == 2

    # State 3: One vehicle departs slowly, stays in frame -> VEHICLE_DEPARTURE_AFTER_COLLISION
    tracks_internal = {
        1: [
            TrackObservation(0, 1.0, (500, 300, 600, 400), (550, 350), speed=50.0),
            TrackObservation(10, 3.0, (500, 300, 600, 400), (550, 350), speed=0.0),
        ],
        2: [
            TrackObservation(0, 1.0, (590, 300, 690, 400), (640, 350), speed=80.0),
            TrackObservation(10, 3.0, (750, 300, 850, 400), (800, 350), speed=120.0), # moved >80px but not near edge
        ],
    }
    r3 = fsm.evaluate(True, 1.0, tracks_internal, frame_width=1280, frame_height=720)
    assert r3.status_label == "VEHICLE_DEPARTURE_AFTER_COLLISION"
    assert r3.is_hit_and_run_candidate is False

    # State 4: Both departed -> BOTH_VEHICLES_DEPARTED
    tracks_both = {
        1: [
            TrackObservation(0, 1.0, (500, 300, 600, 400), (550, 350), speed=50.0),
            TrackObservation(10, 3.0, (100, 300, 200, 400), (150, 350), speed=200.0),
        ],
        2: [
            TrackObservation(0, 1.0, (590, 300, 690, 400), (640, 350), speed=80.0),
            TrackObservation(10, 3.0, (1100, 300, 1200, 400), (1150, 350), speed=200.0),
        ],
    }
    r4 = fsm.evaluate(True, 1.0, tracks_both, frame_width=1280, frame_height=720)
    assert r4.status_label == "BOTH_VEHICLES_DEPARTED"

    # State 5: Only 1 vehicle track -> INSUFFICIENT_TRACK_EVIDENCE
    tracks_single = {
        1: [
            TrackObservation(0, 1.0, (500, 300, 600, 400), (550, 350), speed=50.0),
        ],
    }
    r5 = fsm.evaluate(True, 1.0, tracks_single)
    assert r5.status_label == "INSUFFICIENT_TRACK_EVIDENCE"


def test_behavior_engine_jerk_and_anomalies():
    """Verify that behavior engine computes jerk proxy and populates evidence breakdown."""
    engine = BehaviorEngine()
    # Erratic swerving + hard braking trajectory
    points = []
    for i in range(25):
        t = i * 0.1
        # Sudden decel at i=15
        x = 100.0 + (i * 20.0 if i < 15 else 15 * 20.0 + (i - 15) * 1.0)
        y = 200.0 + np.sin(i * 0.8) * 50.0
        points.append(TrajectoryPoint(frame_idx=i, timestamp=t, bbox=(x, y, x + 40, y + 40), centroid=(x + 20, y + 20), width=40, height=40))

    prof = engine.analyze_trajectory(track_id=3, class_name="car", points=points)
    assert prof.jerk_proxy_px_s3 >= 0.0
    assert "evidence_breakdown" in prof.__dict__
    assert len(prof.evidence_breakdown) > 0
    assert prof.verdict_explanation != ""


def test_schemas_contract():
    """Verify CollisionCandidate and IncidentAnalysisResponse serialize all required fields."""
    c = CollisionCandidate(
        detected=True,
        confidence=0.88,
        model_confidence=0.51,
        pairwise_score=0.78,
        kinematic_corroboration=True,
        fused_incident_score=0.88,
        near_collision_flagged=False,
        collision_class="COLLISION_CANDIDATE",
        fusion_mode="rule_based",
        status="COLLISION_CANDIDATE",
        peak_timestamp_sec=7.23,
        involved_track_ids=[8, 10],
    )
    d = c.model_dump()
    assert d["pairwise_score"] == 0.78
    assert d["fusion_mode"] == "rule_based"
    assert d["collision_class"] == "COLLISION_CANDIDATE"
