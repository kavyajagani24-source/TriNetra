"""
Integration tests for Phase 2 AI results, tracking, and telemetry endpoints.
"""

import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.models.detection import Detection
from app.models.processing_job import ProcessingJob
from app.models.tracked_object import TrackedObject
from app.models.traffic_analytics import TrafficAnalytics
from app.models.trajectory import TrajectoryPoint
from app.models.video import Video


@pytest.fixture
def sample_video(db_session):
    video = Video(
        filename="test_ai_sample.mp4",
        original_filename="sample.mp4",
        file_path="/tmp/sample.mp4",
        file_size=1024 * 1024,
        format="mp4",
        fps=30.0,
        frame_count=300,
        duration=10.0,
        width=1280,
        height=720,
        status="UPLOADED",
    )
    db_session.add(video)
    db_session.commit()
    db_session.refresh(video)
    return video


@pytest.fixture
def sample_ai_data(db_session, sample_video):
    job = ProcessingJob(
        video_id=sample_video.id,
        status="COMPLETED",
        progress_percentage=100.0,
        frames_processed=300,
        total_frames=300,
        events_detected=3,
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)

    # Add detections
    d1 = Detection(
        video_id=sample_video.id,
        job_id=job.id,
        track_id=1,
        class_name="car",
        class_id=2,
        confidence=0.88,
        frame_number=10,
        timestamp=0.33,
        bbox_x1=100.0,
        bbox_y1=150.0,
        bbox_x2=200.0,
        bbox_y2=250.0,
        center_x=150.0,
        center_y=200.0,
    )
    db_session.add(d1)

    # Add tracked object
    t_obj = TrackedObject(
        video_id=sample_video.id,
        job_id=job.id,
        track_id=1,
        class_name="car",
        first_seen_frame=1,
        last_seen_frame=50,
        first_seen_timestamp=0.033,
        last_seen_timestamp=1.66,
        max_confidence=0.92,
        average_confidence=0.85,
        status="COMPLETED",
    )
    db_session.add(t_obj)
    db_session.commit()
    db_session.refresh(t_obj)

    # Add trajectory point
    traj_pt = TrajectoryPoint(
        tracked_object_id=t_obj.id,
        x=150.0,
        y=200.0,
        frame_number=10,
        timestamp=0.33,
        pixel_speed=25.0,
    )
    db_session.add(traj_pt)

    # Add traffic analytics
    ta = TrafficAnalytics(
        video_id=sample_video.id,
        job_id=job.id,
        timestamp=1.0,
        frame_number=30,
        active_vehicle_count=2,
        car_count=2,
        motorcycle_count=0,
        bus_count=0,
        truck_count=0,
        person_count=0,
        average_pixel_speed=22.5,
        traffic_density="LOW",
        congestion_level="LOW",
    )
    db_session.add(ta)
    db_session.commit()

    return {"job": job, "video": sample_video, "tracked_obj": t_obj}


def test_get_job_results(client: TestClient, sample_ai_data):
    job_id = sample_ai_data["job"].id
    response = client.get(f"/api/v1/processing/{job_id}/results")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["job_id"] == str(job_id)
    assert data["data"]["status"] == "COMPLETED"
    assert data["data"]["total_unique_vehicles"] == 3


def test_get_video_detections(client: TestClient, sample_ai_data):
    video_id = sample_ai_data["video"].id
    response = client.get(f"/api/v1/videos/{video_id}/detections")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["data"]) == 1
    assert data["data"][0]["class_name"] == "car"


def test_get_video_tracked_objects(client: TestClient, sample_ai_data):
    video_id = sample_ai_data["video"].id
    response = client.get(f"/api/v1/videos/{video_id}/tracked-objects")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["data"]) == 1
    assert data["data"][0]["track_id"] == 1


def test_get_object_trajectory(client: TestClient, sample_ai_data):
    obj_id = sample_ai_data["tracked_obj"].id
    response = client.get(f"/api/v1/tracked-objects/{obj_id}/trajectory")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["data"]) == 1
    assert data["data"][0]["pixel_speed"] == 25.0


def test_get_video_analytics(client: TestClient, sample_ai_data):
    video_id = sample_ai_data["video"].id
    response = client.get(f"/api/v1/videos/{video_id}/analytics")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["data"]) == 1
    assert data["data"][0]["traffic_density"] == "LOW"


def test_create_processing_job_dispatches_background(client: TestClient, sample_video):
    with patch("app.services.ai_processing_service.AIProcessingService.run_processing_job") as mock_run:
        response = client.post(f"/api/v1/videos/{sample_video.id}/process")
        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert data["data"]["status"] == "QUEUED"
        # Background task was scheduled and called
        assert mock_run.called
