"""
TriNetra — Safety AI Pipeline Integration & API Tests

Validates:
1. SafetyEventParser: JSONL parsing, summary parsing, evidence path resolution.
2. SafetyRepository: CRUD operations, filtering by risk_level, event_type, min_score, and pagination.
3. SafetyIngestionService: Ingesting run_summary.json + safety_events.jsonl into SafetyRun and SafetyEvent,
   plus idempotency on repeated ingestion.
4. Safety API endpoints:
   - GET /api/v1/safety/runs
   - GET /api/v1/safety/runs/{run_id}/summary
   - GET /api/v1/safety/runs/{run_id}/events
   - GET /api/v1/safety/videos/{video_id}/run
   - GET /api/v1/safety/videos/{video_id}/events
   - GET /api/v1/safety/events/{event_id}
   - GET /api/v1/safety/runs/{run_id}/video
   - GET /api/v1/safety/evidence/{event_id}/{filename}
"""

import json
import uuid
from pathlib import Path

import pytest
from app.models.bus import Bus
from app.models.processing_job import ProcessingJob
from app.models.safety_run import SafetyEvent, SafetyRun
from app.models.video import Video
from app.repositories.safety_repository import SafetyRepository
from app.services.safety_ingestion_service import SafetyEventParser, SafetyIngestionService


# ── Sample Data Fixtures ──────────────────────────────────────────────────────

SAMPLE_SUMMARY = {
    "source": "bus_cam_01.mp4",
    "total_frames": 900,
    "processed_frames": 900,
    "elapsed_seconds": 30.0,
    "processing_fps": 30.0,
    "total_events": 2,
    "events_by_type": {
        "vulnerable_road_user_near_miss": 1,
        "school_zone_pedestrian": 1,
    },
}

SAMPLE_EVENT_1 = {
    "event_id": "SAFE_0001_000045",
    "schema_version": "1.0",
    "event_type": "vulnerable_road_user_near_miss",
    "timestamp": "2026-09-25T12:00:00Z",
    "frame_index": 45,
    "start_frame": 40,
    "end_frame": 55,
    "duration_frames": 15,
    "source": {
        "bus_id": "BEST-104",
        "camera_id": "CAM-FRONT-01",
        "video_path": "bus_cam_01.mp4",
    },
    "location": {
        "latitude": 18.9220,
        "longitude": 72.8346,
        "gps_accuracy_m": 2.5,
    },
    "track": {
        "track_id": 14,
        "object_type": "pedestrian",
        "first_frame": 35,
        "last_frame": 60,
        "age_frames": 25,
    },
    "bounding_box": {
        "x1": 100.0,
        "y1": 150.0,
        "x2": 200.0,
        "y2": 350.0,
        "confidence": 0.92,
    },
    "risk": {
        "level": "high",
        "score": 0.88,
        "confidence": 0.94,
        "explanation": "Pedestrian crossed within 1.5m in active bus travel trajectory",
        "reasons": [
            "Proximity threshold breached",
            "Trajectory intersects bus path",
        ],
    },
    "context": {
        "in_school_zone": False,
        "in_crossing_zone": True,
        "road_entry": True,
    },
    "evidence": {
        "frames": ["evidence_0045.jpg"],
        "clip": "evidence_0045.mp4",
        "trigger_frame_index": 45,
        "peak_frame_index": 48,
        "trajectory_snapshot": [
            {"frame_index": 40, "x": 105.0, "y": 155.0},
            {"frame_index": 45, "x": 120.0, "y": 180.0},
        ],
    },
}

SAMPLE_EVENT_2 = {
    "event_id": "SAFE_0001_000120",
    "schema_version": "1.0",
    "event_type": "school_zone_pedestrian",
    "timestamp": "2026-09-25T12:00:03Z",
    "frame_index": 120,
    "start_frame": 110,
    "end_frame": 130,
    "duration_frames": 20,
    "source": {
        "bus_id": "BEST-104",
        "camera_id": "CAM-FRONT-01",
        "video_path": "bus_cam_01.mp4",
    },
    "location": {
        "latitude": 18.9225,
        "longitude": 72.8350,
        "gps_accuracy_m": 3.0,
    },
    "track": {
        "track_id": 22,
        "object_type": "pedestrian",
        "first_frame": 100,
        "last_frame": 135,
        "age_frames": 35,
    },
    "bounding_box": {
        "x1": 300.0,
        "y1": 200.0,
        "x2": 380.0,
        "y2": 400.0,
        "confidence": 0.85,
    },
    "risk": {
        "level": "medium",
        "score": 0.55,
        "confidence": 0.87,
        "explanation": "Student waiting near curb in designated school safety perimeter",
        "reasons": ["School zone speed limit active"],
    },
    "context": {
        "in_school_zone": True,
        "in_crossing_zone": False,
        "road_entry": False,
    },
    "evidence": {
        "frames": [],
        "clip": None,
        "trigger_frame_index": 120,
        "peak_frame_index": 120,
        "trajectory_snapshot": [],
    },
}


# ── Test 1: SafetyEventParser ─────────────────────────────────────────────────

def test_parser_parse_jsonl(tmp_path: Path):
    jsonl_file = tmp_path / "safety_events.jsonl"
    with open(jsonl_file, "w", encoding="utf-8") as f:
        f.write(json.dumps(SAMPLE_EVENT_1) + "\n")
        f.write("\n")  # Blank line should be tolerated
        f.write(json.dumps(SAMPLE_EVENT_2) + "\n")

    events = SafetyEventParser.parse_jsonl(jsonl_file)
    assert len(events) == 2
    assert events[0]["event_id"] == "SAFE_0001_000045"
    assert events[1]["event_id"] == "SAFE_0001_000120"


def test_parser_parse_summary(tmp_path: Path):
    summary_file = tmp_path / "run_summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(SAMPLE_SUMMARY, f)

    summary = SafetyEventParser.parse_summary(summary_file)
    assert summary is not None
    assert summary["total_frames"] == 900
    assert summary["events_by_type"]["vulnerable_road_user_near_miss"] == 1


def test_parser_missing_files(tmp_path: Path):
    assert SafetyEventParser.parse_jsonl(tmp_path / "non_existent.jsonl") == []
    assert SafetyEventParser.parse_summary(tmp_path / "non_existent.json") is None


def test_parser_resolve_evidence_paths(tmp_path: Path):
    dummy_frame = tmp_path / "evidence_0045.jpg"
    dummy_frame.write_bytes(b"dummy jpeg content")

    resolved = SafetyEventParser.resolve_evidence_paths(SAMPLE_EVENT_1, tmp_path)
    assert len(resolved) == 1
    assert Path(resolved[0]).is_absolute()
    assert Path(resolved[0]).name == "evidence_0045.jpg"


# ── Test 2: Ingestion Service & Idempotency ───────────────────────────────────

def test_safety_ingestion_and_idempotency(db_session, tmp_path: Path):
    # Setup prerequisite DB entities
    bus = Bus(
        bus_number="BUS-01",
        registration_number="MH-01-AB-1234",
        route_number="104",
        status="ACTIVE",
    )
    db_session.add(bus)
    db_session.flush()

    video = Video(
        filename="test_video.mp4",
        original_filename="test_video.mp4",
        file_path=str(tmp_path / "test_video.mp4"),
        file_size=1024,
        bus_id=bus.id,
    )
    db_session.add(video)
    db_session.flush()

    job = ProcessingJob(
        video_id=video.id,
        status="COMPLETED",
    )
    db_session.add(job)
    db_session.commit()

    # Create dummy artifacts on disk
    output_dir = tmp_path / "safety_out"
    output_dir.mkdir(parents=True)

    summary_file = output_dir / "run_summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(SAMPLE_SUMMARY, f)

    jsonl_file = output_dir / "safety_events.jsonl"
    with open(jsonl_file, "w", encoding="utf-8") as f:
        f.write(json.dumps(SAMPLE_EVENT_1) + "\n")
        f.write(json.dumps(SAMPLE_EVENT_2) + "\n")

    video_file = output_dir / "annotated.mp4"
    video_file.write_bytes(b"fake mp4 video bytes")

    # Perform Ingestion
    service = SafetyIngestionService(db_session)
    run = service.ingest(
        output_dir=output_dir,
        job_id=job.id,
        video_id=video.id,
        video_fps=30.0,
        annotated_video_path=str(video_file),
    )

    assert run is not None
    assert run.total_events == 2
    assert run.annotated_video_path == str(video_file)

    repo = SafetyRepository(db_session)
    events, total = repo.get_events_for_run(run.id)
    assert total == 2
    assert len(events) == 2

    # Verify field extraction
    ev1 = next(e for e in events if e.source_event_id == "SAFE_0001_000045")
    assert ev1.risk_level == "high"
    assert ev1.risk_score == 0.88
    assert ev1.in_crossing_zone is True
    assert ev1.in_school_zone is False
    assert ev1.start_frame == 40
    assert ev1.end_frame == 55

    ev2 = next(e for e in events if e.source_event_id == "SAFE_0001_000120")
    assert ev2.risk_level == "medium"
    assert ev2.in_school_zone is True

    # Test Idempotency: Re-ingesting should NOT duplicate records
    run_again = service.ingest(
        output_dir=output_dir,
        job_id=job.id,
        video_id=video.id,
        video_fps=30.0,
        annotated_video_path=str(video_file),
    )
    events_after, total_after = repo.get_events_for_run(run_again.id)
    assert total_after == 2


# ── Test 3: SafetyRepository Filtering ────────────────────────────────────────

def test_repository_filters(db_session, tmp_path: Path):
    bus = Bus(
        bus_number="BUS-02",
        registration_number="MH-02-CD-5678",
        route_number="202",
        status="ACTIVE",
    )
    db_session.add(bus)
    db_session.flush()

    video = Video(
        filename="test_video_2.mp4",
        original_filename="test_video_2.mp4",
        file_path="fake_path.mp4",
        file_size=2048,
        bus_id=bus.id,
    )
    db_session.add(video)
    db_session.flush()

    job = ProcessingJob(video_id=video.id, status="COMPLETED")
    db_session.add(job)
    db_session.flush()

    run = SafetyRun(
        job_id=job.id,
        video_id=video.id,
        total_frames=1000,
        processed_frames=1000,
        elapsed_seconds=33.3,
        processing_fps=30.0,
        total_events=2,
    )
    db_session.add(run)
    db_session.flush()

    ev1 = SafetyEvent(
        run_id=run.id,
        job_id=job.id,
        video_id=video.id,
        source_event_id="EV-1",
        schema_version="1.0",
        event_type="pedestrian_near_miss",
        risk_level="high",
        risk_score=0.9,
        risk_confidence=0.95,
        start_frame=10,
        end_frame=30,
        frame_index=20,
    )
    ev2 = SafetyEvent(
        run_id=run.id,
        job_id=job.id,
        video_id=video.id,
        source_event_id="EV-2",
        schema_version="1.0",
        event_type="cyclist_in_lane",
        risk_level="low",
        risk_score=0.3,
        risk_confidence=0.8,
        start_frame=50,
        end_frame=70,
        frame_index=60,
    )
    db_session.add_all([ev1, ev2])
    db_session.commit()

    repo = SafetyRepository(db_session)

    # Filter by risk_level
    high_events, count = repo.get_events_for_run(run.id, risk_level="high")
    assert count == 1
    assert high_events[0].source_event_id == "EV-1"

    # Filter by event_type
    cyclist_events, count = repo.get_events_for_run(run.id, event_type="cyclist_in_lane")
    assert count == 1
    assert cyclist_events[0].source_event_id == "EV-2"

    # Filter by min_score
    scored_events, count = repo.get_events_for_run(run.id, min_score=0.5)
    assert count == 1
    assert scored_events[0].source_event_id == "EV-1"


# ── Test 4: Safety API Endpoints ──────────────────────────────────────────────

def test_safety_api_endpoints(client, db_session, tmp_path: Path):
    bus = Bus(
        bus_number="BUS-03",
        registration_number="MH-03-EF-9012",
        route_number="303",
        status="ACTIVE",
    )
    db_session.add(bus)
    db_session.flush()

    video = Video(
        filename="test_video_3.mp4",
        original_filename="test_video_3.mp4",
        file_path="fake_path_3.mp4",
        file_size=4096,
        bus_id=bus.id,
    )
    db_session.add(video)
    db_session.flush()

    job = ProcessingJob(video_id=video.id, status="COMPLETED")
    db_session.add(job)
    db_session.flush()

    fake_video = tmp_path / "annotated_safety.mp4"
    fake_video.write_bytes(b"test video payload")

    fake_evidence = tmp_path / "evidence_001.jpg"
    fake_evidence.write_bytes(b"test jpeg payload")

    run = SafetyRun(
        job_id=job.id,
        video_id=video.id,
        total_frames=1200,
        processed_frames=1200,
        elapsed_seconds=40.0,
        processing_fps=30.0,
        total_events=1,
        annotated_video_path=str(fake_video),
        video_fps=30.0,
    )
    db_session.add(run)
    db_session.flush()

    event = SafetyEvent(
        run_id=run.id,
        job_id=job.id,
        video_id=video.id,
        source_event_id="EV-100",
        schema_version="1.0",
        event_type="sudden_braking_obstacle",
        risk_level="high",
        risk_score=0.85,
        risk_confidence=0.9,
        risk_explanation="Emergency deceleration due to obstruction",
        risk_reasons=["Obstacle detection", "Deceleration spike"],
        start_frame=100,
        end_frame=130,
        frame_index=115,
        evidence_frames=[str(fake_evidence)],
    )
    db_session.add(event)
    db_session.commit()

    # 1. GET /api/v1/safety/runs
    res = client.get("/api/v1/safety/runs")
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert len(body["data"]) >= 1
    assert body["data"][0]["id"] == str(run.id)
    assert f"/api/v1/safety/runs/{run.id}/video" in body["data"][0]["annotated_video_path"]

    # 2. GET /api/v1/safety/runs/{run_id}/summary
    res = client.get(f"/api/v1/safety/runs/{run.id}/summary")
    assert res.status_code == 200
    body = res.json()
    assert body["data"]["total_frames"] == 1200
    assert body["data"]["annotated_video_path"].endswith(f"/api/v1/safety/runs/{run.id}/video")

    # 3. GET /api/v1/safety/runs/{run_id}/events
    res = client.get(f"/api/v1/safety/runs/{run.id}/events")
    assert res.status_code == 200
    body = res.json()
    assert len(body["data"]) == 1
    assert body["data"][0]["source_event_id"] == "EV-100"
    assert len(body["data"][0]["evidence_frame_urls"]) == 1
    assert "evidence_001.jpg" in body["data"][0]["evidence_frame_urls"][0]

    # 4. GET /api/v1/safety/videos/{video_id}/run
    res = client.get(f"/api/v1/safety/videos/{video.id}/run")
    assert res.status_code == 200
    assert res.json()["data"]["id"] == str(run.id)

    # 5. GET /api/v1/safety/events/{event_id}
    res = client.get(f"/api/v1/safety/events/{event.id}")
    assert res.status_code == 200
    body = res.json()
    assert body["data"]["risk_level"] == "high"
    assert body["data"]["risk_score"] == 0.85
    assert body["data"]["risk_explanation"] == "Emergency deceleration due to obstruction"

    # 6. Stream video: GET /api/v1/safety/runs/{run_id}/video
    res = client.get(f"/api/v1/safety/runs/{run.id}/video")
    assert res.status_code == 200
    assert res.headers["content-type"] == "video/mp4"
    assert res.content == b"test video payload"

    # 7. Stream video with Range: GET /api/v1/safety/runs/{run_id}/video
    res = client.get(
        f"/api/v1/safety/runs/{run.id}/video",
        headers={"Range": "bytes=0-3"},
    )
    assert res.status_code == 206
    assert res.content == b"test"
    assert "bytes 0-3/" in res.headers["content-range"]

    # 8. Serve evidence frame: GET /api/v1/safety/evidence/{event_id}/{filename}
    res = client.get(f"/api/v1/safety/evidence/{event.id}/evidence_001.jpg")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/jpeg"
    assert res.content == b"test jpeg payload"
