"""
UrbanEye AI — Processing Job Endpoint Tests

Tests:
  - Create processing job for non-existent video (404)
  - Retrieve non-existent job (404)
  - Duplicate active job prevention (409)
"""

import uuid

import pytest

from app.core.constants import ProcessingStatus, VideoStatus
from app.models.processing_job import ProcessingJob
from app.models.video import Video


def _insert_video(db_session) -> Video:
    """Insert a minimal Video record directly into the test DB."""
    video = Video(
        filename="test_uuid.mp4",
        original_filename="test.mp4",
        file_path="/tmp/test_uuid.mp4",
        file_size=1024,
        status=VideoStatus.UPLOADED.value,
    )
    db_session.add(video)
    db_session.commit()
    db_session.refresh(video)
    return video


@pytest.fixture(autouse=True)
def mock_ai_worker():
    from unittest.mock import patch
    with patch("app.services.ai_processing_service.AIProcessingService.run_processing_job"):
        yield


class TestCreateProcessingJob:
    def test_create_job_video_not_found(self, client):
        """Creating a job for a missing video returns 404."""
        resp = client.post(f"/api/v1/videos/{uuid.uuid4()}/process")
        assert resp.status_code == 404

    def test_create_job_success(self, client, db_session):
        """Successfully create a QUEUED job for an existing video."""
        video = _insert_video(db_session)
        resp = client.post(f"/api/v1/videos/{video.id}/process")
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["status"] == "QUEUED"
        assert data["video_id"] == str(video.id)
        assert data["progress_percentage"] == 0

    def test_create_job_duplicate_queued(self, client, db_session):
        """A second job while one is QUEUED returns 409."""
        video = _insert_video(db_session)

        resp1 = client.post(f"/api/v1/videos/{video.id}/process")
        assert resp1.status_code == 201

        resp2 = client.post(f"/api/v1/videos/{video.id}/process")
        assert resp2.status_code == 409

    def test_create_job_duplicate_processing(self, client, db_session):
        """A second job while one is PROCESSING returns 409."""
        video = _insert_video(db_session)

        # Insert a PROCESSING job directly
        job = ProcessingJob(
            video_id=video.id,
            status=ProcessingStatus.PROCESSING.value,
            progress_percentage=50.0,
            frames_processed=100,
            events_detected=0,
        )
        db_session.add(job)
        db_session.commit()

        resp = client.post(f"/api/v1/videos/{video.id}/process")
        assert resp.status_code == 409


class TestGetProcessingJob:
    def test_get_job_not_found(self, client):
        """Fetching a non-existent job returns 404."""
        resp = client.get(f"/api/v1/processing/{uuid.uuid4()}")
        assert resp.status_code == 404

    def test_get_job_success(self, client, db_session):
        """Successfully retrieve a processing job by ID."""
        video = _insert_video(db_session)
        resp = client.post(f"/api/v1/videos/{video.id}/process")
        assert resp.status_code == 201
        job_id = resp.json()["data"]["job_id"]

        resp = client.get(f"/api/v1/processing/{job_id}")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["id"] == job_id
        assert data["status"] == "QUEUED"


class TestVideoProcessingStatus:
    def test_status_video_not_found(self, client):
        resp = client.get(f"/api/v1/videos/{uuid.uuid4()}/status")
        assert resp.status_code == 404

    def test_status_no_jobs(self, client, db_session):
        video = _insert_video(db_session)
        resp = client.get(f"/api/v1/videos/{video.id}/status")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["video_status"] == "UPLOADED"
        assert data["job_id"] is None

    def test_status_with_job(self, client, db_session):
        video = _insert_video(db_session)
        client.post(f"/api/v1/videos/{video.id}/process")

        resp = client.get(f"/api/v1/videos/{video.id}/status")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["job_status"] == "QUEUED"
        assert data["job_id"] is not None
