"""
TriNetra — Sixth Sense Integration Adapter

Sixth Sense is authoritative for:
  - Road Infrastructure AI (D00/D10/D20/D40 crack & pothole detection)
  - Traffic AI (vehicle detection, tracking, density, congestion)

This package provides:
  SixthSenseClient   — calls Sixth Sense inference functions directly (Mode B)
  RoadAdapter        — normalises Sixth Sense road results → UrbanEventData
  TrafficAdapter     — normalises Sixth Sense traffic results → UrbanEventData
"""

from app.ai.integrations.sixth_sense.client import SixthSenseClient
from app.ai.integrations.sixth_sense.road_adapter import RoadAdapter
from app.ai.integrations.sixth_sense.schemas import (
    NormalizedRoadDetection,
    NormalizedTrafficDetection,
    NormalizedTrafficSummary,
    SixthSenseRunResult,
)
from app.ai.integrations.sixth_sense.traffic_adapter import TrafficAdapter

__all__ = [
    "SixthSenseClient",
    "RoadAdapter",
    "TrafficAdapter",
    "SixthSenseRunResult",
    "NormalizedRoadDetection",
    "NormalizedTrafficDetection",
    "NormalizedTrafficSummary",
]
