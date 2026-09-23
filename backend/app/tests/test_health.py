"""
UrbanEye AI — Health Endpoint Tests
"""


def test_health_check(client):
    """GET /api/v1/health should return 200 with healthy status."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "healthy"
    assert "service" in body["data"]
    assert "version" in body["data"]


def test_health_response_structure(client):
    """Health response should follow the standard SuccessResponse envelope."""
    response = client.get("/api/v1/health")
    body = response.json()
    assert "success" in body
    assert "message" in body
    assert "data" in body


def test_ai_health_check(client):
    """GET /api/v1/health/ai should return AI engine status."""
    response = client.get("/api/v1/health/ai")
    assert response.status_code == 200
    body = response.json()
    assert "success" in body
    assert "data" in body
    assert body["data"]["engine"] == "The-Sixth-Sense-AI"
    assert "models" in body["data"]

