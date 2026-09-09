"""
Evidence Chain Builder — The Sixth Sense, Phase C
Produces a full audit trail from WorkItem → Issue → Observations → buses → GPS.

Every automatic decision must have traceable provenance.
No raw video is copied. Only IDs, metadata, and decision records.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any

from sixth_sense.schemas.urban_event import PersistentIssue
from sixth_sense.actionable.work_item import WorkItem
from sixth_sense.actionable.priority_engine import PriorityResult
from sixth_sense.actionable.department_router import RoutingResult


@dataclass
class ObservationProvenanceRecord:
    obs_id: str
    bus_id: str
    camera_id: str
    run_id: str
    event_type: str
    class_name: str
    confidence: float
    severity: str
    first_seen_ts: float
    last_seen_ts: float
    detection_count: int
    model_name: str
    gps_lat: Optional[float]
    gps_lon: Optional[float]
    gps_status: Optional[str]
    gps_uncertainty_m: Optional[float]
    evidence_ref: Optional[str]

    def to_dict(self) -> Dict:
        return {
            "obs_id": self.obs_id,
            "bus_id": self.bus_id,
            "camera_id": self.camera_id,
            "run_id": self.run_id,
            "event_type": self.event_type,
            "class_name": self.class_name,
            "confidence": round(self.confidence, 4),
            "severity": self.severity,
            "first_seen_ts": round(self.first_seen_ts, 3),
            "last_seen_ts": round(self.last_seen_ts, 3),
            "detection_count": self.detection_count,
            "model_name": self.model_name,
            "gps": {
                "lat": self.gps_lat,
                "lon": self.gps_lon,
                "status": self.gps_status,
                "uncertainty_m": self.gps_uncertainty_m,
            },
            "evidence_ref": self.evidence_ref,
        }


@dataclass
class EvidenceChain:
    """
    Complete audit trail for one WorkItem.
    Links work item → persistent issue → all contributing observations.
    """
    work_item_id: str
    issue_id: str

    # Issue summary
    event_type: str
    class_name: str
    model_name: str        # model that produced detections (from observations)
    severity: str
    confidence: float
    trend: str
    issue_status: str

    # Observation records
    observation_records: List[ObservationProvenanceRecord] = field(default_factory=list)

    # Source bus summary
    bus_ids: List[str] = field(default_factory=list)
    bus_count: int = 0
    observation_count: int = 0

    # GPS centroid
    center_gps: Optional[Dict] = None

    # Priority decision record
    priority_decision: Optional[Dict] = None

    # Routing decision record
    routing_decision: Optional[Dict] = None

    # Human-readable explainability
    why_priority: str = ""
    why_department: str = ""

    def to_dict(self) -> Dict:
        return {
            "work_item_id": self.work_item_id,
            "issue_id": self.issue_id,
            "event_type": self.event_type,
            "class_name": self.class_name,
            "model_name": self.model_name,
            "severity": self.severity,
            "confidence": round(self.confidence, 4),
            "trend": self.trend,
            "issue_status": self.issue_status,
            "bus_ids": self.bus_ids,
            "bus_count": self.bus_count,
            "observation_count": self.observation_count,
            "center_gps": self.center_gps,
            "observations": [o.to_dict() for o in self.observation_records],
            "priority_decision": self.priority_decision,
            "routing_decision": self.routing_decision,
            "why_priority": self.why_priority,
            "why_department": self.why_department,
        }


class EvidenceChainBuilder:
    """
    Assembles EvidenceChain from issue + work item + priority + routing.
    """

    @staticmethod
    def build(
        issue: PersistentIssue,
        work_item: WorkItem,
        priority: PriorityResult,
        routing: RoutingResult,
    ) -> EvidenceChain:

        # Build observation provenance records
        obs_records: List[ObservationProvenanceRecord] = []
        model_names = set()
        for obs in issue.observations:
            model_names.add(obs.model_name)
            gps = obs.gps
            obs_records.append(ObservationProvenanceRecord(
                obs_id=obs.obs_id,
                bus_id=obs.bus_id,
                camera_id=obs.camera_id,
                run_id=obs.run_id,
                event_type=obs.event_type.value,
                class_name=obs.class_name,
                confidence=obs.confidence,
                severity=obs.severity.value,
                first_seen_ts=obs.first_seen_ts,
                last_seen_ts=obs.last_seen_ts,
                detection_count=obs.detection_count,
                model_name=obs.model_name,
                gps_lat=gps.lat if gps else None,
                gps_lon=gps.lon if gps else None,
                gps_status=gps.status.value if gps else None,
                gps_uncertainty_m=gps.uncertainty_m if gps else None,
                evidence_ref=obs.evidence_ref,
            ))

        center_gps_dict = None
        if issue.center_gps:
            center_gps_dict = issue.center_gps.to_dict()

        return EvidenceChain(
            work_item_id=work_item.work_item_id,
            issue_id=issue.issue_id,
            event_type=issue.event_type.value,
            class_name=issue.class_name,
            model_name=", ".join(sorted(model_names)) or "unknown",
            severity=issue.severity.value,
            confidence=issue.confidence,
            trend=issue.trend.value,
            issue_status=issue.status,
            observation_records=obs_records,
            bus_ids=list(issue.bus_ids),
            bus_count=issue.bus_count,
            observation_count=issue.observation_count,
            center_gps=center_gps_dict,
            priority_decision=priority.to_dict(),
            routing_decision=routing.to_dict(),
            why_priority=work_item.why_priority,
            why_department=work_item.why_department,
        )
