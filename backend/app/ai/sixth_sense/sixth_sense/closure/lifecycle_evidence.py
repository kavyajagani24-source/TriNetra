"""
Lifecycle Evidence Chain — The Sixth Sense, Phase D
Extends Phase C evidence chain with repair claim and verification events.

Full lifecycle:
  Detection → Observation → Persistent Issue → Priority → Department →
  WorkItem → Repair Claim → Verification Observation → Verification Decision
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any

from sixth_sense.schemas.urban_event import PersistentIssue, Observation
from sixth_sense.actionable.work_item import WorkItem
from sixth_sense.actionable.evidence_chain import EvidenceChain, EvidenceChainBuilder
from sixth_sense.actionable.priority_engine import PriorityResult
from sixth_sense.actionable.department_router import RoutingResult
from sixth_sense.closure.repair_claim import RepairClaim
from sixth_sense.closure.verification_engine import VerificationResult, FollowUpPass


@dataclass
class LifecycleEvidenceChain:
    """Complete City Memory audit trail including closure verification."""

    # Phase C chain (embedded)
    phase_c: EvidenceChain

    # Repair claim
    repair_claim: Optional[Dict] = None

    # Verification
    follow_up_pass: Optional[Dict] = None
    verification_observation: Optional[Dict] = None
    verification_decision: Optional[Dict] = None

    # Lifecycle status
    issue_lifecycle_status: str = "OPEN"
    scenario_label: str = ""
    data_provenance_note: str = ""

    def to_dict(self) -> Dict:
        base = self.phase_c.to_dict()
        base.update({
            "repair_claim": self.repair_claim,
            "follow_up_pass": self.follow_up_pass,
            "verification_observation": self.verification_observation,
            "verification_decision": self.verification_decision,
            "issue_lifecycle_status": self.issue_lifecycle_status,
            "scenario_label": self.scenario_label,
            "data_provenance_note": self.data_provenance_note,
            "lifecycle_stages": [
                "detection",
                "observation",
                "persistent_issue",
                "priority",
                "department_routing",
                "work_item",
                "repair_claim",
                "verification_observation",
                "verification_decision",
            ],
        })
        return base


class LifecycleEvidenceBuilder:
    @staticmethod
    def _observation_record(obs: Observation) -> Dict:
        gps = obs.gps
        return {
            "obs_id": obs.obs_id,
            "bus_id": obs.bus_id,
            "run_id": obs.run_id,
            "event_type": obs.event_type.value,
            "class_name": obs.class_name,
            "confidence": round(obs.confidence, 4),
            "severity": obs.severity.value,
            "first_seen_ts": round(obs.first_seen_ts, 3),
            "last_seen_ts": round(obs.last_seen_ts, 3),
            "detection_count": obs.detection_count,
            "model_name": obs.model_name,
            "gps": {
                "lat": gps.lat if gps else None,
                "lon": gps.lon if gps else None,
                "status": gps.status.value if gps else None,
                "uncertainty_m": gps.uncertainty_m if gps else None,
            },
            "evidence_ref": obs.evidence_ref,
        }

    @staticmethod
    def build(
        issue: PersistentIssue,
        work_item: WorkItem,
        priority: PriorityResult,
        routing: RoutingResult,
        claim: Optional[RepairClaim] = None,
        follow_up: Optional[FollowUpPass] = None,
        verification: Optional[VerificationResult] = None,
        verification_obs: Optional[Observation] = None,
        scenario_label: str = "",
        data_provenance_note: str = "",
    ) -> LifecycleEvidenceChain:
        phase_c = EvidenceChainBuilder.build(issue, work_item, priority, routing)

        ver_obs_dict = None
        if verification_obs:
            ver_obs_dict = LifecycleEvidenceBuilder._observation_record(verification_obs)

        return LifecycleEvidenceChain(
            phase_c=phase_c,
            repair_claim=claim.to_dict() if claim else None,
            follow_up_pass=follow_up.to_dict() if follow_up else None,
            verification_observation=ver_obs_dict,
            verification_decision=verification.to_dict() if verification else None,
            issue_lifecycle_status=issue.status,
            scenario_label=scenario_label,
            data_provenance_note=data_provenance_note,
        )
