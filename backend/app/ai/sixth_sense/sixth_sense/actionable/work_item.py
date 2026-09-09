"""
Work Item — The Sixth Sense, Phase C
Actionable municipal work item produced from a PersistentIssue.

One PersistentIssue → One WorkItem.
WorkItem carries full provenance: issue → observations → buses → GPS → priority → routing.

Status lifecycle:
  NEW → TRIAGED → ASSIGNED → IN_PROGRESS → VERIFICATION_PENDING → RESOLVED
                                                                  ↓
                                                             REOPENED
  At any point: REJECTED (human reviewer dismisses)
"""
from __future__ import annotations

import uuid
import datetime
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

from sixth_sense.schemas.urban_event import PersistentIssue, GPSStatus
from sixth_sense.actionable.priority_engine import PriorityResult
from sixth_sense.actionable.department_router import RoutingResult


class WorkItemStatus:
    NEW                  = "NEW"
    TRIAGED              = "TRIAGED"
    ASSIGNED             = "ASSIGNED"
    IN_PROGRESS          = "IN_PROGRESS"
    VERIFICATION_PENDING = "VERIFICATION_PENDING"
    RESOLVED             = "RESOLVED"
    REOPENED             = "REOPENED"
    REJECTED             = "REJECTED"


@dataclass
class WorkItem:
    """
    Actionable municipal work item.
    Produced deterministically from PersistentIssue + priority + routing.
    Carries full evidence provenance — no raw video copied.
    """
    work_item_id: str
    issue_id: str

    # Classification
    event_type: str
    class_name: str

    # Department routing
    department: str
    department_display: str
    routing_reason: str
    matched_routing_rule: str
    routing_rule_version: str

    # Priority
    priority_band: str
    priority_score: float
    priority_reasons: List[str]
    score_breakdown: Dict[str, Any]
    score_version: str

    # Status
    status: str = WorkItemStatus.NEW
    created_at: str = field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc)
        .isoformat()
        .replace("+00:00", "Z")
    )

    # Issue metadata
    severity: str = "UNKNOWN"
    confidence: float = 0.0
    observation_count: int = 0
    bus_count: int = 0
    bus_ids: List[str] = field(default_factory=list)
    trend: str = "NEW"
    issue_status: str = "OPEN"

    # GPS
    center_lat: Optional[float] = None
    center_lon: Optional[float] = None
    center_gps_status: Optional[str] = None
    center_gps_uncertainty_m: Optional[float] = None

    # Timestamps
    first_seen_ts: float = 0.0
    last_seen_ts: float = 0.0

    # Evidence provenance (IDs only — no raw frames)
    observation_ids: List[str] = field(default_factory=list)
    evidence_refs: List[str] = field(default_factory=list)   # paths to evidence frames if saved

    # Explainability
    why_priority: str = ""
    why_department: str = ""

    def to_dict(self) -> Dict:
        return {
            "work_item_id": self.work_item_id,
            "issue_id": self.issue_id,
            "status": self.status,
            "created_at": self.created_at,

            "event_type": self.event_type,
            "class_name": self.class_name,
            "severity": self.severity,
            "confidence": round(self.confidence, 4),
            "trend": self.trend,
            "issue_status": self.issue_status,

            "department": self.department,
            "department_display": self.department_display,
            "routing_reason": self.routing_reason,
            "matched_routing_rule": self.matched_routing_rule,
            "routing_rule_version": self.routing_rule_version,

            "priority_band": self.priority_band,
            "priority_score": round(self.priority_score, 2),
            "priority_reasons": self.priority_reasons,
            "score_breakdown": self.score_breakdown,
            "score_version": self.score_version,

            "observation_count": self.observation_count,
            "bus_count": self.bus_count,
            "bus_ids": self.bus_ids,

            "location": {
                "lat": self.center_lat,
                "lon": self.center_lon,
                "gps_status": self.center_gps_status,
                "uncertainty_m": self.center_gps_uncertainty_m,
            },

            "first_seen_ts": round(self.first_seen_ts, 3),
            "last_seen_ts": round(self.last_seen_ts, 3),
            "duration_s": round(self.last_seen_ts - self.first_seen_ts, 1),

            "observation_ids": self.observation_ids,
            "evidence_refs": self.evidence_refs,

            "why_priority": self.why_priority,
            "why_department": self.why_department,
        }


class WorkItemBuilder:
    """
    Assembles a WorkItem from a PersistentIssue + PriorityResult + RoutingResult.
    """

    @staticmethod
    def build(
        issue: PersistentIssue,
        priority: PriorityResult,
        routing: RoutingResult,
    ) -> WorkItem:
        work_item_id = f"WI-{uuid.uuid4().hex[:8].upper()}"

        # GPS fields
        lat = lon = gps_status = gps_unc = None
        if issue.center_gps:
            lat = issue.center_gps.lat
            lon = issue.center_gps.lon
            gps_status = issue.center_gps.status.value
            gps_unc = issue.center_gps.uncertainty_m

        # Observation IDs
        obs_ids = [o.obs_id for o in issue.observations]

        # Evidence refs (paths to saved frames, if any)
        evidence_refs = [
            o.evidence_ref for o in issue.observations
            if o.evidence_ref is not None
        ]

        # Human-readable explainability
        why_priority = _build_why_priority(issue, priority)
        why_department = _build_why_department(issue, routing)

        return WorkItem(
            work_item_id=work_item_id,
            issue_id=issue.issue_id,
            event_type=issue.event_type.value,
            class_name=issue.class_name,
            department=routing.department,
            department_display=routing.department_display,
            routing_reason=routing.routing_reason,
            matched_routing_rule=routing.matched_rule,
            routing_rule_version=routing.routing_rule_version,
            priority_band=priority.priority_band,
            priority_score=priority.priority_score,
            priority_reasons=priority.reasons,
            score_breakdown=priority.score_breakdown,
            score_version=priority.score_version,
            severity=issue.severity.value,
            confidence=issue.confidence,
            observation_count=issue.observation_count,
            bus_count=issue.bus_count,
            bus_ids=list(issue.bus_ids),
            trend=issue.trend.value,
            issue_status=issue.status,
            center_lat=lat,
            center_lon=lon,
            center_gps_status=gps_status,
            center_gps_uncertainty_m=gps_unc,
            first_seen_ts=issue.first_seen_ts,
            last_seen_ts=issue.last_seen_ts,
            observation_ids=obs_ids,
            evidence_refs=evidence_refs,
            why_priority=why_priority,
            why_department=why_department,
        )


def _build_why_priority(issue: PersistentIssue, priority: PriorityResult) -> str:
    lines = [
        f"Issue {issue.issue_id} scored {priority.priority_score:.1f}/100 "
        f"→ {priority.priority_band} priority",
        "",
        "SCORING FACTORS:",
    ]
    for reason in priority.reasons:
        lines.append(f"  • {reason}")
    return "\n".join(lines)


def _build_why_department(issue: PersistentIssue, routing: RoutingResult) -> str:
    return (
        f"Issue type [{issue.event_type.value}] matched routing rule "
        f"[{routing.matched_rule}] → {routing.department_display}.\n"
        f"Reason: {routing.routing_reason}"
    )
