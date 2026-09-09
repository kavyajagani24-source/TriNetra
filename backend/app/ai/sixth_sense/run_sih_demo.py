"""
SIH 2026 — Complete Demonstration Pipeline
The Sixth Sense: one command, full City Memory → Action → Accountability story.

Usage:
    python run_sih_demo.py                  # fast mode (cached real Phase B outputs)
    python run_sih_demo.py --video VIDEO.mp4 --gps data/demo_gps.csv  # live GPU run

Output:
    outputs/sih_demo/
      01_detections/
      02_observations/
      03_persistent_issues/
      04_corroboration/
      05_work_items/
      06_verification/
      07_metrics/
      08_demo_summary/
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import datetime
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

PROJECT_ROOT = Path(__file__).parent.resolve()
sys.path.insert(0, str(PROJECT_ROOT))

from generate_actionable import (
    load_observation_index,
    issue_from_dict,
    observation_from_dict,
    clone_as_follow_up_observation,
    process_issues,
    ROUTING_RULES_PATH,
    _utc_now_iso,
)
from sixth_sense.schemas.urban_event import GPSPoint, GPSStatus
from sixth_sense.actionable.priority_engine import PriorityEngine
from sixth_sense.actionable.department_router import DepartmentRouter
from sixth_sense.actionable.work_item import WorkItemBuilder
from sixth_sense.closure.repair_claim import RepairClaimBuilder, RepairClaimStatus
from sixth_sense.closure.verification_engine import (
    VerificationEngine, FollowUpPass, VerificationOutcome,
)
from sixth_sense.closure.lifecycle_evidence import LifecycleEvidenceBuilder


STAGE_DIRS = [
    "01_detections",
    "02_observations",
    "03_persistent_issues",
    "04_corroboration",
    "05_work_items",
    "06_verification",
    "07_metrics",
    "08_demo_summary",
]

FAST_ISSUES = PROJECT_ROOT / "outputs" / "multipass2" / "multipass_6f838080_issues.json"
FAST_OBS = PROJECT_ROOT / "outputs" / "multipass2" / "multipass_6f838080_observations.json"
FAST_DETECTION_REPORT = PROJECT_ROOT / "outputs" / "road_damage_validation" / "metrics" / "run_a31b85e9_report.json"


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def _copy_json(src: Path, dst: Path, label: str) -> None:
    if src.exists():
        shutil.copy2(src, dst)
    else:
        _write_json(dst, {"note": f"Source not found: {label}", "path": str(src)})


def setup_output_dirs(base: Path) -> Dict[str, Path]:
    dirs = {}
    for name in STAGE_DIRS:
        d = base / name
        d.mkdir(parents=True, exist_ok=True)
        dirs[name] = d
    return dirs


def run_perception_live(video: str, gps: str, staging: Path) -> Tuple[Path, Path]:
    """Run real GPU multipass perception; return issues + observations paths."""
    staging.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable,
        str(PROJECT_ROOT / "simulate_multipass.py"),
        "--video", video,
        "--gps", gps,
        "--output", str(staging),
        "--profile", "road_damage_sensitive",
    ]
    print(f"  Running live perception: {' '.join(cmd)}")
    subprocess.run(cmd, check=True, cwd=str(PROJECT_ROOT))

    issues_files = sorted(staging.glob("*_issues.json"), key=os.path.getmtime)
    obs_files = sorted(staging.glob("*_observations.json"), key=os.path.getmtime)
    if not issues_files or not obs_files:
        raise RuntimeError("Multipass run did not produce expected JSON outputs")
    return issues_files[-1], obs_files[-1]


def resolve_inputs(args: argparse.Namespace) -> Tuple[Path, Path, str]:
    if args.fast or not args.video:
        if not FAST_ISSUES.exists() or not FAST_OBS.exists():
            raise SystemExit(
                "Fast mode requires cached outputs at outputs/multipass2/. "
                "Run simulate_multipass.py first or provide --video for live mode."
            )
        return FAST_ISSUES, FAST_OBS, "FAST_CACHED_REAL_PHASE_B"

    if not os.path.exists(args.video):
        raise SystemExit(f"Video not found: {args.video}")
    staging = PROJECT_ROOT / "outputs" / "sih_demo" / "_staging"
    return (*run_perception_live(args.video, args.gps, staging), "LIVE_GPU_INFERENCE")


def build_detection_summary(issues_path: Path, mode: str) -> Dict:
    with open(issues_path, encoding="utf-8") as f:
        issues_data = json.load(f)

    road = [
        i for i in issues_data.get("issues", [])
        if i.get("event_type") in ("ROAD_CRACK", "ROAD_DAMAGE", "POTHOLE")
    ]
    summary = {
        "pipeline_stage": "AI PERCEPTION",
        "models": {
            "general": "YOLO11x (yolo11x.pt)",
            "road_damage": "YOLO12s RDD2022 (yolo12s_RDD2022_best.pt)",
            "classes": ["D00", "D10", "D20", "D40", "Repair"],
        },
        "execution_mode": mode,
        "total_issues": issues_data.get("total_issues", 0),
        "road_damage_issues": len(road),
        "corroborated_road_issues": sum(1 for i in road if i.get("bus_count", 0) >= 2),
        "note": "D00 = longitudinal crack (not automatically a pothole)",
    }
    if FAST_DETECTION_REPORT.exists() and mode.startswith("FAST"):
        with open(FAST_DETECTION_REPORT, encoding="utf-8") as f:
            summary["reference_validation_report"] = json.load(f)
    return summary


def run_verification_showcase(
    issues_list: List[Dict],
    obs_index: Dict[str, Dict],
    work_items_map: Dict[str, Dict],
) -> Dict[str, Any]:
    """Run CASE A (verified repaired) and CASE B (reopened) on real road-crack issues."""
    engine = PriorityEngine()
    router = DepartmentRouter(rules_path=ROUTING_RULES_PATH)
    verifier = VerificationEngine()

    road_issues = [d for d in issues_list if d["event_type"] == "ROAD_CRACK"]
    p001 = next(d for d in road_issues if d["issue_id"] == "issue_5737cc9173")
    p002 = next(d for d in road_issues if d["issue_id"] != p001["issue_id"])

    repair_claims = []
    verification_events = []
    reopened_issues = []
    lifecycle_chains = []
    updated_issues: Dict[str, Dict] = {}

    scenarios = [
        ("CASE_A_VERIFIED_REPAIRED", p001, False),
        ("CASE_B_REOPENED_DISCREPANCY", p002, True),
    ]

    for label, issue_dict, still_present in scenarios:
        issue = issue_from_dict(issue_dict, obs_index)
        priority = engine.score(issue)
        routing = router.route(issue)
        wi = WorkItemBuilder.build(issue, priority, routing)
        if issue.issue_id in work_items_map:
            wi.work_item_id = work_items_map[issue.issue_id]["work_item_id"]

        claim = RepairClaimBuilder.build(
            issue_id=issue.issue_id,
            work_item_id=wi.work_item_id,
            claimed_by="PWD_FIELD_CREW_SIMULATED",
            repair_reference=f"WO-{issue.issue_id[-6:].upper()}",
            claimed_at="2026-09-10T08:00:00Z",
            notes="SIMULATED repair claim for SIH demo — not a real municipal record.",
        )
        claim.claimed_status = RepairClaimStatus.VERIFICATION_PENDING

        center = issue.center_gps
        pass_gps = GPSPoint(
            lat=center.lat, lon=center.lon,
            timestamp=center.timestamp + 86400.0,
            uncertainty_m=center.uncertainty_m,
            heading=center.heading,
            status=center.status,
        ) if center else None

        follow_obs = []
        ver_obs = None
        provenance = "SIMULATED_CLEAR_PASS_NO_DEFECT"
        if still_present:
            obs_id = issue_dict["observation_ids"][0]
            real_obs = clone_as_follow_up_observation(
                obs_index[obs_id],
                new_obs_id=f"obs_followup_{issue.issue_id[-8:]}",
                bus_id="BUS_003",
                run_id="sih_demo_follow_up",
            )
            follow_obs = [real_obs]
            ver_obs = real_obs
            provenance = "REAL_OBSERVATION_CLONED_AS_POST_REPAIR_PASS"

        follow_up = FollowUpPass(
            bus_id="BUS_003",
            pass_timestamp=issue.last_seen_ts + 86400.0,
            pass_gps=pass_gps,
            observations=follow_obs,
            run_id="sih_demo_follow_up",
            data_provenance=provenance,
        )

        result = verifier.verify(issue, claim, follow_up)
        verifier.apply_result(issue, claim, result, follow_up)

        repair_claims.append({**claim.to_dict(), "scenario": label})
        verification_events.append({**result.to_dict(), "scenario": label})
        updated_issues[issue.issue_id] = issue.to_dict()

        if result.verification_result == VerificationOutcome.REOPENED:
            reopened_issues.append({
                "issue_id": issue.issue_id,
                "observation_count_after": issue.observation_count,
                "observation_ids": [o.obs_id for o in issue.observations],
                "closure_history": issue.closure_history,
                "verification_id": result.verification_id,
            })

        chain = LifecycleEvidenceBuilder.build(
            issue, wi, priority, routing, claim, follow_up, result, ver_obs,
            scenario_label=label,
            data_provenance_note=(
                "REAL Phase B detections; SIMULATED repair claim and follow-up pass timing."
            ),
        )
        lifecycle_chains.append(chain.to_dict())

    return {
        "repair_claims": repair_claims,
        "verification_events": verification_events,
        "reopened_issues": reopened_issues,
        "lifecycle_chains": lifecycle_chains,
        "updated_issues": updated_issues,
    }


def build_issue_map_geojson(
    issues_list: List[Dict],
    work_items: List[Dict],
    verification_by_issue: Dict[str, str],
) -> Dict:
    wi_by_issue = {w["issue_id"]: w for w in work_items}
    features = []
    for issue in issues_list:
        gps = issue.get("center_gps")
        if not gps or gps.get("lat") is None:
            continue
        wi = wi_by_issue.get(issue["issue_id"], {})
        closure = verification_by_issue.get(issue["issue_id"], issue.get("status", "OPEN"))
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [gps["lon"], gps["lat"]],
            },
            "properties": {
                "issue_id": issue["issue_id"],
                "event_type": issue["event_type"],
                "class_name": issue.get("class_name"),
                "severity": issue.get("severity"),
                "confidence": issue.get("confidence"),
                "bus_count": issue.get("bus_count"),
                "observation_count": issue.get("observation_count"),
                "gps_status": gps.get("status"),
                "uncertainty_m": gps.get("uncertainty_m"),
                "work_item_id": wi.get("work_item_id"),
                "priority_band": wi.get("priority_band"),
                "priority_score": wi.get("priority_score"),
                "department": wi.get("department_display"),
                "closure_status": closure,
                "marker_color": _marker_color(issue, closure),
            },
        })
    return {"type": "FeatureCollection", "features": features}


def _marker_color(issue: Dict, closure: str) -> str:
    if closure == "REOPENED":
        return "#E53935"
    if closure == "RESOLVED":
        return "#43A047"
    if issue.get("event_type") == "ROAD_CRACK":
        return "#FB8C00"
    return "#1E88E5"


def build_action_queue(work_items: List[Dict]) -> Dict:
    road_items = [
        w for w in work_items
        if w.get("event_type") in ("ROAD_CRACK", "ROAD_DAMAGE", "POTHOLE")
    ]
    queue = sorted(road_items, key=lambda w: -w.get("priority_score", 0))
    return {
        "generated_at": _utc_now_iso(),
        "count": len(queue),
        "queue": [
            {
                "rank": i + 1,
                "work_item_id": w["work_item_id"],
                "issue_id": w["issue_id"],
                "event_type": w["event_type"],
                "class_name": w.get("class_name"),
                "priority_band": w["priority_band"],
                "priority_score": w["priority_score"],
                "department": w["department_display"],
                "status": w["status"],
                "location": w.get("location"),
            }
            for i, w in enumerate(queue)
        ],
    }


def build_demo_summary(
    mode: str,
    issues_data: Dict,
    work_items: List[Dict],
    verification: Dict,
    dirs: Dict[str, Path],
) -> Dict:
    road_cracks = [
        i for i in issues_data.get("issues", [])
        if i.get("event_type") == "ROAD_CRACK"
    ]
    return {
        "title": "THE SIXTH SENSE — SIH 2026 Urban Intelligence Demo",
        "generated_at": _utc_now_iso(),
        "execution_mode": mode,
        "pipeline": [
            "INPUT: Indian bus journey video + GPS",
            "AI PERCEPTION: YOLO11x + RDD2022 road damage",
            "CITY MEMORY: Observation → Persistent Issue → Multi-bus corroboration",
            "ACTION: Priority → Department → Work Item",
            "ACCOUNTABILITY: Repair Claim → Next Bus → Verification",
            "OUTPUT: GIS issue map + Evidence + Action queue + Closure status",
        ],
        "story": {
            "step_1": "BUS A detects D00 longitudinal crack → Persistent Issue P001",
            "step_2": "BUS B corroborates P001 → WorkItem routed to PWD",
            "step_3": "Repair claimed on P001 (simulated workflow)",
            "step_4a": "CASE A: Next bus — no defect → VERIFIED_REPAIRED (qualified)",
            "step_4b": "CASE B: Next bus — D00 still detected → REOPENED (issue ID preserved)",
        },
        "counts": {
            "total_issues": issues_data.get("total_issues", 0),
            "road_crack_issues": len(road_cracks),
            "corroborated_road_cracks": sum(1 for i in road_cracks if i.get("bus_count", 0) >= 2),
            "work_items": len(work_items),
            "repair_claims_demo": len(verification["repair_claims"]),
            "issues_reopened": len(verification["reopened_issues"]),
        },
        "output_directories": {k: str(v.relative_to(dirs["01_detections"].parent)) for k, v in dirs.items()},
        "data_provenance": {
            "detections_and_observations": "REAL Phase B GPU inference (Indian road footage)",
            "repair_claims_and_follow_up_timing": "SIMULATED post-repair workflow for demo",
            "verification_case_b_observation": "REAL D00 re-detection reused as follow-up evidence",
        },
        "commands": {
            "full_demo": "python run_sih_demo.py",
            "live_gpu": "python run_sih_demo.py --video <path> --gps data/demo_gps.csv --no-fast",
        },
    }


def run(args: argparse.Namespace) -> None:
    base = Path(args.output)
    if base.exists() and args.clean:
        shutil.rmtree(base)
    dirs = setup_output_dirs(base)

    print("\n" + "=" * 62)
    print("  THE SIXTH SENSE — SIH 2026 COMPLETE DEMO PIPELINE")
    print("=" * 62)

    issues_path, obs_path, mode = resolve_inputs(args)
    print(f"  Mode    : {mode}")
    print(f"  Issues  : {issues_path}")
    print(f"  Obs     : {obs_path}")

    with open(issues_path, encoding="utf-8") as f:
        issues_data = json.load(f)
    issues_list = issues_data.get("issues", issues_data)

    obs_index = load_observation_index(str(obs_path))

    # ── Stage 01: Detections ──────────────────────────────────────────
    detection_summary = build_detection_summary(issues_path, mode)
    _write_json(dirs["01_detections"] / "detection_summary.json", detection_summary)
    if FAST_DETECTION_REPORT.exists():
        _copy_json(FAST_DETECTION_REPORT, dirs["01_detections"] / "validation_report.json", "validation")

    # ── Stage 02: Observations ────────────────────────────────────────
    _copy_json(Path(obs_path), dirs["02_observations"] / "observations.json", "observations")

    # ── Stage 03: Persistent Issues ───────────────────────────────────
    _copy_json(Path(issues_path), dirs["03_persistent_issues"] / "issues.json", "issues")

    # ── Stage 04: Corroboration ───────────────────────────────────────
    road = [i for i in issues_list if i.get("event_type") == "ROAD_CRACK"]
    corroborated = [i for i in road if i.get("bus_count", 0) >= 2]
    _write_json(dirs["04_corroboration"] / "corroboration_summary.json", {
        "run_id": issues_data.get("run_id"),
        "total_observations": obs_index and len(obs_index),
        "road_crack_issues": len(road),
        "corroborated_issues": len(corroborated),
        "corroborated_issue_ids": [i["issue_id"] for i in corroborated],
        "example_corroborated": corroborated[0] if corroborated else None,
    })

    # ── Stage 05: Work Items ──────────────────────────────────────────
    work_items, evidence_chains, priority_rows, bands, depts, types = process_issues(
        issues_list, obs_index, ROUTING_RULES_PATH,
    )
    wi_dicts = [w.to_dict() for w in work_items]
    wi_map = {w["issue_id"]: w for w in wi_dicts}

    _write_json(dirs["05_work_items"] / "work_items.json", {
        "generated_at": _utc_now_iso(), "count": len(wi_dicts), "work_items": wi_dicts,
    })
    _write_json(dirs["05_work_items"] / "priority_report.json", {
        "band_distribution": bands, "type_distribution": types, "rows": priority_rows,
    })
    _write_json(dirs["05_work_items"] / "evidence_chain.json", {
        "count": len(evidence_chains),
        "chains": [c.to_dict() for c in evidence_chains],
    })

    # ── Stage 06: Verification ────────────────────────────────────────
    verification = run_verification_showcase(issues_list, obs_index, wi_map)
    _write_json(dirs["06_verification"] / "repair_claims.json", {
        "count": len(verification["repair_claims"]),
        "repair_claims": verification["repair_claims"],
    })
    _write_json(dirs["06_verification"] / "verification_events.json", {
        "count": len(verification["verification_events"]),
        "events": verification["verification_events"],
    })
    _write_json(dirs["06_verification"] / "reopened_issues.json", {
        "count": len(verification["reopened_issues"]),
        "reopened_issues": verification["reopened_issues"],
    })
    _write_json(dirs["06_verification"] / "lifecycle_evidence.json", {
        "count": len(verification["lifecycle_chains"]),
        "chains": verification["lifecycle_chains"],
    })

    # Merge post-verification issue updates
    merged_issues = list(issues_list)
    for i, issue_dict in enumerate(merged_issues):
        if issue_dict["issue_id"] in verification["updated_issues"]:
            merged_issues[i] = verification["updated_issues"][issue_dict["issue_id"]]
    _write_json(dirs["03_persistent_issues"] / "issues_after_verification.json", {
        "issues": merged_issues,
    })

    verification_status = {}
    for ev in verification["verification_events"]:
        verification_status[ev["issue_id"]] = ev["issue_status_after"]

    # ── Stage 07: Metrics ─────────────────────────────────────────────
    outcomes = defaultdict(int)
    for e in verification["verification_events"]:
        outcomes[e["verification_result"]] += 1

    _write_json(dirs["07_metrics"] / "pipeline_metrics.json", {
        "generated_at": _utc_now_iso(),
        "execution_mode": mode,
        "perception": detection_summary,
        "action": {
            "work_items": len(wi_dicts),
            "priority_distribution": bands,
            "department_distribution": depts,
        },
        "verification_outcomes": dict(outcomes),
    })

    # ── Stage 08: Demo Summary ────────────────────────────────────────
    geojson = build_issue_map_geojson(merged_issues, wi_dicts, verification_status)
    action_queue = build_action_queue(wi_dicts)
    summary = build_demo_summary(mode, issues_data, wi_dicts, verification, dirs)

    _write_json(dirs["08_demo_summary"] / "issue_map.geojson", geojson)
    _write_json(dirs["08_demo_summary"] / "action_queue.json", action_queue)
    _write_json(dirs["08_demo_summary"] / "demo_summary.json", summary)

    print()
    print("  PIPELINE COMPLETE")
    print(f"  Output root: {base}")
    for name in STAGE_DIRS:
        print(f"    {name}/")
    print()
    print("  KEY RESULTS:")
    print(f"    Road crack issues     : {len(road)}")
    print(f"    Corroborated          : {len(corroborated)}")
    print(f"    Work items            : {len(wi_dicts)}")
    print(f"    Verification outcomes : {dict(outcomes)}")
    print(f"    GIS features          : {len(geojson['features'])}")
    print()
    print("  COMMAND CENTER (Phase F):")
    print("    python serve_command_center.py")
    print("    → http://127.0.0.1:8765")
    print("=" * 62)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="SIH 2026 complete demonstration pipeline")
    p.add_argument("--output", default="outputs/sih_demo")
    p.add_argument("--video", default=None, help="Indian bus journey video (live GPU mode)")
    p.add_argument("--gps", default="data/demo_gps.csv")
    p.add_argument("--fast", action="store_true", default=False,
                   help="Use cached real Phase B outputs (default when no --video)")
    p.add_argument("--no-fast", action="store_true", help="Force live GPU run (requires --video)")
    p.add_argument("--clean", action="store_true", help="Remove existing output directory first")
    args = p.parse_args()
    if args.no_fast:
        args.fast = False
    elif not args.video:
        args.fast = True
    return args


if __name__ == "__main__":
    run(parse_args())
