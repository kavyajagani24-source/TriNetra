"""
TriNetra — Module 3 Safety Integration Adapter

Module 3 is authoritative for:
  - Pedestrian / VRU Safety Intelligence
  - YOLO11n + ByteTrack tracking
  - Trajectory analysis
  - Crossing / road-entry / school-zone reasoning
  - Risk engine (heuristic risk score — NOT collision probability)
  - SafetyEvent lifecycle + evidence generation

This package provides:
  SafetyModule3Runner — wraps PipelineRunner.run() for TriNetra jobs
  SafetyAdapter       — normalises SafetyEvent → UrbanEventData
  CameraSafetyProfile — camera-specific spatial zone calibrations
  CameraZone          — individual polygon zone definition
"""

from app.ai.integrations.safety_module3.adapter import SafetyAdapter
from app.ai.integrations.safety_module3.config import (
    CameraSafetyProfile,
    CameraZone,
    _ensure_module3_on_path,
    _resolve_module3_root,
)
from app.ai.integrations.safety_module3.runner import SafetyModule3Runner

__all__ = [
    "SafetyModule3Runner",
    "SafetyAdapter",
    "CameraSafetyProfile",
    "CameraZone",
    "_resolve_module3_root",
    "_ensure_module3_on_path",
]
