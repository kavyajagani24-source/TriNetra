"""
Generate Verification Demo — The Sixth Sense, Phase D
Proof-of-Closure demonstration using REAL Phase B road-crack detections.

REAL DATA:
  - Original D00 detections, observations, issues from multipass Phase B run
  - Work items from Phase C actionable pipeline

SIMULATED SCENARIO (clearly labeled):
  - Repair claim timestamps and claimed_by roles
  - Follow-up pass timing (post-repair bus pass)
  - CASE A: empty follow-up observations (no defect at location)
  - CASE B: uses REAL follow-up observation re-attributed as post-repair pass

Usage:
    python generate_verification_demo.py \\
        --issues outputs/multipass2/multipass_6f838080_issues.json \\
        --observations outputs/multipass2/multipass_6f838080_observations.json \\
        --work-items outputs/actionable_demo/work_items.json \\
        --output outputs/verification_demo
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from typing import List, Dict, Any, Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from generate_actionable import (
    load_observation_index,
    issue_from_dict,
    observation_from_dict,
    clone_as_follow_up_observation,
    _utc_now_iso,
    ROUTING_RULES_PATH,
    process_issues,
)
from sixth_sense.schemas.urban_event import GPSPoint, GPSStatus, Observation
from sixth_sense.actionable.priority_engine import PriorityEngine
from sixth_sense.actionable.department_router import DepartmentRouter
from sixth_sense.actionable.work_item import WorkItemBuilder
from sixth_sense.closure.repair_claim import RepairClaimBuilder, RepairClaimStatus
from sixth_sense.closure.verification_engine import (
    VerificationEngine, FollowUpPass, VerificationOutcome,
)
from sixth_sense.closure.lifecycle_evidence import LifecycleEvidenceBuilder


PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

REAL_DETECTION_NOTE = (
    "Original detections/observations/issues are REAL Phase B GPU inference outputs."
)
SIMULATED_SCENARIO_NOTE = (
    "Repair claims and follow-up pass timing are SIMULATED post-repair workflow scenarios. "
    "CASE A uses absence of follow-up detection (simulated clear pass). "
    "CASE B reuses a REAL D00 observation as post-repair re-detection evidence."
)


def _load_work_items(path: str) -> Dict[str, Dict]:
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    items = raw.get("work_items", raw)
    return {wi["issue_id"]: wi for wi in items}


def _find_work_item_id(issue_id: str, work_items: Dict[str, Dict]) -> str:
    wi = work_items.get(issue_id)
    if wi:
        return wi["work_item_id"]
    return f"WI-UNKNOWN-{issue_id[-6:]}"


def run_demo(args: argparse.Namespace) -> None:
    os.makedirs(args.output, exist_ok=True)

    with open(args.issues, encoding="utf-8") as f:
        issues_raw = json.load(f)
    issues_list = issues_raw["issues"]

    obs_index = load_observation_index(args.observations)
    work_items_map = _load_work_items(args.work_items)

    road_issues = [d for d in issues_list if d["event_type"] == "ROAD_CRACK"]
    if len(road_issues) < 2:
        raise SystemExit("Need at least 2 ROAD_CRACK issues for demo scenarios")

    # Showcase issues: P001 and P002
    p001_dict = next(d for d in road_issues if d["issue_id"] == "issue_5737cc9173")
    p002_dict = next(
        (d for d in road_issues if d["issue_id"] != p001_dict["issue_id"]),
        road_issues[1],
    )

    engine = PriorityEngine()
    router = DepartmentRouter(rules_path=ROUTING_RULES_PATH)
    verifier = VerificationEngine()

    repair_claims: List[Dict] = []
    verification_events: List[Dict] = []
    reopened_issues: List[Dict] = []
    lifecycle_chains: List[Dict] = []
    scenario_results: List[Dict] = []

    scenarios = [
        {
            "label": "CASE_A_VERIFIED_REPAIRED",
            "issue_dict": p001_dict,
            "description": (
                "P001: corroborated D00 crack → repair claimed → "
                "follow-up pass with NO corresponding defect → VERIFIED_REPAIRED"
            ),
            "simulate_still_present": False,
        },
        {
            "label": "CASE_B_REOPENED_DISCREPANCY",
            "issue_dict": p002_dict,
            "description": (
                "P002: corroborated D00 crack → repair claimed → "
                "follow-up REAL D00 re-detection → VERIFICATION_DISCREPANCY → REOPENED"
            ),
            "simulate_still_present": True,
        },
    ]

    for scenario in scenarios:
        issue_dict = scenario["issue_dict"]
        issue = issue_from_dict(issue_dict, obs_index)
        issue_id = issue.issue_id

        priority = engine.score(issue)
        routing = router.route(issue)
        work_item = WorkItemBuilder.build(issue, priority, routing)
        if issue_id in work_items_map:
            work_item.work_item_id = work_items_map[issue_id]["work_item_id"]

        claim = RepairClaimBuilder.build(
            issue_id=issue_id,
            work_item_id=work_item.work_item_id,
            claimed_by="PWD_FIELD_CREW_SIMULATED",
            repair_reference=f"WO-{issue_id[-6:].upper()}",
            notes=(
                "SIMULATED repair claim for Proof-of-Closure demo. "
                "Does not represent an actual municipal repair record."
            ),
            claimed_at="2026-09-10T08:00:00Z",
        )
        claim.claimed_status = RepairClaimStatus.VERIFICATION_PENDING
        repair_claims.append(claim.to_dict())

        # Build follow-up pass
        center = issue.center_gps
        pass_gps = GPSPoint(
            lat=center.lat,
            lon=center.lon,
            timestamp=center.timestamp + 86400.0,
            uncertainty_m=center.uncertainty_m,
            heading=center.heading,
            status=center.status,
        ) if center else None

        follow_up_obs: List[Observation] = []
        verification_obs: Optional[Observation] = None

        if scenario["simulate_still_present"]:
            obs_id = issue_dict["observation_ids"][0]
            real_obs = clone_as_follow_up_observation(
                obs_index[obs_id],
                new_obs_id=f"obs_followup_{issue.issue_id[-8:]}",
                bus_id="BUS_003",
                run_id="verification_demo_follow_up",
            )
            follow_up_obs = [real_obs]
            verification_obs = real_obs
            provenance = "REAL_OBSERVATION_CLONED_AS_POST_REPAIR_PASS"
        else:
            # Simulated clear pass — bus covered location, no defect detected
            provenance = "SIMULATED_CLEAR_PASS_NO_DEFECT"

        follow_up = FollowUpPass(
            bus_id="BUS_003",
            pass_timestamp=(issue.last_seen_ts or 0) + 86400.0,
            pass_gps=pass_gps,
            observations=follow_up_obs,
            run_id="verification_demo_follow_up",
            data_provenance=provenance,
        )

        result = verifier.verify(issue, claim, follow_up)
        verifier.apply_result(issue, claim, result, follow_up)

        verification_events.append(result.to_dict())
        repair_claims[-1]["claimed_status"] = claim.claimed_status

        if result.verification_result == VerificationOutcome.REOPENED:
            reopened_issues.append({
                "issue_id": issue.issue_id,
                "original_issue_id": issue.issue_id,
                "reopened_at": result.reopened_at,
                "status": issue.status,
                "trend": issue.trend.value,
                "verification_id": result.verification_id,
                "matched_observation_id": result.matched_observation_id,
                "observation_count_after": issue.observation_count,
                "observation_ids": [o.obs_id for o in issue.observations],
                "closure_history": issue.closure_history,
                "note": "Original issue ID preserved — City Memory continuity maintained",
            })

        chain = LifecycleEvidenceBuilder.build(
            issue=issue,
            work_item=work_item,
            priority=priority,
            routing=routing,
            claim=claim,
            follow_up=follow_up,
            verification=result,
            verification_obs=verification_obs,
            scenario_label=scenario["label"],
            data_provenance_note=(
                f"{REAL_DETECTION_NOTE} {SIMULATED_SCENARIO_NOTE}"
            ),
        )
        lifecycle_chains.append(chain.to_dict())

        scenario_results.append({
            "scenario": scenario["label"],
            "description": scenario["description"],
            "issue_id": issue_id,
            "work_item_id": work_item.work_item_id,
            "verification_result": result.verification_result,
            "verification_confidence": result.verification_confidence,
            "claim_status": claim.claimed_status,
            "issue_status": issue.status,
            "follow_up_provenance": provenance,
        })

    # Additional scenarios: REVIEW_REQUIRED (low confidence), GPS unavailable, distant defect
    extra_scenarios = _build_review_scenarios(obs_index, p001_dict, verifier)
    for extra in extra_scenarios:
        verification_events.append(extra["verification"].to_dict())
        repair_claims.append(extra["claim"].to_dict())
        lifecycle_chains.append(extra["chain"].to_dict())
        scenario_results.append(extra["summary"])

    ts = _utc_now_iso()
    outcome_counts: Dict[str, int] = defaultdict(int)
    for ev in verification_events:
        outcome_counts[ev["verification_result"]] += 1

    outputs = {
        "repair_claims.json": {
            "generated_at": ts,
            "count": len(repair_claims),
            "data_provenance": {
                "detections": "REAL_PHASE_B",
                "repair_claims": "SIMULATED_WORKFLOW",
            },
            "repair_claims": repair_claims,
        },
        "verification_events.json": {
            "generated_at": ts,
            "count": len(verification_events),
            "verification_version": "closure_v1.0",
            "events": verification_events,
        },
        "reopened_issues.json": {
            "generated_at": ts,
            "count": len(reopened_issues),
            "reopened_issues": reopened_issues,
        },
        "evidence_chain.json": {
            "generated_at": ts,
            "count": len(lifecycle_chains),
            "chains": lifecycle_chains,
        },
        "metrics.json": {
            "generated_at": ts,
            "scenarios_executed": len(scenario_results),
            "verification_outcomes": dict(outcome_counts),
            "repair_claims_created": len(repair_claims),
            "issues_reopened": len(reopened_issues),
            "real_road_crack_issues_available": len(road_issues),
            "verification_version": "closure_v1.0",
            "data_provenance_notes": {
                "real_detections": REAL_DETECTION_NOTE,
                "simulated_workflow": SIMULATED_SCENARIO_NOTE,
            },
            "scenario_results": scenario_results,
        },
    }

    for fname, data in outputs.items():
        path = os.path.join(args.output, fname)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    _print_summary(scenario_results, args.output)


def _build_review_scenarios(
    obs_index: Dict[str, Dict],
    issue_dict: Dict,
    verifier: VerificationEngine,
) -> List[Dict]:
    """Extra REVIEW_REQUIRED scenarios: low confidence, GPS unavailable, distant defect."""
    from sixth_sense.schemas.urban_event import EventType, SeverityTier
    from copy import deepcopy

    extras: List[Dict] = []
    issue = issue_from_dict(issue_dict, obs_index)
    center = issue.center_gps
    if center is None:
        return extras

    base_claim = RepairClaimBuilder.build(
        issue_id=issue.issue_id,
        work_item_id="WI-REVIEW-DEMO",
        claimed_by="PWD_FIELD_CREW_SIMULATED",
        claimed_at="2026-09-11T08:00:00Z",
    )
    base_claim.claimed_status = RepairClaimStatus.VERIFICATION_PENDING

    # Low confidence follow-up
    low_obs_raw = deepcopy(obs_index[issue_dict["observation_ids"][0]])
    low_obs_raw["obs_id"] = "obs_sim_low_conf_followup"
    low_obs_raw["confidence"] = 0.18
    low_obs = observation_from_dict(low_obs_raw)
    claim1 = RepairClaimBuilder.build(
        issue_id=issue.issue_id + "_review_lowconf",
        work_item_id="WI-REVIEW-LOWCONF",
        claimed_by="SIMULATED",
        claimed_at="2026-09-11T09:00:00Z",
    )
    claim1.claimed_status = RepairClaimStatus.VERIFICATION_PENDING
    issue1 = issue_from_dict(issue_dict, obs_index)
    fu1 = FollowUpPass(
        bus_id="BUS_003", pass_timestamp=99999.0,
        pass_gps=center, observations=[low_obs],
        data_provenance="SIMULATED_LOW_CONFIDENCE",
    )
    res1 = verifier.verify(issue1, claim1, fu1)
    extras.append(_pack_extra(issue1, claim1, fu1, res1, low_obs,
                               "REVIEW_LOW_CONFIDENCE", issue_dict, obs_index))

    # GPS unavailable follow-up
    unavail_obs_raw = deepcopy(obs_index[issue_dict["observation_ids"][0]])
    unavail_obs_raw["obs_id"] = "obs_sim_unavail_gps"
    unavail_obs_raw["gps"] = {
        "lat": 0, "lon": 0, "timestamp": 0,
        "uncertainty_m": 0, "heading": None, "status": "UNAVAILABLE",
    }
    unavail_obs = observation_from_dict(unavail_obs_raw)
    claim2 = RepairClaimBuilder.build(
        issue_id=issue.issue_id + "_review_gps",
        work_item_id="WI-REVIEW-GPS",
        claimed_by="SIMULATED",
        claimed_at="2026-09-11T10:00:00Z",
    )
    claim2.claimed_status = RepairClaimStatus.VERIFICATION_PENDING
    issue2 = issue_from_dict(issue_dict, obs_index)
    fu2 = FollowUpPass(
        bus_id="BUS_003", pass_timestamp=99999.0,
        pass_gps=GPSPoint(0, 0, 0, 999, None, GPSStatus.UNAVAILABLE),
        observations=[unavail_obs],
        data_provenance="SIMULATED_GPS_UNAVAILABLE",
    )
    res2 = verifier.verify(issue2, claim2, fu2)
    extras.append(_pack_extra(issue2, claim2, fu2, res2, unavail_obs,
                               "REVIEW_GPS_UNAVAILABLE", issue_dict, obs_index))

    # Distant defect — should NOT match original issue
    distant_obs_raw = deepcopy(obs_index[issue_dict["observation_ids"][0]])
    distant_obs_raw["obs_id"] = "obs_sim_distant_defect"
    distant_obs_raw["gps"] = {
        "lat": center.lat + 0.01,  # ~1.1 km north
        "lon": center.lon,
        "timestamp": center.timestamp,
        "uncertainty_m": 8.0,
        "heading": None,
        "status": "DIRECT",
    }
    distant_obs = observation_from_dict(distant_obs_raw)
    claim3 = RepairClaimBuilder.build(
        issue_id=issue.issue_id + "_review_distant",
        work_item_id="WI-REVIEW-DISTANT",
        claimed_by="SIMULATED",
        claimed_at="2026-09-11T11:00:00Z",
    )
    claim3.claimed_status = RepairClaimStatus.VERIFICATION_PENDING
    issue3 = issue_from_dict(issue_dict, obs_index)
    fu3 = FollowUpPass(
        bus_id="BUS_003", pass_timestamp=99999.0,
        pass_gps=GPSPoint(
            lat=center.lat + 0.01,
            lon=center.lon,
            timestamp=center.timestamp,
            uncertainty_m=8.0,
            heading=None,
            status=GPSStatus.DIRECT,
        ),
        observations=[distant_obs],
        data_provenance="SIMULATED_DISTANT_DEFECT",
    )
    res3 = verifier.verify(issue3, claim3, fu3)
    extras.append(_pack_extra(issue3, claim3, fu3, res3, distant_obs,
                               "REVIEW_DISTANT_DEFECT_NO_MATCH", issue_dict, obs_index))

    # Different issue type at same location
    diff_obs_raw = deepcopy(obs_index[issue_dict["observation_ids"][0]])
    diff_obs_raw["obs_id"] = "obs_sim_waterlogging"
    diff_obs_raw["event_type"] = "WATERLOGGING"
    diff_obs_raw["class_name"] = "water"
    diff_obs = observation_from_dict(diff_obs_raw)
    claim4 = RepairClaimBuilder.build(
        issue_id=issue.issue_id + "_review_type",
        work_item_id="WI-REVIEW-TYPE",
        claimed_by="SIMULATED",
        claimed_at="2026-09-11T12:00:00Z",
    )
    claim4.claimed_status = RepairClaimStatus.VERIFICATION_PENDING
    issue4 = issue_from_dict(issue_dict, obs_index)
    fu4 = FollowUpPass(
        bus_id="BUS_003", pass_timestamp=99999.0,
        pass_gps=center, observations=[diff_obs],
        data_provenance="SIMULATED_DIFFERENT_EVENT_TYPE",
    )
    res4 = verifier.verify(issue4, claim4, fu4)
    extras.append(_pack_extra(issue4, claim4, fu4, res4, diff_obs,
                               "VERIFIED_REPAIRED_DIFFERENT_TYPE_IGNORED", issue_dict, obs_index))

    return extras


def _pack_extra(issue, claim, follow_up, result, ver_obs, label, issue_dict, obs_index):
    from sixth_sense.actionable.priority_engine import PriorityEngine
    from sixth_sense.actionable.department_router import DepartmentRouter
    from sixth_sense.actionable.work_item import WorkItemBuilder

    engine = PriorityEngine()
    router = DepartmentRouter(rules_path=ROUTING_RULES_PATH)
    issue_full = issue_from_dict(issue_dict, obs_index)
    issue_full.issue_id = issue.issue_id
    priority = engine.score(issue_full)
    routing = router.route(issue_full)
    wi = WorkItemBuilder.build(issue_full, priority, routing)

    chain = LifecycleEvidenceBuilder.build(
        issue=issue, work_item=wi, priority=priority, routing=routing,
        claim=claim, follow_up=follow_up, verification=result,
        verification_obs=ver_obs, scenario_label=label,
        data_provenance_note=SIMULATED_SCENARIO_NOTE,
    )
    return {
        "claim": claim,
        "verification": result,
        "chain": chain,
        "summary": {
            "scenario": label,
            "issue_id": issue.issue_id,
            "verification_result": result.verification_result,
            "verification_confidence": result.verification_confidence,
            "follow_up_provenance": follow_up.data_provenance,
        },
    }


def _print_summary(scenario_results: List[Dict], output_dir: str) -> None:
    sep = "=" * 62
    print("\n" + sep)
    print("  THE SIXTH SENSE - PHASE D: PROOF-OF-CLOSURE VERIFICATION")
    print(sep)
    print(f"  Scenarios executed : {len(scenario_results)}")
    print()
    for s in scenario_results:
        print(f"  [{s['scenario']}]")
        print(f"    issue_id  : {s.get('issue_id', 'N/A')}")
        print(f"    result    : {s['verification_result']}")
        print(f"    confidence: {s.get('verification_confidence', 0):.3f}")
        print(f"    provenance: {s.get('follow_up_provenance', 'N/A')}")
        print()
    print("  OUTPUTS:")
    for fname in [
        "repair_claims.json", "verification_events.json", "reopened_issues.json",
        "evidence_chain.json", "metrics.json",
    ]:
        path = os.path.join(output_dir, fname)
        size = os.path.getsize(path)
        print(f"    {fname:<30} {size:>8,} bytes")
    print(sep)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Proof-of-Closure verification demo")
    p.add_argument("--issues", default="outputs/multipass2/multipass_6f838080_issues.json")
    p.add_argument("--observations", default="outputs/multipass2/multipass_6f838080_observations.json")
    p.add_argument("--work-items", default="outputs/actionable_demo/work_items.json")
    p.add_argument("--output", default="outputs/verification_demo")
    return p.parse_args()


if __name__ == "__main__":
    run_demo(parse_args())
