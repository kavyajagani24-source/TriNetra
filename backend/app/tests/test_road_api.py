"""
UrbanEye AI — Sixth Sense Road API Integration Tests
"""
from pathlib import Path
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient


def test_road_analyze_validation_empty_file(client: TestClient):
    """Uploading an empty file should fail with 422 Unprocessable Entity."""
    response = client.post(
        "/api/road/analyze",
        files={"video": ("test.mp4", b"", "video/mp4")},
        data={"profile": "urban_mvp"},
    )
    assert response.status_code == 422


def test_road_analyze_invalid_extension(client: TestClient):
    """Uploading a non-video file should return 415 Unsupported Media Type."""
    response = client.post(
        "/api/road/analyze",
        files={"video": ("document.pdf", b"dummy pdf data", "application/pdf")},
        data={"profile": "urban_mvp"},
    )
    assert response.status_code == 415


def test_road_runs_nonexistent(client: TestClient):
    """Querying a non-existent run ID should return 404."""
    response = client.get("/api/road/runs/nonexistent_run_9999")
    assert response.status_code == 404
