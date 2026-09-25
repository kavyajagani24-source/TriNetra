"""
TriNetra AI Integration Layer — Phase 2

Adapter/client code bridging authoritative AI engines to TriNetra models.

Ownership:
  Road AI       → Sixth Sense (sixth_sense/)
  Traffic AI    → Sixth Sense (sixth_sense/)
  Safety AI     → Module 3   (safety_module3/)
  Orchestration → TriNetra  (normalization/)
"""

from app.ai.integrations.normalization import (
    DetectionNormalizer,
    EventNormalizer,
    EvidenceNormalizer,
)
from app.ai.integrations.safety_module3 import (
    CameraSafetyProfile,
    CameraZone,
    SafetyAdapter,
    SafetyModule3Runner,
)
from app.ai.integrations.sixth_sense import (
    NormalizedRoadDetection,
    NormalizedTrafficDetection,
    NormalizedTrafficSummary,
    RoadAdapter,
    SixthSenseClient,
    SixthSenseRunResult,
    TrafficAdapter,
)

__all__ = [
    "SixthSenseClient",
    "RoadAdapter",
    "TrafficAdapter",
    "SixthSenseRunResult",
    "NormalizedRoadDetection",
    "NormalizedTrafficDetection",
    "NormalizedTrafficSummary",
    "SafetyModule3Runner",
    "SafetyAdapter",
    "CameraSafetyProfile",
    "CameraZone",
    "EventNormalizer",
    "DetectionNormalizer",
    "EvidenceNormalizer",
]
