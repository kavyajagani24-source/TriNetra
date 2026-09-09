"""
Simulate Multi-Bus Corroboration — The Sixth Sense
Phase B Deliverable 2: End-to-end simulation of two bus passes
observing the same physical defect, producing one corroborated issue.

This script is NOT a mock. It:
  - Runs real YOLO inference on the input video twice (as Bus A and Bus B)
  - Produces real Observations from each run
  - Feeds both Observation sets into a shared IssueManager
  - Outputs the corroborated PersistentIssue JSON

Simulation applies ONLY to: bus IDs, GPS offsets (Bus B shifted slightly),
and video timestamps (Bus B treated as a later pass).

Usage:
    python simulate_multipass.py \\
        --video "path/to/road_video.mp4" \\
        --output outputs/multipass \\
        --profile road_damage_sensitive
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
import uuid
from copy import deepcopy
from pathlib import Path
from typing import List

sys.path.insert(0, str(Path(__file__).parent))

from sixth_sense.core.gpu_context import verify_cuda
from sixth_sense.core.profile_loader import load_profile
from sixth_sense.core.model_registry import ModelRegistry
from sixth_sense.core.video_reader import VideoReader
from sixth_sense.core.quality_gate import QualityGate
from sixth_sense.perception.vehicle_detector import VehicleDetector
from sixth_sense.perception.road_damage_detector import RoadDamageDetector
from sixth_sense.tracking.urban_tracker import UrbianTracker
from sixth_sense.association.gps_associator import GPSAssociator
from sixth_sense.events.observation_builder import ObservationBuilder
from sixth_sense.events.severity_scorer import SeverityScorer
from sixth_sense.events.issue_manager import IssueManager
from sixth_sense.schemas.urban_event import Observation, PersistentIssue, GPSStatus

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stderr,
)
logger = logging.getLogger("sixth_sense.multipass")


def run_single_pass(
    video_path: str,
    profile_cfg: dict,
    device,
    registry: ModelRegistry,
    gps_source: str,
    gps_lat_offset: float,
    gps_lon_offset: float,
    gps_time_offset: float,
    ts_bias: float,            # Added to observation timestamps (simulates later pass)
    bus_id: str,
    camera_id: str,
    run_id: str,
) -> List[Observation]:
    """
    Execute one bus pass through the perception pipeline.
    Returns the list of confirmed Observations from this pass.

    gps_lat/lon_offset: Simulated GPS drift between bus passes (metres-equivalent).
    gps_time_offset: Unix timestamp offset to simulate a later bus pass.
    """
    reader = VideoReader(video_path)
    target_fps = int(profile_cfg.get("target_fps", 3))
    conf = profile_cfg.get("conf_thresholds", {})
    quality_cfg = profile_cfg.get("quality", {})
    sev_cfg = profile_cfg.get("severity", {})
    track_cfg = profile_cfg.get("tracking", {})

    quality_gate = QualityGate(
        min_blur_score=quality_cfg.get("min_blur_score", 60.0),
        min_brightness=quality_cfg.get("min_brightness", 20.0),
        max_brightness=quality_cfg.get("max_brightness", 235.0),
        max_glare_ratio=quality_cfg.get("max_glare_ratio", 0.20),
    )
    vehicle_det = VehicleDetector(
        model=registry.general,
        conf_thresholds=conf,
        imgsz=profile_cfg.get("general_detector_imgsz", 1280),
        device=str(device),
    )
    road_det = RoadDamageDetector(
        model=registry.road_damage,
        conf_threshold=conf.get("road_damage", 0.22),
        per_class_thresholds=conf,
        imgsz=profile_cfg.get("road_damage_imgsz", 640),
        device=str(device),
    )
    tracker = UrbianTracker(
        iou_threshold=track_cfg.get("iou_threshold", 0.30),
        confirm_frames=track_cfg.get("confirm_frames", 3),
        max_lost_frames=track_cfg.get("max_lost_frames", 10),
    )
    # GPS with per-bus offset (simulates different bus passing same spot)
    gps = GPSAssociator(
        gps_source=gps_source,
        video_start_unix=gps_time_offset,
        max_interpolation_gap_sec=profile_cfg.get("gps", {}).get("max_interpolation_gap_sec", 30.0),
        base_uncertainty_m=profile_cfg.get("gps", {}).get("base_uncertainty_m", 8.0),
    )
    # Patch GPS samples with per-bus spatial offset
    for s in gps._samples:
        s["lat"] += gps_lat_offset
        s["lon"] += gps_lon_offset

    severity_scorer = SeverityScorer(sev_cfg)
    obs_builder = ObservationBuilder(
        profile_cfg=profile_cfg,
        bus_id=bus_id,
        camera_id=camera_id,
        run_id=run_id,
        severity_scorer=severity_scorer,
    )

    logger.info("Bus pass '%s' starting: %s", bus_id, video_path)
    frame_count = 0
    for frame_data in reader.stream_frames(target_fps=target_fps):
        frame = frame_data["frame"]
        frame_idx = frame_data["index"]
        timestamp = frame_data["timestamp"]

        quality = quality_gate.assess(frame)
        if not quality.is_usable:
            continue

        gps_point = gps.get_location(timestamp)

        v_dets = vehicle_det.detect(frame, frame_idx, timestamp, quality, gps_point)
        rd_dets = road_det.detect(frame, frame_idx, timestamp, quality, gps_point)
        all_dets = v_dets + rd_dets

        tracker.update(v_dets, frame_idx)
        obs_builder.ingest(all_dets)
        frame_count += 1

    observations = obs_builder.finalise()
    # Shift timestamps to reflect when this bus actually passed (later pass simulation)
    if ts_bias != 0.0:
        for obs in observations:
            obs.first_seen_ts += ts_bias
            obs.last_seen_ts += ts_bias
            if obs.gps:
                obs.gps.timestamp += ts_bias
    reader.release()
    logger.info("Bus pass '%s' complete: %d frames -> %d observations",
                bus_id, frame_count, len(observations))
    return observations


def main(args: argparse.Namespace) -> None:
    run_id = f"multipass_{uuid.uuid4().hex[:8]}"
    os.makedirs(args.output, exist_ok=True)

    profile_cfg = load_profile(args.profile)
    device = verify_cuda(require_gpu=False)

    logger.info("Loading models once for both passes…")
    registry = ModelRegistry(profile_cfg, device)
    registry.load()

    print("\n" + "═" * 60)
    print("  THE SIXTH SENSE — MULTI-BUS CORROBORATION SIMULATION")
    print("═" * 60)
    print(f"  Run ID  : {run_id}")
    print(f"  Video   : {args.video}")
    print(f"  Profile : {args.profile}")
    print(f"  Device  : {device}")
    print("═" * 60)

    # ── BUS A: first pass, baseline GPS ─────────────────────────────── #
    t0 = time.perf_counter()
    obs_bus_a = run_single_pass(
        video_path=args.video,
        profile_cfg=profile_cfg,
        device=device,
        registry=registry,
        gps_source=args.gps,
        gps_lat_offset=0.0,
        gps_lon_offset=0.0,
        gps_time_offset=0.0,
        ts_bias=0.0,           # First pass — no timestamp shift
        bus_id="BUS_001",
        camera_id="CAM_FRONT",
        run_id=f"{run_id}_A",
    )

    # ── BUS B: second pass, ~5m GPS drift (realistic GPS uncertainty between buses) ── #
    # Note: gps_time_offset=0.0 — both buses share the same GPS time base (0→120s).
    # The lat/lon offset simulates real GPS measurement uncertainty across passes.
    # Temporal separation (BUS_002 passing 1hr later) is conceptual and recorded in
    # observation timestamps — GPS dedup is spatial only.
    obs_bus_b = run_single_pass(
        video_path=args.video,
        profile_cfg=profile_cfg,
        device=device,
        registry=registry,
        gps_source=args.gps,
        gps_lat_offset=0.000045,   # ~5m north (within 30m dedup radius)
        gps_lon_offset=0.000040,   # ~4m east
        gps_time_offset=0.0,       # Same GPS time base — avoids extrapolation error
        ts_bias=3600.0,            # Observation timestamps shifted +1hr (later pass)
        bus_id="BUS_002",
        camera_id="CAM_FRONT",
        run_id=f"{run_id}_B",
    )

    elapsed = time.perf_counter() - t0

    # ── Feed both passes into shared IssueManager ─────────────────────── #
    logger.info("Merging observations into shared issue store…")
    mgr = IssueManager(dedup_radius_m=30.0)

    all_observations = obs_bus_a + obs_bus_b
    for obs in all_observations:
        mgr.ingest(obs)

    issues = mgr.get_all_issues()

    # ── Separate issues by type for reporting ─────────────────────────── #
    from sixth_sense.schemas.urban_event import EventType
    road_damage_issues = [
        i for i in issues
        if i.event_type in (EventType.POTHOLE, EventType.ROAD_CRACK, EventType.ROAD_DAMAGE)
    ]
    corroborated = [i for i in road_damage_issues if i.bus_count >= 2]

    # ── Print summary ─────────────────────────────────────────────────── #
    print(f"\n  BUS_001 observations : {len(obs_bus_a)}")
    print(f"  BUS_002 observations : {len(obs_bus_b)}")
    print(f"  Total observations   : {len(all_observations)}")
    print(f"  Total issues created : {len(issues)}")
    print(f"  Road damage issues   : {len(road_damage_issues)}")
    print(f"  Corroborated (≥2 buses): {len(corroborated)}")
    print(f"  Total inference time : {elapsed:.1f}s")
    print("═" * 60)

    if corroborated:
        print("\n  ✅ CORROBORATION PROVEN:")
        for issue in corroborated:
            print(f"\n  Issue ID    : {issue.issue_id}")
            print(f"  Type        : {issue.event_type.value}")
            print(f"  Severity    : {issue.severity.value}")
            print(f"  Buses       : {issue.bus_ids}")
            print(f"  bus_count   : {issue.bus_count}")
            print(f"  obs_count   : {issue.observation_count}")
            print(f"  Confidence  : {issue.confidence:.3f}")
            if issue.center_gps:
                gps_status = issue.center_gps.status.value
                print(f"  GPS centroid: {issue.center_gps.lat:.5f}, {issue.center_gps.lon:.5f} [{gps_status}]")
                print(f"  Uncertainty : ±{issue.center_gps.uncertainty_m:.1f}m")
            print(f"  Trend       : {issue.trend.value}")
    else:
        if not road_damage_issues:
            print("\n  ⚠  No road damage observations in this video.")
            print("     This is expected if the video contains no visible road defects.")
            print("     Corroboration proof is validated by unit tests (test_multipass_corroboration.py).")
        else:
            print(f"\n  ⚠  {len(road_damage_issues)} road damage issue(s) found but none with bus_count ≥ 2.")
            print("     Spatial dedup radius may need adjustment, or GPS drift too large.")

    # ── Write JSON artifacts ────────────────────────────────────────────── #
    obs_out = {
        "run_id": run_id,
        "bus_a_observations": [o.to_dict() for o in obs_bus_a],
        "bus_b_observations": [o.to_dict() for o in obs_bus_b],
        "total_observations": len(all_observations),
    }
    obs_path = os.path.join(args.output, f"{run_id}_observations.json")
    with open(obs_path, "w") as f:
        json.dump(obs_out, f, indent=2)

    issues_out = {
        "run_id": run_id,
        "total_issues": len(issues),
        "road_damage_issues": len(road_damage_issues),
        "corroborated_issues": len(corroborated),
        "issues": [i.to_dict() for i in issues],
    }
    issues_path = os.path.join(args.output, f"{run_id}_issues.json")
    with open(issues_path, "w") as f:
        json.dump(issues_out, f, indent=2)

    print(f"\n  Observations → {obs_path}")
    print(f"  Issues       → {issues_path}\n")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Simulate two bus passes and prove corroboration"
    )
    p.add_argument("--video", required=True)
    p.add_argument("--gps", default="data/demo_gps.csv")
    p.add_argument("--output", default="outputs/multipass")
    p.add_argument("--profile", default="road_damage_sensitive")
    return p.parse_args()


if __name__ == "__main__":
    main(parse_args())
