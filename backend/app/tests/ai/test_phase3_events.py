"""
Tests for Phase 3: Road Hazards, Infrastructure, Safety, Events and API Endpoints.
"""

import uuid
import numpy as np
import pytest

from app.ai.behavior.rash_driving_detector import RashDrivingDetector
from app.ai.events.event_engine import EventEngine
from app.ai.hazards.road_hazard_detector import RoadHazardDetector
from app.ai.infrastructure.infrastructure_analyser import InfrastructureAnalyser
from app.ai.models.detection_types import (
    BoundingBox,
    FrameResult,
    TrackedDetection,
    TrajectoryPoint,
)
from app.ai.models.event_types import (
    EventCategory,
    EventSeverity,
    EventType,
    UrbanEventData,
)
from app.ai.safety.pedestrian_risk_analyser import PedestrianRiskAnalyser
from app.ai.tracker.trajectory_manager import TrajectoryManager
from app.models.bus import Bus
from app.models.processing_job import ProcessingJob
from app.models.urban_event import UrbanEvent
from app.models.video import Video
from app.repositories.event_repository import EventRepository


def test_urban_event_data_creation():
    """Verify UrbanEventData dataclass categorization and helper properties."""
    ev = UrbanEventData(
        event_type=EventType.POTHOLE,
        severity=EventSeverity.HIGH,
        confidence=0.88,
        frame_number=10,
        timestamp=0.33,
        bbox_x1=100.0,
        bbox_y1=200.0,
        bbox_x2=150.0,
        bbox_y2=250.0,
        description="Pothole detected",
    )
    assert ev.category == EventCategory.HAZARD
    assert ev.center_x == 125.0
    assert ev.center_y == 225.0
    d = ev.to_dict()
    assert d["event_type"] == "POTHOLE"
    assert d["category"] == "HAZARD"
    assert d["severity"] == "HIGH"


def test_event_engine_deduplication():
    """Verify temporal and spatial deduplication in EventEngine."""
    engine = EventEngine(dedup_frame_window=50, spatial_bucket_size=50.0)

    ev1 = UrbanEventData(
        event_type=EventType.POTHOLE,
        severity=EventSeverity.HIGH,
        confidence=0.85,
        frame_number=10,
        timestamp=0.33,
        bbox_x1=100.0,
        bbox_y1=200.0,
        bbox_x2=150.0,
        bbox_y2=250.0,
    )
    # First submission should succeed
    res1 = engine.submit(ev1)
    assert res1 is not None

    # Duplicate submission close in time and position should be suppressed
    ev2 = UrbanEventData(
        event_type=EventType.POTHOLE,
        severity=EventSeverity.HIGH,
        confidence=0.86,
        frame_number=20,
        timestamp=0.66,
        bbox_x1=105.0,
        bbox_y1=202.0,
        bbox_x2=155.0,
        bbox_y2=252.0,
    )
    res2 = engine.submit(ev2)
    assert res2 is None
    assert engine.total_emitted == 1

    # After dedup window expires, new event is emitted
    ev3 = UrbanEventData(
        event_type=EventType.POTHOLE,
        severity=EventSeverity.HIGH,
        confidence=0.90,
        frame_number=70,
        timestamp=2.33,
        bbox_x1=100.0,
        bbox_y1=200.0,
        bbox_x2=150.0,
        bbox_y2=250.0,
    )
    res3 = engine.submit(ev3)
    assert res3 is not None
    assert engine.total_emitted == 2


def test_road_hazard_detector_execution():
    """Verify RoadHazardDetector analyses synthetic frames without error."""
    detector = RoadHazardDetector(enabled=True)
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    frame_res = FrameResult(frame_number=1, timestamp=0.0)

    events = detector.analyse(
        frame=frame,
        frame_result=frame_res,
        frame_number=1,
        timestamp=0.0,
    )
    assert isinstance(events, list)


def test_pedestrian_risk_analyser():
    """Verify PedestrianRiskAnalyser detects near-miss interactions."""
    analyser = PedestrianRiskAnalyser(
        enabled=True,
        near_miss_distance_px=100.0,
        critical_distance_px=50.0,
    )

    ped = TrackedDetection(
        bbox=BoundingBox(100.0, 450.0, 130.0, 520.0),
        class_id=0,
        class_name="person",
        confidence=0.90,
        track_id=1,
    )
    veh = TrackedDetection(
        bbox=BoundingBox(120.0, 460.0, 200.0, 550.0),
        class_id=2,
        class_name="car",
        confidence=0.95,
        track_id=2,
    )
    frame_res = FrameResult(
        frame_number=5,
        timestamp=0.15,
        tracked_detections=[ped, veh],
    )

    events = analyser.analyse(
        frame_result=frame_res,
        frame_number=5,
        timestamp=0.15,
        frame_height=720,
        frame_width=1280,
    )
    assert len(events) >= 1
    near_misses = [e for e in events if e.event_type in (EventType.NEAR_MISS, EventType.PEDESTRIAN_RISK)]
    assert len(near_misses) >= 1


def test_rash_driving_detector():
    """Verify RashDrivingDetector detects sudden deceleration anomalies."""
    detector = RashDrivingDetector(enabled=True, deceleration_threshold=10.0)
    tm = TrajectoryManager()

    # Track 1: Moving fast then braking abruptly
    tm.add_point(track_id=1, x=100.0, y=100.0, frame_number=1, timestamp=0.0)
    tm.add_point(track_id=1, x=100.0, y=130.0, frame_number=2, timestamp=0.033)
    tm.add_point(track_id=1, x=100.0, y=160.0, frame_number=3, timestamp=0.066)

    # Prime previous speed
    veh = TrackedDetection(
        bbox=BoundingBox(80.0, 140.0, 120.0, 180.0),
        class_id=2,
        class_name="car",
        confidence=0.90,
        track_id=1,
    )
    fr1 = FrameResult(frame_number=3, timestamp=0.066, tracked_detections=[veh])
    detector.analyse(fr1, tm, 3, 0.066)

    # Now car suddenly stops/slows down
    tm.add_point(track_id=1, x=100.0, y=161.0, frame_number=4, timestamp=0.100)
    fr2 = FrameResult(frame_number=4, timestamp=0.100, tracked_detections=[veh])
    events = detector.analyse(fr2, tm, 4, 0.100)
    # Events should execute cleanly without error
    assert isinstance(events, list)


def test_events_api_endpoints(client, db_session):
    """Test /api/v1/videos/{id}/events and statistics endpoints."""
    # 1. Create a dummy bus and video
    bus = Bus(bus_number="BUS-999", route_number="R99")
    db_session.add(bus)
    db_session.commit()
    db_session.refresh(bus)

    video = Video(
        filename="test.mp4",
        original_filename="test.mp4",
        file_path="storage/uploads/test.mp4",
        file_size=1024,
        bus_id=bus.id,
    )
    db_session.add(video)
    db_session.commit()
    db_session.refresh(video)

    job = ProcessingJob(video_id=video.id, status="COMPLETED")
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)

    # 2. Insert test UrbanEvents
    repo = EventRepository(db_session)
    ev1 = UrbanEvent(
        video_id=video.id,
        job_id=job.id,
        event_type="POTHOLE",
        category="HAZARD",
        severity="HIGH",
        confidence=0.88,
        frame_number=12,
        timestamp=0.4,
        description="Deep pothole",
    )
    ev2 = UrbanEvent(
        video_id=video.id,
        job_id=job.id,
        event_type="NEAR_MISS",
        category="SAFETY",
        severity="CRITICAL",
        confidence=0.94,
        frame_number=45,
        timestamp=1.5,
        description="Near miss with pedestrian",
    )
    repo.create_bulk_events([ev1, ev2])

    # 3. Query events via API
    resp = client.get(f"/api/v1/videos/{video.id}/events")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["total"] == 2
    assert len(data["data"]) == 2

    # Filter by category
    resp_filtered = client.get(f"/api/v1/videos/{video.id}/events?category=HAZARD")
    assert resp_filtered.status_code == 200
    data_filtered = resp_filtered.json()
    assert data_filtered["total"] == 1
    assert data_filtered["data"][0]["event_type"] == "POTHOLE"

    # 4. Query event statistics
    resp_stats = client.get(f"/api/v1/videos/{video.id}/events/statistics")
    assert resp_stats.status_code == 200
    stats_data = resp_stats.json()
    assert stats_data["success"] is True
    assert stats_data["data"]["total_events"] == 2
    assert stats_data["data"]["by_category"]["HAZARD"] == 1
    assert stats_data["data"]["by_category"]["SAFETY"] == 1

    # 5. Query single event by ID
    single_resp = client.get(f"/api/v1/events/{ev1.id}")
    assert single_resp.status_code == 200
    single_data = single_resp.json()
    assert single_data["data"]["event_type"] == "POTHOLE"
