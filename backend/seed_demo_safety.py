"""
TriNetra — Seed Demonstration Data for Module 3 Safety Intelligence
"""

import sys
import uuid
from datetime import datetime, timezone

from app.core.database import SessionLocal
from app.models.bus import Bus
from app.models.video import Video
from app.models.processing_job import ProcessingJob
from app.models.safety_run import SafetyRun, SafetyEvent

def seed():
    db = SessionLocal()
    try:
        # 1. Ensure a bus exists
        bus = db.query(Bus).first()
        if not bus:
            bus = Bus(
                id=uuid.uuid4(),
                bus_number="MH-01-CV-4022",
                registration_number="BEST-104",
                route_number="302-EXP",
                status="ACTIVE",
                latitude=19.0760,
                longitude=72.8777,
                speed=28.5,
                heading=145.0,
            )
            db.add(bus)
            db.flush()

        # 2. Ensure a video exists
        video = db.query(Video).first()
        if not video:
            video = Video(
                id=uuid.uuid4(),
                filename="route302_dadar_cst_cam1.mp4",
                original_filename="front_cam_route302.mp4",
                file_path="storage/uploads/front_cam_route302.mp4",
                file_size=48291040,
                format="mp4",
                fps=30.0,
                frame_count=1800,
                duration=60.0,
                width=1920,
                height=1080,
                status="COMPLETED",
                bus_id=bus.id,
                latitude=19.0178,
                longitude=72.8478,
            )
            db.add(video)
            db.flush()

        # 3. Create a completed ProcessingJob
        job = ProcessingJob(
            id=uuid.uuid4(),
            video_id=video.id,
            status="COMPLETED",
            progress_percentage=100.0,
            frames_processed=1800,
            total_frames=1800,
            events_detected=5,
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(job)
        db.flush()

        # 4. Create SafetyRun
        run = SafetyRun(
            id=uuid.uuid4(),
            job_id=job.id,
            video_id=video.id,
            source_video_path=video.file_path,
            total_frames=1800,
            processed_frames=1800,
            elapsed_seconds=42.5,
            processing_fps=42.3,
            total_events=5,
            events_by_type={
                "vulnerable_road_user_near_miss": 2,
                "school_zone_pedestrian": 1,
                "blind_spot_hazard": 1,
                "pedestrian_curb_monitoring": 1,
            },
            annotated_video_path="storage/processed/safety_annotated_route302.mp4",
            safety_output_dir="storage/processed/safety_run_demo",
            video_fps=30.0,
        )
        db.add(run)
        db.flush()

        # 5. Create rich SafetyEvents
        events_data = [
            {
                "source_event_id": "SAFE_0001_000145",
                "event_type": "vulnerable_road_user_near_miss",
                "event_timestamp": datetime.now(timezone.utc),
                "frame_index": 145,
                "start_frame": 130,
                "end_frame": 165,
                "duration_frames": 35,
                "bus_id": "BEST-104",
                "camera_id": "CAM-FRONT-01",
                "source_video_path": video.file_path,
                "latitude": 19.0182,
                "longitude": 72.8481,
                "gps_accuracy_m": 1.8,
                "track_id": 14,
                "object_type": "pedestrian",
                "track_first_frame": 110,
                "track_last_frame": 170,
                "track_age_frames": 60,
                "bbox_x1": 680.0,
                "bbox_y1": 420.0,
                "bbox_x2": 820.0,
                "bbox_y2": 780.0,
                "bbox_confidence": 0.94,
                "risk_level": "high",
                "risk_score": 0.88,
                "risk_confidence": 0.95,
                "risk_explanation": "Pedestrian crossed abruptly within 1.6m of bus trajectory near crossing",
                "risk_reasons": [
                    "Proximity threshold breached (< 2.0m)",
                    "Trajectory intersects primary bus heading",
                    "Deceleration spike detected (-3.2 m/s²)",
                ],
                "context": {
                    "in_school_zone": False,
                    "in_crossing_zone": True,
                    "road_entry": True,
                },
                "evidence_frames": ["evidence_000145.jpg"],
                "evidence_clip": "clip_000145.mp4",
                "trigger_frame_index": 145,
                "peak_frame_index": 150,
                "trajectory_snapshot": [
                    {"frame_index": 130, "x": 640.0, "y": 410.0},
                    {"frame_index": 145, "x": 680.0, "y": 420.0},
                    {"frame_index": 160, "x": 730.0, "y": 440.0},
                ],
                "in_school_zone": False,
                "in_crossing_zone": True,
                "road_entry": True,
            },
            {
                "source_event_id": "SAFE_0001_000320",
                "event_type": "school_zone_pedestrian",
                "event_timestamp": datetime.now(timezone.utc),
                "frame_index": 320,
                "start_frame": 300,
                "end_frame": 345,
                "duration_frames": 45,
                "bus_id": "BEST-104",
                "camera_id": "CAM-FRONT-01",
                "source_video_path": video.file_path,
                "latitude": 19.0195,
                "longitude": 72.8490,
                "gps_accuracy_m": 2.2,
                "track_id": 23,
                "object_type": "pedestrian",
                "track_first_frame": 280,
                "track_last_frame": 360,
                "track_age_frames": 80,
                "bbox_x1": 310.0,
                "bbox_y1": 460.0,
                "bbox_x2": 420.0,
                "bbox_y2": 720.0,
                "bbox_confidence": 0.89,
                "risk_level": "medium",
                "risk_score": 0.58,
                "risk_confidence": 0.91,
                "risk_explanation": "Students congregating near curb within active 25 km/h school safety zone",
                "risk_reasons": [
                    "Designated school safety perimeter active",
                    "Curb proximity alert",
                ],
                "context": {
                    "in_school_zone": True,
                    "in_crossing_zone": False,
                    "road_entry": False,
                },
                "evidence_frames": ["evidence_000320.jpg"],
                "evidence_clip": None,
                "trigger_frame_index": 320,
                "peak_frame_index": 325,
                "trajectory_snapshot": [],
                "in_school_zone": True,
                "in_crossing_zone": False,
                "road_entry": False,
            },
            {
                "source_event_id": "SAFE_0001_000680",
                "event_type": "blind_spot_hazard",
                "event_timestamp": datetime.now(timezone.utc),
                "frame_index": 680,
                "start_frame": 660,
                "end_frame": 710,
                "duration_frames": 50,
                "bus_id": "BEST-104",
                "camera_id": "CAM-FRONT-01",
                "source_video_path": video.file_path,
                "latitude": 19.0210,
                "longitude": 72.8505,
                "gps_accuracy_m": 2.5,
                "track_id": 31,
                "object_type": "cyclist",
                "track_first_frame": 640,
                "track_last_frame": 720,
                "track_age_frames": 80,
                "bbox_x1": 1340.0,
                "bbox_y1": 490.0,
                "bbox_x2": 1520.0,
                "bbox_y2": 820.0,
                "bbox_confidence": 0.91,
                "risk_level": "high",
                "risk_score": 0.84,
                "risk_confidence": 0.93,
                "risk_explanation": "Cyclist overtaking along bus left flank inside driver blind spot sector",
                "risk_reasons": [
                    "Flank blind spot zone occupied",
                    "Relative speed delta exceeds safe clearance",
                ],
                "context": {
                    "in_school_zone": False,
                    "in_crossing_zone": False,
                    "road_entry": True,
                },
                "evidence_frames": ["evidence_000680.jpg"],
                "evidence_clip": None,
                "trigger_frame_index": 680,
                "peak_frame_index": 685,
                "trajectory_snapshot": [],
                "in_school_zone": False,
                "in_crossing_zone": False,
                "road_entry": True,
            },
            {
                "source_event_id": "SAFE_0001_001050",
                "event_type": "vulnerable_road_user_near_miss",
                "event_timestamp": datetime.now(timezone.utc),
                "frame_index": 1050,
                "start_frame": 1030,
                "end_frame": 1075,
                "duration_frames": 45,
                "bus_id": "BEST-104",
                "camera_id": "CAM-FRONT-01",
                "source_video_path": video.file_path,
                "latitude": 19.0225,
                "longitude": 72.8520,
                "gps_accuracy_m": 2.0,
                "track_id": 48,
                "object_type": "pedestrian",
                "track_first_frame": 1010,
                "track_last_frame": 1090,
                "track_age_frames": 80,
                "bbox_x1": 890.0,
                "bbox_y1": 430.0,
                "bbox_x2": 1010.0,
                "bbox_y2": 760.0,
                "bbox_confidence": 0.92,
                "risk_level": "medium",
                "risk_score": 0.64,
                "risk_confidence": 0.89,
                "risk_explanation": "Pedestrian stepped into bus bay lane before bus came to full stop",
                "risk_reasons": [
                    "Bus bay lane incursion",
                    "Active bus docking trajectory",
                ],
                "context": {
                    "in_school_zone": False,
                    "in_crossing_zone": True,
                    "road_entry": True,
                },
                "evidence_frames": [],
                "evidence_clip": None,
                "trigger_frame_index": 1050,
                "peak_frame_index": 1055,
                "trajectory_snapshot": [],
                "in_school_zone": False,
                "in_crossing_zone": True,
                "road_entry": True,
            },
            {
                "source_event_id": "SAFE_0001_001420",
                "event_type": "pedestrian_curb_monitoring",
                "event_timestamp": datetime.now(timezone.utc),
                "frame_index": 1420,
                "start_frame": 1400,
                "end_frame": 1440,
                "duration_frames": 40,
                "bus_id": "BEST-104",
                "camera_id": "CAM-FRONT-01",
                "source_video_path": video.file_path,
                "latitude": 19.0240,
                "longitude": 72.8535,
                "gps_accuracy_m": 2.1,
                "track_id": 55,
                "object_type": "pedestrian",
                "track_first_frame": 1390,
                "track_last_frame": 1450,
                "track_age_frames": 60,
                "bbox_x1": 220.0,
                "bbox_y1": 510.0,
                "bbox_x2": 310.0,
                "bbox_y2": 730.0,
                "bbox_confidence": 0.87,
                "risk_level": "low",
                "risk_score": 0.24,
                "risk_confidence": 0.92,
                "risk_explanation": "Pedestrian walking on designated sidewalk separated by safety railing",
                "risk_reasons": ["Safe lateral clearance maintained (> 3.5m)"],
                "context": {
                    "in_school_zone": False,
                    "in_crossing_zone": False,
                    "road_entry": False,
                },
                "evidence_frames": [],
                "evidence_clip": None,
                "trigger_frame_index": 1420,
                "peak_frame_index": 1420,
                "trajectory_snapshot": [],
                "in_school_zone": False,
                "in_crossing_zone": False,
                "road_entry": False,
            },
        ]

        for ed in events_data:
            ev = SafetyEvent(
                id=uuid.uuid4(),
                run_id=run.id,
                job_id=job.id,
                video_id=video.id,
                **ed
            )
            db.add(ev)

        db.commit()
        print(f"SUCCESS: Seeded SafetyRun {run.id} with {len(events_data)} events!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding demo data: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
