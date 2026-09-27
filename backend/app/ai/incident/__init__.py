"""
Incident + ANPR AI Module for The Sixth Sense AI.
SIH 2026 | PS 26125
"""

from app.ai.incident.anpr import ANPREngine, PlateResult
from app.ai.incident.behavior_engine import BehaviorEngine, KinematicProfile, TrajectoryPoint
from app.ai.incident.collision_model import CollisionDetector
from app.ai.incident.evidence import EvidenceManager
from app.ai.incident.hit_and_run import HitAndRunResult, HitAndRunStateMachine
from app.ai.incident.inference import IncidentPipeline
from app.ai.incident.schemas import (
    AbnormalDrivingEvent,
    CollisionCandidate,
    EvidencePacket,
    HitAndRunCandidate,
    IncidentAnalysisResponse,
    IncidentMetrics,
    PlateInfo,
)

__all__ = [
    "ANPREngine",
    "PlateResult",
    "BehaviorEngine",
    "KinematicProfile",
    "TrajectoryPoint",
    "CollisionDetector",
    "EvidenceManager",
    "HitAndRunResult",
    "HitAndRunStateMachine",
    "IncidentPipeline",
    "AbnormalDrivingEvent",
    "CollisionCandidate",
    "EvidencePacket",
    "HitAndRunCandidate",
    "IncidentAnalysisResponse",
    "IncidentMetrics",
    "PlateInfo",
]
