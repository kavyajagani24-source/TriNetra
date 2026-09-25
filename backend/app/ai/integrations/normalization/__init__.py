"""
TriNetra — Normalization Layer

Converts AI engine outputs into canonical TriNetra representations.

  EventNormalizer     — any engine result → UrbanEventData & cross-engine deduplication
  DetectionNormalizer — engine detections → standard detection DB records
  EvidenceNormalizer  — evidence file paths → web-accessible URLs
"""

from app.ai.integrations.normalization.detection_normalizer import DetectionNormalizer
from app.ai.integrations.normalization.event_normalizer import EventNormalizer
from app.ai.integrations.normalization.evidence_normalizer import EvidenceNormalizer

__all__ = [
    "EventNormalizer",
    "DetectionNormalizer",
    "EvidenceNormalizer",
]
