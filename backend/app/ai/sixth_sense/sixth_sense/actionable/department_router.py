"""
Department Router — The Sixth Sense, Phase C
Configurable deterministic routing of PersistentIssues to municipal departments.

Rules are loaded from config/routing_rules.yaml.
These mappings are NOT legally authoritative.
They represent suggested routing based on issue type and a configurable ruleset.

Every routing decision includes:
  - department (machine ID)
  - department_display (human label)
  - routing_reason (human-readable explanation)
  - routing_rule_version
  - matched_rule (which rule fired)
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Dict, List, Optional, Any

import yaml

from sixth_sense.schemas.urban_event import PersistentIssue, EventType

ROUTING_VERSION = "routing_v1.0"

# Default rules (used when routing_rules.yaml is not found)
_DEFAULT_RULES: List[Dict[str, Any]] = [
    {
        "rule_id": "ROAD_DEFECT",
        "event_types": ["POTHOLE", "ROAD_CRACK", "ROAD_DAMAGE", "ROAD_REPAIR"],
        "department": "PWD_ROAD_MAINTENANCE",
        "department_display": "PWD / Road Maintenance",
        "routing_reason": (
            "Road surface defect detected — routed to Public Works Department "
            "(Road Maintenance) for inspection and repair."
        ),
    },
    {
        "rule_id": "WATERLOGGING",
        "event_types": ["WATERLOGGING"],
        "department": "SANITATION_DRAINAGE",
        "department_display": "Sanitation / Drainage",
        "routing_reason": (
            "Waterlogging detected — routed to Sanitation & Drainage department."
        ),
    },
    {
        "rule_id": "TRAFFIC_INFRASTRUCTURE",
        "event_types": ["TRAFFIC_SIGN", "ZEBRA_CROSSING", "ROAD_DIVIDER"],
        "department": "TRAFFIC_ENGINEERING",
        "department_display": "Traffic Engineering",
        "routing_reason": (
            "Traffic infrastructure issue — routed to Traffic Engineering department."
        ),
    },
    {
        "rule_id": "CONGESTION",
        "event_types": ["CONGESTION", "VEHICLE"],
        "department": "TRAFFIC_ICCC",
        "department_display": "Traffic / ICCC",
        "routing_reason": (
            "Traffic or congestion observation — routed to Traffic Management / ICCC."
        ),
    },
    {
        "rule_id": "SAFETY_INCIDENT",
        "event_types": ["INCIDENT_CANDIDATE"],
        "department": "TRAFFIC_POLICE",
        "department_display": "Traffic Police / Authorized Review",
        "routing_reason": (
            "Potential incident candidate — flagged for Traffic Police / authorized review. "
            "NOTE: Requires human verification before action."
        ),
    },
    {
        "rule_id": "GARBAGE_DEBRIS",
        "event_types": ["GARBAGE"],
        "department": "SANITATION_SWACHH",
        "department_display": "Sanitation / Swachh Bharat",
        "routing_reason": (
            "Garbage or debris detected — routed to Sanitation (Swachh Bharat cell)."
        ),
    },
    {
        "rule_id": "PEDESTRIAN_VRU",
        "event_types": ["PEDESTRIAN", "CYCLIST"],
        "department": "TRAFFIC_PEDESTRIAN_SAFETY",
        "department_display": "Traffic / Pedestrian Safety",
        "routing_reason": (
            "Pedestrian/VRU observation — routed to Pedestrian Safety cell for review."
        ),
    },
    {
        "rule_id": "DEFAULT",
        "event_types": [],   # catch-all
        "department": "MUNICIPAL_GENERAL",
        "department_display": "Municipal Corporation — General",
        "routing_reason": (
            "Unclassified issue type — routed to Municipal Corporation for manual triage."
        ),
    },
]


@dataclass
class RoutingResult:
    department: str
    department_display: str
    routing_reason: str
    matched_rule: str
    routing_rule_version: str = ROUTING_VERSION

    def to_dict(self) -> Dict:
        return {
            "department": self.department,
            "department_display": self.department_display,
            "routing_reason": self.routing_reason,
            "matched_rule": self.matched_rule,
            "routing_rule_version": self.routing_rule_version,
        }


class DepartmentRouter:
    """
    Deterministic department router.
    Loads rules from YAML if available; falls back to hardcoded defaults.
    Rules are evaluated in order — first match wins.
    """

    def __init__(self, rules_path: Optional[str] = None) -> None:
        self._rules = self._load_rules(rules_path)

    def _load_rules(self, path: Optional[str]) -> List[Dict[str, Any]]:
        if path and os.path.exists(path):
            try:
                with open(path) as f:
                    cfg = yaml.safe_load(f)
                rules = cfg.get("routing_rules", {}).get("rules", [])
                if rules:
                    return rules
            except Exception:
                pass
        return _DEFAULT_RULES

    def route(self, issue: PersistentIssue) -> RoutingResult:
        event_str = issue.event_type.value

        for rule in self._rules:
            # Skip catch-all rule until end
            if not rule.get("event_types"):
                continue
            if event_str in rule["event_types"]:
                return RoutingResult(
                    department=rule["department"],
                    department_display=rule["department_display"],
                    routing_reason=rule["routing_reason"],
                    matched_rule=rule["rule_id"],
                )

        # Catch-all
        default = next(
            (r for r in self._rules if not r.get("event_types")), _DEFAULT_RULES[-1]
        )
        return RoutingResult(
            department=default["department"],
            department_display=default["department_display"],
            routing_reason=default["routing_reason"],
            matched_rule=default["rule_id"],
        )
