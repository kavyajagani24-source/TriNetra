"""
Repair Claim — The Sixth Sense, Phase D
Records that a field workflow marked an issue as repaired.

A repair claim does NOT automatically mean the issue is fixed.
Closure requires independent follow-up bus re-observation.
"""
from __future__ import annotations

import uuid
import datetime
from dataclasses import dataclass, field
from typing import Optional, Dict, List


class RepairClaimStatus:
    REPAIR_CLAIMED = "REPAIR_CLAIMED"
    VERIFICATION_PENDING = "VERIFICATION_PENDING"
    VERIFIED_REPAIRED = "VERIFIED_REPAIRED"
    VERIFICATION_DISCREPANCY = "VERIFICATION_DISCREPANCY"
    REOPENED = "REOPENED"
    MANUAL_REVIEW = "MANUAL_REVIEW"


@dataclass
class RepairClaim:
    claim_id: str
    issue_id: str
    work_item_id: str
    claimed_at: str
    claimed_by: str
    claimed_status: str
    repair_reference: Optional[str] = None
    notes: str = ""
    verification_events: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "claim_id": self.claim_id,
            "issue_id": self.issue_id,
            "work_item_id": self.work_item_id,
            "claimed_at": self.claimed_at,
            "claimed_by": self.claimed_by,
            "claimed_status": self.claimed_status,
            "repair_reference": self.repair_reference,
            "notes": self.notes,
            "verification_events": self.verification_events,
        }


class RepairClaimBuilder:
    """Create a repair claim without closing the underlying issue."""

    @staticmethod
    def build(
        issue_id: str,
        work_item_id: str,
        claimed_by: str,
        repair_reference: Optional[str] = None,
        notes: str = "",
        claimed_at: Optional[str] = None,
    ) -> RepairClaim:
        ts = claimed_at or (
            datetime.datetime.now(datetime.timezone.utc)
            .isoformat()
            .replace("+00:00", "Z")
        )
        return RepairClaim(
            claim_id=f"RC-{uuid.uuid4().hex[:8].upper()}",
            issue_id=issue_id,
            work_item_id=work_item_id,
            claimed_at=ts,
            claimed_by=claimed_by,
            claimed_status=RepairClaimStatus.REPAIR_CLAIMED,
            repair_reference=repair_reference,
            notes=notes,
        )
