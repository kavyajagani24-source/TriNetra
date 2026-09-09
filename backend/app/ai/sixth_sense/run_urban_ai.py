"""
The Sixth Sense — Urban AI Engine
SIH 2026 | PS 26124/26125

CLI entry point.  Wires together all Phase A components.

Usage:
    python run_urban_ai.py \\
        --video tests/demo_video.mp4 \\
        --gps data/demo_gps.csv \\
        --output outputs/demo \\
        --profile urban_mvp
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
import uuid
from pathlib import Path

# ── Ensure project is importable regardless of CWD ──────────────────────── #
_PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(_PROJECT_ROOT))

# ── Module imports ───────────────────────────────────────────────────────── #
from sixth_sense.core.gpu_context import verify_cuda, print_startup_banner, warmup_model
from sixth_sense.core.profile_loader import load_profile
from sixth_sense.core.model_registry import ModelRegistry
from sixth_sense.core.video_reader import VideoReader
from sixth_sense.core.frame_scheduler import FrameScheduler
from sixth_sense.core.quality_gate import QualityGate
from sixth_sense.perception.vehicle_detector import VehicleDetector
from sixth_sense.perception.road_damage_detector import RoadDamageDetector
from sixth_sense.tracking.urban_tracker import UrbianTracker
from sixth_sense.association.gps_associator import GPSAssociator
from sixth_sense.events.observation_builder import ObservationBuilder
from sixth_sense.events.severity_scorer import SeverityScorer
from sixth_sense.events.issue_manager import IssueManager
from sixth_sense.privacy.anonymiser import Anonymiser
from sixth_sense.output.annotated_writer import AnnotatedWriter
from sixth_sense.output.metrics_reporter import MetricsReporter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stderr,   # explicit stderr — normal for logging; not a crash
)
logger = logging.getLogger("sixth_sense.main")


def build_output_dirs(base: str) -> dict:
    dirs = {
        "annotated": os.path.join(base, "annotated"),
        "observations": os.path.join(base, "observations"),
        "issues": os.path.join(base, "issues"),
        "evidence": os.path.join(base, "evidence"),
        "metrics": os.path.join(base, "metrics"),
        "logs": os.path.join(base, "logs"),
    }
    for d in dirs.values():
        os.makedirs(d, exist_ok=True)
    return dirs


def make_evidence_saver(reader: VideoReader, evidence_dir: str, anonymiser: Anonymiser):
    """Returns a callable that saves a privacy-masked evidence frame and returns its path."""
    import cv2

    def saver(det) -> str:
        frame = reader.get_frame_at(det.frame_idx)
        if frame is None:
            return ""
        masked = anonymiser.anonymise(frame, [det])
        fname = f"ev_{det.det_id}_f{det.frame_idx}.jpg"
        fpath = os.path.join(evidence_dir, fname)
        cv2.imwrite(fpath, masked, [cv2.IMWRITE_JPEG_QUALITY, 90])
        return os.path.relpath(fpath)

    return saver


def run(args: argparse.Namespace) -> None:
    run_id = f"run_{uuid.uuid4().hex[:8]}"
    logger.info("Starting run %s", run_id)

    # ── Setup output dirs ────────────────────────────────────────────── #
    dirs = build_output_dirs(args.output)

    # ── Load profile ─────────────────────────────────────────────────── #
    config_path = Path(args.config) if args.config else None
    profile_cfg = load_profile(args.profile, *([config_path] if config_path else []))
    target_fps = "native" if args.process_all else int(profile_cfg.get("target_fps", 3))

    # 🔹 GPU / CUDA 🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹 #
    device = verify_cuda(require_gpu=False)

    # ── Load models (ONCE — never inside frame loop) ─────────────────── #
    registry = ModelRegistry(profile_cfg, device)
    t_load = time.perf_counter()
    registry.load()
    load_elapsed = time.perf_counter() - t_load

    # ── Video reader ─────────────────────────────────────────────────── #
    reader = VideoReader(args.video)

    # ── Startup banner ───────────────────────────────────────────────── #
    print_startup_banner(
        model_names=registry.model_names(),
        device=device,
        input_resolution=(reader.width, reader.height),
        target_fps=target_fps,
        profile=args.profile,
    )

    # ── Warm up models ───────────────────────────────────────────────── #
    logger.info("Warming up general detector …")
    warmup_model(registry.general, device, imgsz=profile_cfg.get("general_detector_imgsz", 1280))
    if registry.road_damage_available:
        logger.info("Warming up road damage detector …")
        warmup_model(registry.road_damage, device, imgsz=profile_cfg.get("road_damage_imgsz", 640))

    # ── Component instantiation ──────────────────────────────────────── #
    conf = profile_cfg.get("conf_thresholds", {})
    quality_cfg = profile_cfg.get("quality", {})
    sev_cfg = profile_cfg.get("severity", {})
    track_cfg = profile_cfg.get("tracking", {})
    priv_cfg = profile_cfg.get("privacy", {})
    ev_cfg = profile_cfg.get("evidence", {})

    scheduler = FrameScheduler(reader.fps, target_fps)
    quality_gate = QualityGate(
        min_blur_score=quality_cfg.get("min_blur_score", 80.0),
        min_brightness=quality_cfg.get("min_brightness", 30.0),
        max_brightness=quality_cfg.get("max_brightness", 230.0),
        max_glare_ratio=quality_cfg.get("max_glare_ratio", 0.15),
    )
    vehicle_det = VehicleDetector(
        model=registry.general,
        conf_thresholds=conf,
        imgsz=profile_cfg.get("general_detector_imgsz", 1280),
        device=str(device),
        enable_autorickshaw_heuristic=True,
    )
    road_det = RoadDamageDetector(
        model=registry.road_damage,   # may be None — handled gracefully
        conf_threshold=conf.get("road_damage", 0.35),
        per_class_thresholds=conf,    # passes D00/D10/D20/D40/Repair overrides from profile
        imgsz=profile_cfg.get("road_damage_imgsz", 640),
        device=str(device),
    )
    tracker = UrbianTracker(
        iou_threshold=track_cfg.get("iou_threshold", 0.30),
        confirm_frames=track_cfg.get("confirm_frames", 3),
        max_lost_frames=track_cfg.get("max_lost_frames", 10),
    )
    gps = GPSAssociator(
        gps_source=args.gps,
        video_start_unix=args.video_start_unix,
        max_interpolation_gap_sec=profile_cfg.get("gps", {}).get("max_interpolation_gap_sec", 10.0),
        base_uncertainty_m=profile_cfg.get("gps", {}).get("base_uncertainty_m", 8.0),
    )
    anonymiser = Anonymiser(
        blur_faces=priv_cfg.get("blur_faces", True),
        blur_plates=priv_cfg.get("blur_plates", True),
        face_region_top_fraction=priv_cfg.get("face_region_top_fraction", 0.45),
    )
    severity_scorer = SeverityScorer(sev_cfg)
    evidence_saver = (
        make_evidence_saver(reader, dirs["evidence"], anonymiser)
        if ev_cfg.get("save_evidence_frames", True)
        else None
    )
    obs_builder = ObservationBuilder(
        profile_cfg=profile_cfg,
        bus_id=args.bus_id,
        camera_id=args.camera_id,
        run_id=run_id,
        severity_scorer=severity_scorer,
        evidence_frame_saver=evidence_saver,
    )
    issue_mgr = IssueManager()
    metrics = MetricsReporter()
    metrics.total_frames_in_video = reader.total_frames
    for name, t in registry.load_times.items():
        metrics.record_model_load(name, t)

    # ── Annotated video writer ────────────────────────────────────────── #
    video_name = Path(args.video).stem
    annotated_path = os.path.join(dirs["annotated"], f"{video_name}_annotated.mp4")
    writer = AnnotatedWriter(annotated_path, reader.width, reader.height, fps=min(reader.fps, 30))

    # ── MAIN FRAME LOOP ──────────────────────────────────────────────── #
    logger.info("Processing video: %s", args.video)
    frame_count = 0
    t_loop_start = time.perf_counter()

    last_all_dets = []
    last_active_tracks = []
    last_gps_str = "UNAVAILABLE"

    for frame_data in reader.stream_frames(target_fps=None):
        frame = frame_data["frame"]
        frame_idx = frame_data["index"]
        timestamp = frame_data["timestamp"]

        # 🔹 Quality gate 🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹 #
        quality = quality_gate.assess(frame)
        if not quality.is_usable:
            metrics.frames_skipped_quality += 1
            # Still write the frame to video (with warning) but skip inference
            writer.write_frame(frame, [], [], frame_idx, timestamp, quality_ok=False)
            metrics.frames_processed += 1
            continue

        if scheduler.should_process(frame_idx):
            # 🔹 GPS for this timestamp 🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹 #
            gps_point = gps.get_location(timestamp)
            gps_str = (
                f"{gps_point.lat:.5f},{gps_point.lon:.5f} [{gps_point.status.value}]"
                if gps_point and gps_point.status.value != "UNAVAILABLE"
                else "UNAVAILABLE"
            )

            # 🔹 Vehicle detection 🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹 #
            t0 = time.perf_counter()
            v_dets = vehicle_det.detect(frame, frame_idx, timestamp, quality, gps_point)
            metrics.record_general_inference(time.perf_counter() - t0)
            metrics.add_vehicle_detections(len(v_dets))

            # 🔹 Road damage detection 🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹 #
            t0 = time.perf_counter()
            rd_dets = road_det.detect(frame, frame_idx, timestamp, quality, gps_point)
            if road_det.available:
                metrics.record_road_damage_inference(time.perf_counter() - t0)
            metrics.add_road_damage_detections(len(rd_dets))

            all_dets = v_dets + rd_dets

            # 🔹 Tracking (vehicles only) 🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹 #
            active_tracks = tracker.update(v_dets, frame_idx)

            # 🔹 Feed to observation builder 🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹 #
            obs_builder.ingest(all_dets)
            
            last_all_dets = all_dets
            last_active_tracks = active_tracks
            last_gps_str = gps_str
        else:
            all_dets = last_all_dets
            active_tracks = last_active_tracks
            gps_str = last_gps_str

        # 🔹 Annotate and write frame (privacy masked) 🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹 #
        masked_frame = anonymiser.anonymise(frame, all_dets)
        writer.write_frame(
            masked_frame, all_dets, active_tracks, frame_idx, timestamp, gps_str,
            quality_ok=quality.is_usable,
        )

        metrics.frames_processed += 1
        frame_count += 1

        # Sample GPU memory every 30 frames
        if frame_count % 30 == 0:
            metrics.sample_gpu_memory()

        if frame_count % 50 == 0:
            elapsed = time.perf_counter() - t_loop_start
            fps_so_far = frame_count / elapsed if elapsed > 0 else 0
            logger.info(
                "Progress: frame %d | %.1f proc-fps | det=%d track=%d",
                frame_idx, fps_so_far, len(all_dets), len(active_tracks),
            )

    # ── End of video ─────────────────────────────────────────────────── #
    writer.close()

    # Flush remaining tracks
    all_tracks = tracker.flush()
    metrics.total_tracks = len(all_tracks)

    # Finalise observations
    observations = obs_builder.finalise()
    metrics.total_observations = len(observations)

    # Build persistent issues
    for obs in observations:
        issue_mgr.ingest(obs)
    issues = issue_mgr.get_all_issues()
    metrics.total_issues = len(issues)

    # ── Write observations JSON ───────────────────────────────────────── #
    obs_path = os.path.join(dirs["observations"], f"{run_id}_observations.json")
    obs_payload = {
        "run_id": run_id,
        "bus_id": args.bus_id,
        "camera_id": args.camera_id,
        "video": args.video,
        "total_observations": len(observations),
        "observations": [o.to_dict() for o in observations],
    }
    with open(obs_path, "w") as f:
        json.dump(obs_payload, f, indent=2)
    logger.info("Observations written: %s (%d)", obs_path, len(observations))

    # ── Write issues JSON ─────────────────────────────────────────────── #
    issues_path = os.path.join(dirs["issues"], f"{run_id}_issues.json")
    issues_payload = {
        "run_id": run_id,
        "total_issues": len(issues),
        "issues": [i.to_dict() for i in issues],
    }
    with open(issues_path, "w") as f:
        json.dump(issues_payload, f, indent=2)
    logger.info("Issues written: %s (%d)", issues_path, len(issues))

    # ── Write run metadata ────────────────────────────────────────────── #
    meta = {
        "run_id": run_id,
        "profile": args.profile,
        "video": args.video,
        "gps_source": args.gps,
        "bus_id": args.bus_id,
        "camera_id": args.camera_id,
        "models": registry.model_names(),
        "device": str(device),
        "target_fps": target_fps,
    }
    meta_path = os.path.join(dirs["logs"], f"{run_id}_meta.json")
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    # ── Write metrics ─────────────────────────────────────────────────── #
    metrics_path = os.path.join(dirs["metrics"], f"{run_id}_report.json")
    metrics.finalize(
        output_path=metrics_path,
        video_path=args.video,
        profile=args.profile,
        run_id=run_id,
        model_names=registry.model_names(),
        device=str(device),
        target_fps=target_fps,
        video_fps=reader.fps,
        video_resolution=f"{reader.width}x{reader.height}",
    )

    reader.release()

    # ── Final summary ─────────────────────────────────────────────────── #
    print(f"\n✅ Run complete: {run_id}")
    print(f"   Annotated video : {annotated_path}")
    print(f"   Observations    : {obs_path}  ({len(observations)} obs)")
    print(f"   Issues          : {issues_path}  ({len(issues)} issues)")
    print(f"   Metrics         : {metrics_path}")

    if not observations:
        if not road_det.available:
            print("\n⚠  Road damage model was not loaded.")
            print("   Road-damage observations require the RDD2022 pretrained model.")
            print("   Set 'road_damage_local_weights' in profiles.yaml or ensure HuggingFace access.")
        else:
            print("\n⚠  No observations produced.")
            print("   If the test video contains no potholes/vehicles, this is expected.")
            print("   Use a video with relevant content to validate road-damage detection.")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="The Sixth Sense — Urban AI Engine (SIH 2026)"
    )
    p.add_argument("--video", required=True, help="Path to input video file")
    p.add_argument("--gps", default=None, help="Path to GPS CSV/JSON file")
    p.add_argument("--output", default="outputs/demo", help="Output directory")
    p.add_argument("--profile", default="urban_mvp", help="Profile name from profiles.yaml")
    p.add_argument("--config", default=None, help="Path to profiles.yaml (default: config/profiles.yaml)")
    p.add_argument("--bus-id", default="BUS_001", dest="bus_id", help="Bus identifier")
    p.add_argument("--camera-id", default="CAM_FRONT", dest="camera_id", help="Camera identifier")
    p.add_argument("--process-all", action="store_true", help="Process all frames (native FPS), disabling frame skipping")
    p.add_argument(
        "--video-start-unix", type=float, default=0.0, dest="video_start_unix",
        help="Unix timestamp of video frame 0 (for GPS alignment)"
    )
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run(args)
