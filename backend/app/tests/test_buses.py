"""
UrbanEye AI — Bus Endpoint Tests

Tests:
  - Create bus (success)
  - Duplicate bus_number rejection (409)
  - List buses (with pagination)
  - Get single bus (success)
  - Get bus not found (404)
  - Update bus (success)
  - Delete bus (success)
"""

import uuid


BUS_PAYLOAD = {
    "bus_number": "BUS_001",
    "registration_number": "MH01AB1234",
    "route_number": "R101",
    "status": "ACTIVE",
}


def _create_bus(client, payload: dict = None) -> dict:
    """Helper: create a bus and return the response body data."""
    resp = client.post("/api/v1/buses", json=payload or BUS_PAYLOAD)
    assert resp.status_code == 201, resp.text
    return resp.json()["data"]


class TestCreateBus:
    def test_create_bus_success(self, client):
        data = _create_bus(client)
        assert data["bus_number"] == "BUS_001"
        assert data["status"] == "ACTIVE"
        assert "id" in data

    def test_create_bus_duplicate_number(self, client):
        _create_bus(client)
        resp = client.post("/api/v1/buses", json=BUS_PAYLOAD)
        assert resp.status_code == 409

    def test_create_bus_duplicate_registration(self, client):
        _create_bus(client)
        new_payload = {**BUS_PAYLOAD, "bus_number": "BUS_002"}
        resp = client.post("/api/v1/buses", json=new_payload)
        assert resp.status_code == 409

    def test_create_bus_defaults_active_status(self, client):
        payload = {"bus_number": "BUS_010"}
        resp = client.post("/api/v1/buses", json=payload)
        assert resp.status_code == 201
        assert resp.json()["data"]["status"] == "ACTIVE"

    def test_create_bus_missing_bus_number(self, client):
        resp = client.post("/api/v1/buses", json={"status": "ACTIVE"})
        assert resp.status_code == 422


class TestListBuses:
    def test_list_buses_empty(self, client):
        resp = client.get("/api/v1/buses")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 0
        assert body["data"] == []

    def test_list_buses_with_results(self, client):
        _create_bus(client)
        resp = client.get("/api/v1/buses")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert len(body["data"]) == 1

    def test_list_buses_status_filter(self, client):
        _create_bus(client)
        resp = client.get("/api/v1/buses?status=ACTIVE")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

        resp = client.get("/api/v1/buses?status=INACTIVE")
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    def test_list_buses_invalid_status(self, client):
        resp = client.get("/api/v1/buses?status=INVALID")
        assert resp.status_code == 422

    def test_list_buses_pagination(self, client):
        for i in range(5):
            client.post("/api/v1/buses", json={"bus_number": f"BUS_{i:03d}"})
        resp = client.get("/api/v1/buses?page=1&limit=3")
        body = resp.json()
        assert body["total"] == 5
        assert len(body["data"]) == 3
        assert body["total_pages"] == 2


class TestGetBus:
    def test_get_bus_success(self, client):
        created = _create_bus(client)
        resp = client.get(f"/api/v1/buses/{created['id']}")
        assert resp.status_code == 200
        assert resp.json()["data"]["id"] == created["id"]

    def test_get_bus_not_found(self, client):
        resp = client.get(f"/api/v1/buses/{uuid.uuid4()}")
        assert resp.status_code == 404


class TestUpdateBus:
    def test_update_bus_status(self, client):
        created = _create_bus(client)
        resp = client.put(
            f"/api/v1/buses/{created['id']}",
            json={"status": "INACTIVE"},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "INACTIVE"

    def test_update_bus_route(self, client):
        created = _create_bus(client)
        resp = client.put(
            f"/api/v1/buses/{created['id']}",
            json={"route_number": "R999"},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["route_number"] == "R999"

    def test_update_bus_not_found(self, client):
        resp = client.put(
            f"/api/v1/buses/{uuid.uuid4()}",
            json={"status": "INACTIVE"},
        )
        assert resp.status_code == 404


class TestDeleteBus:
    def test_delete_bus_success(self, client):
        created = _create_bus(client)
        resp = client.delete(f"/api/v1/buses/{created['id']}")
        assert resp.status_code == 200

        resp = client.get(f"/api/v1/buses/{created['id']}")
        assert resp.status_code == 404

    def test_delete_bus_not_found(self, client):
        resp = client.delete(f"/api/v1/buses/{uuid.uuid4()}")
        assert resp.status_code == 404
