"""
Generate Actionable Work Items — The Sixth Sense, Phase C
Reads Phase B PersistentIssue JSON, runs priority + routing,
produces a complete actionable output directory.

Usage:
    python generate_actionable.py \\
        --issues outputs/multipass2/multipass_6f838080_issues.json \\
        --observations outputs/multipass2/multipass_6f838080_observations.json \\
        --output outputs/actionable_demo

Outputs:
    issues.json          — input issues (copied for provenance)
    work_items.json      — one WorkItem per PersistentIssue
    priority_report.json — priority distribution + per-issue scores
    evidence_chain.json  — full audit trail per work item
    metrics.json         — summary statistics
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import datetime
from collections import defaultdict
from typing import List, Dict, Any, Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sixth_sense.schemas.urban_event import (
    PersistentIssue, EventType, SeverityTier, GPSStatus,
    GPSPoint, IssueTrend, Observation,
)
from sixth_sense.actionable.priority_engine import PriorityEngine
from sixth_sense.actionable.department_router import DepartmentRouter
from sixth_sense.actionable.work_item import WorkItemBuilder, WorkItem
from sixth_sense.actionable.evidence_chain import EvidenceChainBuilder, EvidenceChain

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
ROUTING_RULES_PATH = os.path.join(PROJECT_ROOT, "config", "routing_rules.yaml")


def _utc_now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


# ── Deserialise Phase B JSON ─────────────────────────────────────────── #

def _gps_from_dict(d: Optional[Dict]) -> Optional[GPSPoint]:
    if not d:
        return None
    return GPSPoint(
        lat=d["lat"],
        lon=d["lon"],
        timestamp=d.get("timestamp", 0.0),
        uncertainty_m=d.get("uncertainty_m", 8.0),
        heading=d.get("heading"),
        status=GPSStatus(d.get("status", "UNAVAILABLE")),
    )


def observation_from_dict(d: Dict) -> Observation:
    bbox = d.get("bbox", [0, 0, 0, 0])
    if isinstance(bbox, list):
        bbox = tuple(bbox)
    return Observation(
        obs_id=d["obs_id"],
        bus_id=d["bus_id"],
        camera_id=d.get("camera_id", "CAM_FRONT"),
        run_id=d.get("run_id", "unknown"),
        event_type=EventType(d["event_type"]),
        class_name=d.get("class_name", "UNKNOWN"),
        first_seen_frame=d.get("first_seen_frame", 0),
        last_seen_frame=d.get("last_seen_frame", 0),
        first_seen_ts=d.get("first_seen_ts", 0.0),
        last_seen_ts=d.get("last_seen_ts", 0.0),
        representative_frame=d.get("representative_frame", 0),
        confidence=d.get("confidence", 0.0),
        severity=SeverityTier(d.get("severity", "UNKNOWN")),
        bbox=bbox,
        bbox_area_px=d.get("bbox_area_px", 0),
        relative_area=d.get("relative_area", 0.0),
        gps=_gps_from_dict(d.get("gps")),
        evidence_ref=d.get("evidence_ref"),
        detection_count=d.get("detection_count", 1),
        model_name=d.get("model_name", "unknown"),
        privacy_status=d.get("privacy_status", "ANONYMIZED"),
    )


def clone_as_follow_up_observation(
    raw: Dict,
    new_obs_id: str,
    bus_id: str,
    run_id: str = "follow_up_pass",
) -> Observation:
    """Clone a real observation as a new follow-up pass record (new obs_id, new bus)."""
    from copy import deepcopy
    d = deepcopy(raw)
    d["obs_id"] = new_obs_id
    d["bus_id"] = bus_id
    d["run_id"] = run_id
    return observation_from_dict(d)
    """Locate the companion observations JSON for a Phase B issues file."""
    if explicit:
        return explicit if os.path.exists(explicit) else None

    candidates = []

    # Same directory: multipass_xxx_issues.json -> multipass_xxx_observations.json
    base, ext = os.path.splitext(issues_path)
    if base.endswith("_issues"):
        candidates.append(base.replace("_issues", "_observations") + ext)
    candidates.append(issues_path.replace("_issues.json", "_observations.json"))

    # run_urban_ai layout: .../issues/run_x_issues.json -> .../observations/run_x_observations.json
    if f"{os.sep}issues{os.sep}" in issues_path:
        candidates.append(
            issues_path.replace(f"{os.sep}issues{os.sep}", f"{os.sep}observations{os.sep}")
            .replace("_issues.json", "_observations.json")
        )

    for path in candidates:
        if os.path.exists(path):
            return path
    return None


def load_observation_index(path: str) -> Dict[str, Dict]:
    """Load observations JSON into an obs_id -> dict index."""
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)

    records: List[Dict] = []
    if isinstance(raw, list):
        records = raw
    elif isinstance(raw, dict):
        if "observations" in raw:
            records.extend(raw["observations"])
        if "bus_a_observations" in raw:
            records.extend(raw["bus_a_observations"])
        if "bus_b_observations" in raw:
            records.extend(raw["bus_b_observations"])

    return {r["obs_id"]: r for r in records}


def observations_for_issue(
    obs_ids: List[str],
    obs_index: Dict[str, Dict],
    issue_id: str,
) -> List[Observation]:
    """Resolve real Observation objects for an issue's observation_ids."""
    resolved: List[Observation] = []
    missing: List[str] = []
    for obs_id in obs_ids:
        raw = obs_index.get(obs_id)
        if raw is None:
            missing.append(obs_id)
            continue
        resolved.append(observation_from_dict(raw))

    if missing:
        raise ValueError(
            f"Issue {issue_id}: missing {len(missing)} observation(s) in observations file: "
            + ", ".join(missing[:5])
            + ("..." if len(missing) > 5 else "")
        )
    return resolved


def issue_from_dict(d: Dict, obs_index: Optional[Dict[str, Dict]] = None) -> PersistentIssue:
    gps = _gps_from_dict(d.get("center_gps"))
    obs_ids = d.get("observation_ids", [])
    bus_ids = d.get("bus_ids", [])

    if obs_index is not None and obs_ids:
        observations = observations_for_issue(obs_ids, obs_index, d["issue_id"])
    else:
        observations = []

    return PersistentIssue(
        issue_id=d["issue_id"],
        event_type=EventType(d["event_type"]),
        class_name=d.get("class_name", "UNKNOWN"),
        observations=observations,
        bus_ids=bus_ids,
        first_seen_ts=d.get("first_seen_ts", 0.0),
        last_seen_ts=d.get("last_seen_ts", 0.0),
        observation_count=d.get("observation_count", len(obs_ids)),
        bus_count=d.get("bus_count", len(bus_ids)),
        confidence=d.get("confidence", 0.0),
        severity=SeverityTier(d.get("severity", "UNKNOWN")),
        trend=IssueTrend(d.get("trend", "NEW")),
        center_gps=gps,
        status=d.get("status", "OPEN"),
        severity_history=d.get("severity_history", []),
        closure_history=d.get("closure_history", []),
    )


def process_issues(
    issues_list: List[Dict],
    obs_index: Optional[Dict[str, Dict]] = None,
    rules_path: Optional[str] = None,
) -> tuple[
    List[WorkItem],
    List[EvidenceChain],
    List[Dict],
    Dict[str, int],
    Dict[str, int],
    Dict[str, int],
]:
    """Run priority + routing + work item + evidence chain for all issues."""
    engine = PriorityEngine()
    router = DepartmentRouter(rules_path=rules_path or ROUTING_RULES_PATH)

    work_items: List[WorkItem] = []
    evidence_chains: List[EvidenceChain] = []
    priority_report_rows: List[Dict] = []

    band_counts: Dict[str, int] = defaultdict(int)
    dept_counts: Dict[str, int] = defaultdict(int)
    type_counts: Dict[str, int] = defaultdict(int)

    for issue_dict in issues_list:
        issue = issue_from_dict(issue_dict, obs_index)

        priority = engine.score(issue)
        routing = router.route(issue)
        work_item = WorkItemBuilder.build(issue, priority, routing)
        evidence = EvidenceChainBuilder.build(issue, work_item, priority, routing)

        work_items.append(work_item)
        evidence_chains.append(evidence)

        band_counts[priority.priority_band] += 1
        dept_counts[routing.department] += 1
        type_counts[issue.event_type.value] += 1

        priority_report_rows.append({
            "issue_id": issue.issue_id,
            "work_item_id": work_item.work_item_id,
            "event_type": issue.event_type.value,
            "severity": issue.severity.value,
            "priority_band": priority.priority_band,
            "priority_score": priority.priority_score,
            "bus_count": issue.bus_count,
            "obs_count": issue.observation_count,
            "department": routing.department_display,
            "gps_status": issue.center_gps.status.value if issue.center_gps else "NONE",
        })

    return (
        work_items,
        evidence_chains,
        priority_report_rows,
        dict(band_counts),
        dict(dept_counts),
        dict(type_counts),
    )


# ── Main pipeline ─────────────────────────────────────────────────────── #

def run(args: argparse.Namespace) -> None:
    os.makedirs(args.output, exist_ok=True)

    with open(args.issues, encoding="utf-8") as f:
        raw = json.load(f)

    issues_list: List[Dict] = raw.get("issues", raw) if isinstance(raw, dict) else raw
    print(f"\n  Loaded {len(issues_list)} issues from {args.issues}")

    obs_path = resolve_observations_path(args.issues, args.observations)
    obs_index: Optional[Dict[str, Dict]] = None
    if obs_path:
        obs_index = load_observation_index(obs_path)
        print(f"  Loaded {len(obs_index)} observations from {obs_path}")
    else:
        raise SystemExit(
            "ERROR: observations file required. Provide --observations or place a companion "
            "*_observations.json next to the issues file."
        )

    (
        work_items,
        evidence_chains,
        priority_report_rows,
        band_counts,
        dept_counts,
        type_counts,
    ) = process_issues(issues_list, obs_index, ROUTING_RULES_PATH)

    ts = _utc_now_iso()

    with open(os.path.join(args.output, "issues.json"), "w", encoding="utf-8") as f:
        json.dump({
            "source": args.issues,
            "observations_source": obs_path,
            "generated_at": ts,
            "count": len(issues_list),
            "issues": issues_list,
        }, f, indent=2)

    with open(os.path.join(args.output, "work_items.json"), "w", encoding="utf-8") as f:
        json.dump({
            "generated_at": ts,
            "count": len(work_items),
            "work_items": [wi.to_dict() for wi in work_items],
        }, f, indent=2)

    with open(os.path.join(args.output, "priority_report.json"), "w", encoding="utf-8") as f:
        json.dump({
            "generated_at": ts,
            "score_version": "priority_v1.0",
            "band_distribution": band_counts,
            "type_distribution": type_counts,
            "rows": priority_report_rows,
        }, f, indent=2)

    with open(os.path.join(args.output, "evidence_chain.json"), "w", encoding="utf-8") as f:
        json.dump({
            "generated_at": ts,
            "count": len(evidence_chains),
            "chains": [ec.to_dict() for ec in evidence_chains],
        }, f, indent=2)

    with open(os.path.join(args.output, "metrics.json"), "w", encoding="utf-8") as f:
        json.dump({
            "generated_at": ts,
            "source_issues": len(issues_list),
            "observations_source": obs_path,
            "work_items_created": len(work_items),
            "priority_distribution": band_counts,
            "department_distribution": dept_counts,
            "event_type_distribution": type_counts,
            "score_version": "priority_v1.0",
            "routing_version": "routing_v1.0",
        }, f, indent=2)

    _print_summary(
        issues_list, work_items, band_counts, dept_counts, args.output,
    )


def _print_summary(
    issues_list: List[Dict],
    work_items: List[WorkItem],
    band_counts: Dict[str, int],
    dept_counts: Dict[str, int],
    output_dir: str,
) -> None:
    sep = "=" * 62
    print("\n" + sep)
    print("  THE SIXTH SENSE - PHASE C: ACTIONABLE INTELLIGENCE")
    print(sep)
    print(f"  Issues processed      : {len(issues_list)}")
    print(f"  Work items created    : {len(work_items)}")
    print()
    print("  PRIORITY DISTRIBUTION:")
    for band in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
        n = band_counts.get(band, 0)
        bar = "#" * n
        print(f"    {band:<10} {n:3d}  {bar}")
    print()
    print("  DEPARTMENT DISTRIBUTION:")
    for dept, n in sorted(dept_counts.items(), key=lambda x: -x[1]):
        print(f"    {dept:<35} {n}")
    print()
    print("  OUTPUTS:")
    for fname in [
        "issues.json", "work_items.json", "priority_report.json",
        "evidence_chain.json", "metrics.json",
    ]:
        path = os.path.join(output_dir, fname)
        size = os.path.getsize(path)
        print(f"    {fname:<30} {size:>8,} bytes")

    if work_items:
        top = max(work_items, key=lambda w: w.priority_score)
        print()
        print("  EXAMPLE - HIGHEST PRIORITY WORK ITEM:")
        print(f"    work_item_id : {top.work_item_id}")
        print(f"    issue_id     : {top.issue_id}")
        print(f"    event_type   : {top.event_type}")
        print(f"    priority     : {top.priority_band} ({top.priority_score:.1f}/100)")
        print(f"    department   : {top.department_display}")
        print(f"    bus_count    : {top.bus_count}")
        print(f"    obs_count    : {top.observation_count}")
        if top.center_lat:
            print(
                f"    location     : {top.center_lat:.5f},{top.center_lon:.5f} "
                f"[{top.center_gps_status}]"
            )
        print()
        print("  WHY THIS PRIORITY:")
        for r in top.priority_reasons:
            print(f"    - {r}")
        print()
        print(f"  WHY {top.department}:")
        print(f"    {top.routing_reason}")
    print(sep)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Generate actionable work items from Phase B issues")
    p.add_argument(
        "--issues", required=True,
        help="Path to Phase B issues JSON (from run_urban_ai.py or simulate_multipass.py)",
    )
    p.add_argument(
        "--observations", default=None,
        help="Path to Phase B observations JSON (auto-detected from issues path if omitted)",
    )
    p.add_argument(
        "--output", default="outputs/actionable_demo",
        help="Output directory for work items, priority report, evidence chain",
    )
    return p.parse_args()


if __name__ == "__main__":
    run(parse_args())
