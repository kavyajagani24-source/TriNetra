"""
Unit and Integration Tests for Incident + ANPR AI Pipeline.
SIH 2026 | PS 26125
"""

import json
import os
import shutil
import tempfile
from pathlib import Path
import cv2
import numpy as np
import pytest
import torch
from fastapi.testclient import TestClient

from ai.incident.anpr import ANPREngine, PlateResult
from ai.incident.behavior_engine import BehaviorEngine, TrajectoryPoint
from ai.incident.collision_model import CollisionDetector
from ai.incident.evidence import EvidenceManager, compute_sha256
from ai.incident.hit_and_run import HitAndRunResult, HitAndRunStateMachine, IncidentState, TrackObservation
from ai.incident.schemas import (
    AbnormalDrivingEvent,
    CollisionCandidate,
    EvidencePacket,
    HitAndRunCandidate,
    IncidentAnalysisResponse,
    IncidentMetrics,
    PlateInfo,
)
from main import app

client = TestClient(app)


# =====================================================================
# 1. Collision Detector Model Tests
# =====================================================================

def test_collision_detector_forward_cpu():
    """Verify CollisionDetector runs forward pass and produces correct shapes."""
    model = CollisionDetector(num_frames=8, hidden_dim=64, num_gru_layers=1)
    model.eval()
    dummy_input = torch.randn(2, 8, 3, 224, 224)
    with torch.no_grad():
        outputs = model(dummy_input)

    assert "logit" in outputs
    assert "prob" in outputs
    assert "attn_weights" in outputs
    assert "frame_probs" in outputs
    assert outputs["logit"].shape == (2, 1)
    assert outputs["prob"].shape == (2, 1)
    assert outputs["attn_weights"].shape == (2, 8, 1)
    # Probabilities must be strictly bounded in [0, 1]
    assert 0.0 <= outputs["prob"][0].item() <= 1.0


@pytest.mark.skipif(not torch.cuda.is_available(), reason="Requires CUDA GPU")
def test_collision_detector_forward_cuda():
    """Verify CollisionDetector runs on GPU if CUDA is available."""
    import threading
    res = {}
    def _run():
        model = CollisionDetector(num_frames=4, hidden_dim=32, num_gru_layers=1).cuda()
        model.eval()
        dummy_input = torch.randn(1, 4, 3, 224, 224, device="cuda")
        with torch.no_grad():
            outputs = model(dummy_input)
        res["prob"] = outputs["prob"]

    prev_stack = threading.stack_size(8 * 1024 * 1024)
    try:
        t = threading.Thread(target=_run)
        t.start()
        t.join()
    finally:
        threading.stack_size(prev_stack)

    assert "prob" in res
    assert res["prob"].is_cuda
    assert res["prob"].shape == (1, 1)


# =====================================================================
# 2. Behavior Engine Tests
# =====================================================================

def test_behavior_engine_normal_driving():
    """A straight-line steady-speed trajectory must be classified as NORMAL."""
    engine = BehaviorEngine()
    points = []
    # 20 frames at 30 fps moving steadily in X direction at ~150 px/s
    for i in range(20):
        t = i / 30.0
        x = 100.0 + 5.0 * i
        y = 300.0
        points.append(
            TrajectoryPoint(
                frame_idx=i,
                timestamp=t,
                bbox=(x - 20, y - 15, x + 20, y + 15),
                centroid=(x, y),
                width=40.0,
                height=30.0,
            )
        )
    profile = engine.analyze_trajectory(track_id=1, class_name="car", points=points)
    assert profile.behavior_label == "NORMAL"
    assert len(profile.anomalies) == 0
    assert profile.confidence >= 0.8


def test_behavior_engine_abnormal_swerving_and_braking():
    """A trajectory with extreme lateral swerving and hard braking must trigger anomalies."""
    engine = BehaviorEngine()
    points = []
    # Zig-zag path with sudden speed drop
    for i in range(20):
        t = i / 30.0
        # High frequency lateral displacement
        y = 300.0 + 80.0 * np.sin(i * 1.5)
        # Fast then sudden dead stop
        x = 100.0 + (100.0 * i if i < 10 else 1000.0)
        points.append(
            TrajectoryPoint(
                frame_idx=i,
                timestamp=t,
                bbox=(x - 20, y - 15, x + 20, y + 15),
                centroid=(x, y),
                width=40.0,
                height=30.0,
            )
        )
    profile = engine.analyze_trajectory(track_id=2, class_name="car", points=points)
    assert profile.behavior_label in ("ABNORMAL_DRIVING_CANDIDATE", "REVIEW_REQUIRED")
    assert len(profile.anomalies) > 0


# =====================================================================
# 3. Hit-and-Run State Machine Tests
# =====================================================================

def test_hit_and_run_no_collision():
    """When no collision is detected, state machine returns NO_INCIDENT."""
    fsm = HitAndRunStateMachine()
    res = fsm.evaluate(
        collision_detected=False,
        collision_time=5.0,
        tracks={},
    )
    assert res.is_hit_and_run_candidate is False
    assert res.status_label == "NO_INCIDENT"


def test_hit_and_run_detection_candidate():
    """When collision occurs and one vehicle flees at high speed, candidate is flagged."""
    fsm = HitAndRunStateMachine(impact_proximity_px=100.0, departure_speed_threshold_px_s=50.0)

    # Collision at t = 2.0s
    coll_t = 2.0
    tracks = {
        # Vehicle 1: Victim - stops at impact site (x=500, y=300)
        1: [
            TrackObservation(frame_idx=0, timestamp=1.0, bbox=(480, 280, 520, 320), centroid=(500, 300), speed=50.0),
            TrackObservation(frame_idx=30, timestamp=2.0, bbox=(480, 280, 520, 320), centroid=(500, 300), speed=0.0),
            TrackObservation(frame_idx=60, timestamp=3.0, bbox=(480, 280, 520, 320), centroid=(500, 300), speed=0.0),
            TrackObservation(frame_idx=90, timestamp=4.0, bbox=(480, 280, 520, 320), centroid=(500, 300), speed=0.0),
        ],
        # Vehicle 2: Offender - impacts at (510, 305) then accelerates east towards edge
        2: [
            TrackObservation(frame_idx=0, timestamp=1.0, bbox=(400, 290, 440, 330), centroid=(420, 310), speed=60.0),
            TrackObservation(frame_idx=30, timestamp=2.0, bbox=(490, 285, 530, 325), centroid=(510, 305), speed=20.0),
            TrackObservation(frame_idx=60, timestamp=3.0, bbox=(700, 285, 740, 325), centroid=(720, 305), speed=210.0),
            TrackObservation(frame_idx=90, timestamp=4.0, bbox=(1250, 285, 1290, 325), centroid=(1270, 305), speed=250.0),
        ],
    }

    res = fsm.evaluate(
        collision_detected=True,
        collision_time=coll_t,
        tracks=tracks,
        frame_width=1280,
        frame_height=720,
    )

    assert res.is_hit_and_run_candidate is True
    assert res.status_label == "HIT_AND_RUN_CANDIDATE"
    assert res.offending_track_id == 2
    assert res.victim_track_id == 1
    assert res.departure_heading == "EAST"


def test_hit_and_run_collision_without_departure():
    """When collision occurs and both vehicles remain stationary at the scene, NO hit-and-run is flagged."""
    fsm = HitAndRunStateMachine(impact_proximity_px=100.0, departure_speed_threshold_px_s=50.0)

    coll_t = 2.0
    tracks = {
        # Vehicle 1: stays at impact site (500, 300)
        1: [
            TrackObservation(frame_idx=0, timestamp=1.0, bbox=(480, 280, 520, 320), centroid=(500, 300), speed=45.0),
            TrackObservation(frame_idx=30, timestamp=2.0, bbox=(480, 280, 520, 320), centroid=(500, 300), speed=0.0),
            TrackObservation(frame_idx=60, timestamp=3.0, bbox=(480, 280, 520, 320), centroid=(500, 300), speed=0.0),
            TrackObservation(frame_idx=90, timestamp=4.0, bbox=(480, 280, 520, 320), centroid=(500, 300), speed=0.0),
        ],
        # Vehicle 2: impacts at (510, 305) and also remains stopped next to Vehicle 1
        2: [
            TrackObservation(frame_idx=0, timestamp=1.0, bbox=(420, 290, 460, 330), centroid=(440, 310), speed=50.0),
            TrackObservation(frame_idx=30, timestamp=2.0, bbox=(490, 285, 530, 325), centroid=(510, 305), speed=0.0),
            TrackObservation(frame_idx=60, timestamp=3.0, bbox=(492, 285, 532, 325), centroid=(512, 305), speed=2.0),
            TrackObservation(frame_idx=90, timestamp=4.0, bbox=(490, 285, 530, 325), centroid=(510, 305), speed=0.0),
        ],
    }

    res = fsm.evaluate(
        collision_detected=True,
        collision_time=coll_t,
        tracks=tracks,
        frame_width=1280,
        frame_height=720,
    )

    assert res.is_hit_and_run_candidate is False
    assert res.status_label == "COLLISION_WITHOUT_DEPARTURE"
    assert res.offending_track_id is None
    assert "NO HIT-AND-RUN" in res.reason


# =====================================================================
# 4. ANPR Subsystem Tests
# =====================================================================

def test_anpr_regex_validation():
    """Verify Indian vehicle registration plate regex patterns."""
    engine = ANPREngine(use_gpu=False)
    valid_plates = ["MH12DE1433", "DL3CA1234", "KA01AB1234", "UP16B1234", "HR26DK8337"]
    for plate in valid_plates:
        assert engine.validate_indian_plate(plate) is True, f"Failed on valid plate {plate}"

    invalid_plates = ["1234", "ABC", "NOT_A_PLATE", "INVALIDPLATE123", ""]
    for plate in invalid_plates:
        assert engine.validate_indian_plate(plate) is False, f"Falsely validated invalid plate {plate}"


def test_anpr_clean_text():
    """Verify character sanitization for license plates."""
    engine = ANPREngine(use_gpu=False)
    cleaned = engine.clean_plate_text(" mh 12 - de 1433 ! ")
    assert cleaned == "MH12DE1433"


def test_anpr_empty_input():
    """Verify ANPREngine returns NO_PLATE_DETECTED on empty/blank frames without throwing."""
    engine = ANPREngine(use_gpu=False)
    blank_frame = np.zeros((100, 100, 3), dtype=np.uint8)
    res = engine.detect_and_read(blank_frame)
    assert res.plate_text is None
    assert res.confidence == 0.0
    assert res.status in ("NO_PLATE_DETECTED", "UNREADABLE")


# =====================================================================
# 5. Evidence Manager Tests
# =====================================================================

def test_evidence_packet_generation():
    """Verify evidence manifest creation and SHA-256 calculation."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        mgr = EvidenceManager(base_output_dir=Path(tmp_dir))
        run_id = "test_run_123"

        # Create dummy video
        v_path = Path(tmp_dir) / "dummy.mp4"
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(v_path), fourcc, 10.0, (160, 120))
        for _ in range(15):
            writer.write(np.zeros((120, 160, 3), dtype=np.uint8))
        writer.release()

        incident_info = {
            "run_id": run_id,
            "timestamp": "2026-09-24T19:00:00Z",
            "collision": {"detected": True, "confidence": 0.92},
            "gps_coordinates": None,
        }

        packet = mgr.create_packet(
            run_id=run_id,
            incident_data=incident_info,
            video_path=str(v_path),
            peak_timestamp_sec=0.75,
        )

        assert packet["packet_id"].startswith("EV-INC-")
        manifest_path = Path(tmp_dir) / run_id / "evidence_manifest.json"
        assert manifest_path.exists()

        with open(manifest_path, "r") as f:
            manifest = json.load(f)

        assert manifest["run_id"] == run_id
        assert "incident.json" in manifest["files"]
        assert "sha256" in manifest["files"]["incident.json"]
        assert len(manifest["files"]["incident.json"]["sha256"]) == 64


# =====================================================================
# 6. API Route & Contract Tests
# =====================================================================

def test_health_endpoint_includes_incident():
    """Verify /health returns 200 and lists incident module."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "incident" in data["modules"]
    assert "road_infrastructure" in data["modules"]
    assert "traffic" in data["modules"]


def test_api_incident_unsupported_media():
    """Verify POST /api/incident/analyze rejects non-video files with 415."""
    files = {"video": ("test.txt", b"not a video", "text/plain")}
    resp = client.post("/api/incident/analyze", files=files)
    assert resp.status_code == 415


def test_api_incident_run_not_found():
    """Verify GET /api/incident/runs/{nonexistent} returns 404."""
    resp = client.get("/api/incident/runs/nonexistent_id_9999")
    assert resp.status_code == 404


def test_api_incident_evidence_not_found():
    """Verify GET /api/incident/runs/{nonexistent}/evidence returns 404."""
    resp = client.get("/api/incident/runs/nonexistent_id_9999/evidence")
    assert resp.status_code == 404


def test_incident_alert_summary_schema():
    """Verify IncidentAlertSummary unified contract conforms to Person 4 specification."""
    from ai.incident.schemas import IncidentAlertSummary
    summary = IncidentAlertSummary(
        incident_id="INC_test123",
        incident_type="COLLISION_CANDIDATE",
        status="REVIEW_REQUIRED",
        confidence=0.88,
        timestamp="2026-09-24T22:00:00Z",
        gps={"latitude": 28.6139, "longitude": 77.2090},
        vehicle={"track_id": 4, "role": "offending_vehicle"},
        anpr={"plate_number": "DL01AB1234", "plate_confidence": 0.95, "status": "DETECTED"},
        evidence={"before": "outputs/api_runs/incident/test123/before.jpg"},
    )
    dumped = summary.model_dump()
    assert dumped["incident_id"] == "INC_test123"
    assert dumped["incident_type"] == "COLLISION_CANDIDATE"
    assert dumped["status"] == "REVIEW_REQUIRED"
    assert dumped["confidence"] == 0.88
    assert dumped["gps"]["latitude"] == 28.6139
    assert dumped["anpr"]["plate_number"] == "DL01AB1234"


def test_api_incident_alerts_list():
    """Verify GET /api/incident/alerts returns 200 and list of alerts for Command Center."""
    resp = client.get("/api/incident/alerts")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_api_incident_alert_not_found():
    """Verify GET /api/incident/alerts/{nonexistent} returns 404."""
    resp = client.get("/api/incident/alerts/nonexistent_id_9999")
    assert resp.status_code == 404

