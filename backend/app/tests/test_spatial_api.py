"""
UrbanEye AI — Spatial & Map GIS API Tests

Tests:
  • GeoJSON standard compliance (RFC 7946, [lng, lat] coordinate order)
  • Bounding box parsing and spatial filtering
  • Category, severity, and status query filters
  • Nearby event radius query
  • Heatmap and route LineString endpoints
  • Bbox and coordinate validation (error cases)
"""

from fastapi.testclient import TestClient

from app.models.bus import Bus
from app.models.processing_job import ProcessingJob
from app.models.urban_event import UrbanEvent
from app.models.video import Video


def _seed_data(db_session):
    bus1 = Bus(
        bus_number="BUS-SPATIAL-01",
        registration_number="KA-01-SP-1001",
        route_number="R-500A",
        status="ACTIVE",
        latitude=12.9716,
        longitude=77.5946,
        heading=90.0,
        speed=35.5,
    )
    bus2 = Bus(
        bus_number="BUS-SPATIAL-02",
        registration_number="KA-01-SP-1002",
        route_number="R-MG1",
        status="MAINTENANCE",
        latitude=13.0350,
        longitude=77.5650,
        heading=180.0,
        speed=0.0,
    )
    db_session.add_all([bus1, bus2])
    db_session.commit()
    db_session.refresh(bus1)
    db_session.refresh(bus2)

    video = Video(
        bus_id=bus1.id,
        filename="spatial_run.mp4",
        original_filename="spatial_run.mp4",
        file_path="uploads/spatial_run.mp4",
        file_size=1000000,
        status="COMPLETED",
    )
    db_session.add(video)
    db_session.commit()
    db_session.refresh(video)

    job = ProcessingJob(
        video_id=video.id,
        status="COMPLETED",
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)

    ev1 = UrbanEvent(
        video_id=video.id,
        job_id=job.id,
        event_type="POTHOLE",
        category="HAZARD",
        severity="HIGH",
        confidence=0.92,
        frame_number=120,
        timestamp=4.0,
        latitude=12.9720,
        longitude=77.5950,
        description="Severe pothole near MG Road signal",
        extra_metadata={"laplacian_var": 1350.0},
    )
    ev2 = UrbanEvent(
        video_id=video.id,
        job_id=job.id,
        event_type="NEAR_MISS",
        category="SAFETY",
        severity="CRITICAL",
        confidence=0.96,
        frame_number=240,
        timestamp=8.0,
        latitude=12.9750,
        longitude=77.6000,
        description="Pedestrian near-miss conflict",
        extra_metadata={"distance_px": 24.5},
    )
    ev3 = UrbanEvent(
        video_id=video.id,
        job_id=job.id,
        event_type="WATERLOGGING",
        category="HAZARD",
        severity="MEDIUM",
        confidence=0.85,
        frame_number=360,
        timestamp=12.0,
        latitude=13.0500,  # North Bengaluru (outside central bbox)
        longitude=77.5800,
        description="Monsoon puddle covering half lane",
        extra_metadata={"area_px": 4500},
    )
    db_session.add_all([ev1, ev2, ev3])
    db_session.commit()
    db_session.refresh(ev1)
    db_session.refresh(ev2)
    db_session.refresh(ev3)

    return {"bus1": bus1, "bus2": bus2, "video": video, "ev1": ev1, "ev2": ev2, "ev3": ev3}


class TestSpatialMapEndpoints:
    def test_get_map_events_geojson(self, client: TestClient, db_session):
        """Should return RFC 7946 FeatureCollection with [lng, lat] order."""
        data_seeded = _seed_data(db_session)
        response = client.get("/api/v1/map/events")
        assert response.status_code == 200
        data = response.json()

        assert data["type"] == "FeatureCollection"
        assert len(data["features"]) >= 3

        feat = data["features"][0]
        assert feat["type"] == "Feature"
        assert feat["geometry"]["type"] == "Point"
        coords = feat["geometry"]["coordinates"]
        assert len(coords) == 2
        # Verify [longitude, latitude] ordering
        assert 70.0 < coords[0] < 80.0
        assert 10.0 < coords[1] < 15.0
        assert "event_id" in feat["properties"]
        assert "severity" in feat["properties"]

    def test_get_map_events_bbox_filter(self, client: TestClient, db_session):
        """Bbox query should only return events inside bounds."""
        data_seeded = _seed_data(db_session)
        # Central Bengaluru bbox: contains ev1 and ev2, excludes ev3
        bbox = "77.59,12.97,77.61,12.98"
        response = client.get(f"/api/v1/map/events?bbox={bbox}")
        assert response.status_code == 200
        data = response.json()

        returned_ids = [f["properties"]["event_id"] for f in data["features"]]
        assert str(data_seeded["ev1"].id) in returned_ids
        assert str(data_seeded["ev2"].id) in returned_ids
        assert str(data_seeded["ev3"].id) not in returned_ids

    def test_get_map_events_filters(self, client: TestClient, db_session):
        """Filtering by category and severity should narrow results."""
        _seed_data(db_session)
        response = client.get("/api/v1/map/events?severity=CRITICAL")
        assert response.status_code == 200
        data = response.json()
        assert len(data["features"]) == 1
        assert data["features"][0]["properties"]["severity"] == "CRITICAL"

        resp_cat = client.get("/api/v1/map/events?category=HAZARD")
        assert resp_cat.status_code == 200
        assert len(resp_cat.json()["features"]) == 2

    def test_get_map_buses_geojson(self, client: TestClient, db_session):
        """Should return bus features with status and heading."""
        _seed_data(db_session)
        response = client.get("/api/v1/map/buses")
        assert response.status_code == 200
        data = response.json()

        assert data["type"] == "FeatureCollection"
        assert len(data["features"]) >= 2

        bus_feat = data["features"][0]
        assert bus_feat["geometry"]["type"] == "Point"
        assert "speed" in bus_feat["properties"]
        assert "heading" in bus_feat["properties"]

    def test_get_map_routes(self, client: TestClient, db_session):
        """Should return LineString route features."""
        response = client.get("/api/v1/map/routes")
        assert response.status_code == 200
        data = response.json()

        assert data["type"] == "FeatureCollection"
        assert len(data["features"]) > 0
        route = data["features"][0]
        assert route["geometry"]["type"] == "LineString"
        assert len(route["geometry"]["coordinates"]) >= 2
        # First coord should be [lng, lat]
        assert len(route["geometry"]["coordinates"][0]) == 2

    def test_get_nearby_events(self, client: TestClient, db_session):
        """Should return events within radius of a target point."""
        data_seeded = _seed_data(db_session)
        # Query near ev1: (12.9720, 77.5950) with 300m radius
        response = client.get(
            "/api/v1/map/events/nearby?latitude=12.9720&longitude=77.5950&radius_meters=300"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["features"]) >= 1
        assert data["features"][0]["properties"]["event_id"] == str(data_seeded["ev1"].id)

    def test_invalid_bbox_raises_400(self, client: TestClient, db_session):
        """Malformed or out-of-range bbox must return 400 Bad Request."""
        # Not 4 numbers
        resp1 = client.get("/api/v1/map/events?bbox=77.5,12.9,77.6")
        assert resp1.status_code == 400

        # Invalid float
        resp2 = client.get("/api/v1/map/events?bbox=abc,12.9,77.6,13.0")
        assert resp2.status_code == 400

        # minLng > maxLng
        resp3 = client.get("/api/v1/map/events?bbox=78.0,12.9,77.0,13.0")
        assert resp3.status_code == 400
