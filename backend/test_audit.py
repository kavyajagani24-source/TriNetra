"""
Audit and diagnostic script for all AI modules and integrations in TriNetra.
"""
import sys
from pathlib import Path

def test_imports():
    print("=" * 60)
    print("TRINETRA AI DIAGNOSTIC AUDIT")
    print("=" * 60)

    # 1. Safety AI (Module 3)
    print("\n--- 1. Safety AI (Module 3) ---")
    try:
        from app.ai.integrations.safety_module3.runner import SafetyModule3Runner
        runner = SafetyModule3Runner()
        runner._init()
        print("SafetyModule3Runner import & _init: SUCCESS")
        from app.core.config import get_settings
        settings = get_settings()
        print("Module 3 model path:", settings.module3_model_path_obj, "exists:", settings.module3_model_path_obj.exists())
    except Exception as e:
        print("Safety AI import failed:", e)

    # 2. Road Hazard Detector (backend app/ai/hazards)
    print("\n--- 2. Road Hazard Detector (app.ai.hazards) ---")
    try:
        from app.ai.hazards.road_hazard_detector import RoadHazardDetector
        rh = RoadHazardDetector(enabled=True)
        print("RoadHazardDetector instantiated. _rdd.available:", rh._rdd.available if rh._rdd else False)
    except Exception as e:
        print("RoadHazardDetector failed:", e)

    # 3. Sixth Sense Road Damage Detector
    print("\n--- 3. Sixth Sense Road Damage Detector ---")
    try:
        from sixth_sense.perception.road_damage_detector import RoadDamageDetector
        print("RoadDamageDetector import: SUCCESS")
    except Exception as e:
        print("Sixth Sense RoadDamageDetector import failed:", e)

    # 4. Sixth Sense Vehicle Detector & Traffic Intelligence
    print("\n--- 4. Sixth Sense Vehicle Detector & Traffic ---")
    try:
        from sixth_sense.perception.vehicle_detector import VehicleDetector
        from sixth_sense.tracking.urban_tracker import UrbianTracker
        from sixth_sense.traffic.intelligence import build_traffic_windows, build_traffic_patterns
        print("Sixth Sense Traffic modules import: SUCCESS")
    except Exception as e:
        print("Sixth Sense Traffic modules failed:", e)

    # 5. Core FrameProcessor components
    print("\n--- 5. Core FrameProcessor components ---")
    try:
        from app.ai.detector.yolo_detector import YOLODetector
        from app.ai.tracker.byte_tracker import ByteTrackerWrapper
        from app.ai.tracker.trajectory_manager import TrajectoryManager
        from app.ai.analytics.vehicle_counter import VehicleCounter
        from app.ai.analytics.traffic_density import TrafficDensityAnalyzer
        from app.ai.analytics.congestion_detector import CongestionDetector
        from app.ai.infrastructure.infrastructure_analyser import InfrastructureAnalyser
        from app.ai.behavior.rash_driving_detector import RashDrivingDetector
        from app.ai.safety.pedestrian_risk_analyser import PedestrianRiskAnalyser
        print("YOLODetector, ByteTracker, TrajectoryManager, VehicleCounter, TrafficDensity, Congestion, Infrastructure, RashDriving, PedestrianRisk: ALL IMPORTED SUCCESSFULLY")
    except Exception as e:
        print("Core components failed:", e)

    # 6. Sixth Sense Client & Adapters
    print("\n--- 6. Sixth Sense Client & Adapters ---")
    try:
        from app.ai.integrations.sixth_sense.road_adapter import RoadAdapter
        from app.ai.integrations.sixth_sense.traffic_adapter import TrafficAdapter
        from app.ai.integrations.sixth_sense.client import SixthSenseClient
        print("SixthSense Client & Adapters imported successfully")
    except Exception as e:
        print("Sixth Sense Client & Adapters failed:", e)

    # 7. Pipeline Orchestrator
    print("\n--- 7. UrbanAIPipeline ---")
    try:
        from app.ai.processors.pipeline import UrbanAIPipeline
        pipeline = UrbanAIPipeline()
        print("UrbanAIPipeline instantiated successfully")
    except Exception as e:
        print("UrbanAIPipeline failed:", e)

    # 8. Database Tables & Row Counts
    print("\n--- 8. Database Tables & Row Counts ---")
    try:
        import sqlite3
        conn = sqlite3.connect("urbaneye.db")
        tables = [t[0] for t in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        print("Database tables:", tables)
        for t in tables:
            cnt = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
            print(f"  - {t}: {cnt} rows")
        vids = conn.execute("SELECT id, original_filename, status, file_path FROM videos").fetchall()
        print("\nVideos in DB:")
        for v in vids:
            print("  Video:", v)
        jobs = conn.execute("SELECT id, video_id, status, progress_percentage, events_detected, annotated_road_path, annotated_safety_path FROM processing_jobs").fetchall()
        print("\nJobs in DB:")
        for j in jobs:
            print("  Job:", j)
        srun_cols = [c[1] for c in conn.execute("PRAGMA table_info(safety_runs)").fetchall()]
        print("\nSafety Runs columns:", srun_cols)
        sruns = conn.execute("SELECT * FROM safety_runs").fetchall()
        print("Safety Runs in DB:")
        for sr in sruns:
            print("  SafetyRun:", sr)
        sev_cols = [c[1] for c in conn.execute("PRAGMA table_info(safety_events)").fetchall()]
        print("\nSafety Events columns:", sev_cols)
        sev_sample = conn.execute("SELECT id, run_id, event_type, risk_level, risk_score, timestamp, evidence_image_path FROM safety_events LIMIT 5").fetchall()
        print("Safety Events sample:")
        for se in sev_sample:
            print("  Event:", se)
    except Exception as e:
        print("Database inspection failed:", e)

if __name__ == "__main__":
    test_imports()
