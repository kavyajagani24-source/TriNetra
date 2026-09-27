"""
Incident + ANPR AI — Response Schemas
SIH 2026 | PS 26125

Pydantic v2 models for the POST /api/incident/analyze response contract.
All outputs reflect measured pipeline detections; no claims of 100% accuracy.
All GPS telemetry is explicitly None/null when absent from media container.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class PlateInfo(BaseModel):
    """License plate detection and OCR extraction result."""
    plate_number: Optional[str] = Field(None, description="Extracted alphanumeric license plate, or null if unreadable")
    confidence: float = Field(0.0, description="Combined plate detection + OCR confidence [0.0 - 1.0]")
    format_valid: bool = Field(False, description="True if text matches standard Indian license plate format")
    status: str = Field(..., description="DETECTED | UNREADABLE | LOW_CONFIDENCE | NO_PLATE_DETECTED")
    bbox: Optional[List[float]] = Field(None, description="[x1, y1, x2, y2] bounding box of plate in frame")
    associated_track_id: Optional[int] = Field(None, description="Track ID of the vehicle carrying this plate")


class AbnormalDrivingEvent(BaseModel):
    """Kinematic behavior profile for tracked vehicles (pixel-space proxies)."""
    track_id: int
    class_name: str
    behavior_label: str = Field(..., description="NORMAL | ABNORMAL_DRIVING_CANDIDATE | REVIEW_REQUIRED")
    anomalies: List[str] = Field(default_factory=list, description="Detected kinematic anomaly flags")
    avg_speed_px_s: float = Field(..., description="Average velocity proxy in px/s (uncalibrated)")
    max_speed_px_s: float = Field(..., description="Peak velocity proxy in px/s (uncalibrated)")
    max_accel_px_s2: float = Field(..., description="Peak acceleration proxy in px/s^2 (uncalibrated)")
    max_decel_px_s2: float = Field(..., description="Peak deceleration proxy in px/s^2 (uncalibrated)")
    heading_change_rate_deg_s: float = Field(..., description="Heading change rate proxy in deg/s (swerving)")
    jerk_proxy_px_s3: Optional[float] = Field(None, description="Peak jerk proxy in px/s^3 (rate of acceleration change)")
    stop_go_count: Optional[int] = Field(None, description="Count of stop-and-go transitions")
    trajectory_curvature: Optional[float] = Field(None, description="Mean directional curvature proxy")
    evidence_breakdown: Optional[Dict[str, bool]] = Field(None, description="Individual kinematic anomaly flags")
    verdict_explanation: Optional[str] = Field(None, description="Human-readable explanation of contributing anomalies")
    timestamp: Optional[float] = Field(None, description="Video timestamp (seconds) when anomaly occurred")
    confidence: float


class CollisionCandidate(BaseModel):
    """Temporal collision candidate detection."""
    detected: bool = Field(..., description="True if collision candidate probability >= 0.5")
    confidence: float = Field(..., description="Reported collision score [0.0 - 1.0]")
    model_confidence: Optional[float] = Field(None, description="Pure deep spatio-temporal model sigmoid probability")
    kinematic_corroboration: Optional[bool] = Field(None, description="True if physical vehicle contact/deceleration corroborates")
    fused_incident_score: Optional[float] = Field(None, description="Multi-signal evidence fusion score [0.0 - 1.0]")
    pairwise_score: Optional[float] = Field(None, description="Pairwise vehicle interaction model probability")
    near_collision_flagged: Optional[bool] = Field(None, description="True if close pass / hard-negative near miss detected")
    collision_class: Optional[str] = Field(None, description="NORMAL | NEAR_COLLISION | COLLISION_CANDIDATE")
    fusion_mode: Optional[str] = Field(None, description="rule_based | logistic_regression | gradient_boosting")
    status: str = Field(..., description="COLLISION_CANDIDATE | NORMAL | REVIEW_REQUIRED")
    operational_tier: Optional[str] = Field("NORMAL_TRAFFIC", description="DISPATCH_EMERGENCY | OPERATOR_REVIEW | NORMAL_TRAFFIC")
    peak_timestamp_sec: Optional[float] = Field(None, description="Estimated time of impact in video seconds")
    peak_frame_idx: Optional[int] = Field(None, description="Estimated impact frame index")
    involved_track_ids: List[int] = Field(default_factory=list, description="Vehicle tracks located near impact zone")


class HitAndRunCandidate(BaseModel):
    """Hit-and-Run temporal state machine assessment."""
    is_hit_and_run_candidate: bool = Field(..., description="True if involved vehicle departed without stopping")
    status: str = Field(..., description="HIT_AND_RUN_CANDIDATE | VEHICLE_DEPARTURE_AFTER_COLLISION | COLLISION_WITHOUT_DEPARTURE | BOTH_VEHICLES_DEPARTED | INSUFFICIENT_TRACK_EVIDENCE | NO_INCIDENT")
    offending_track_id: Optional[int] = Field(None, description="Track ID of the departing vehicle")
    victim_track_id: Optional[int] = Field(None, description="Track ID of the stationary/impacted vehicle")
    offending_plate: Optional[PlateInfo] = Field(None, description="ANPR result for the offending vehicle")
    departure_speed_px_s: Optional[float] = Field(None, description="Observed departure velocity proxy (px/s)")
    departure_heading: Optional[str] = Field(None, description="Cardinal departure direction: NORTH | SOUTH | EAST | WEST")
    confidence: float = Field(..., description="Confidence in candidate assessment")
    reason: str = Field("", description="Diagnostic rationale for state transition")


class EvidencePacket(BaseModel):
    """Incident evidence artifacts saved to disk."""
    packet_id: str
    output_dir: str
    before_image_url: Optional[str] = None
    during_image_url: Optional[str] = None
    after_image_url: Optional[str] = None
    annotated_video_url: Optional[str] = None
    manifest_url: Optional[str] = None
    incident_json_url: Optional[str] = None


class IncidentMetrics(BaseModel):
    """Pipeline performance and model execution statistics."""
    collision_model: str = "ResNet18-BiGRU-Attention"
    collision_checkpoint: str = "models/incident/collision_model_best.pt"
    anpr_model: str = "yolo11n_plate.pt + EasyOCR"
    inference_device: str
    frames_processed: int
    video_duration_sec: float
    processing_time_sec: float
    fps: float
    stage_timings_sec: Optional[Dict[str, float]] = Field(default_factory=dict, description="Wall-clock execution time per pipeline stage")


class IncidentAlertSummary(BaseModel):
    """Unified Command Center incident alert contract (Person 4 Section 10)."""
    incident_id: str = Field(..., description="Unique incident identifier / packet ID")
    incident_type: str = Field(..., description="COLLISION_CANDIDATE | HIT_AND_RUN_CANDIDATE | ABNORMAL_DRIVING_CANDIDATE | NONE")
    status: str = Field(..., description="CANDIDATE | REVIEW_REQUIRED | NO_INCIDENT")
    confidence: float = Field(..., description="Overall incident confidence [0.0 - 1.0]")
    timestamp: str = Field(..., description="ISO 8601 incident timestamp")
    statement: Optional[str] = Field(None, description="Human-readable executive incident summary statement")
    gps: Optional[Dict[str, float]] = Field(None, description="Explicitly null unless verified GPS metadata is provided")
    vehicle: Optional[Dict[str, Any]] = Field(None, description="Relevant vehicle info (track_id)")
    anpr: Optional[Dict[str, Any]] = Field(None, description="Plate info (plate_number, plate_confidence, status)")
    evidence: Dict[str, Optional[str]] = Field(default_factory=dict, description="Paths/URLs to before, during, after, annotated_video, manifest")
    vehicle_counts: Optional[Dict[str, int]] = Field(default_factory=dict, description="Census of detected road users by class")


class IncidentAnalysisResponse(BaseModel):
    """Full API response contract for POST /api/incident/analyze."""
    run_id: str
    module: str = "incident"
    source: str = "REAL_VIDEO_INFERENCE"
    status: str = Field(..., description="completed | failed")
    timestamp: str = Field(..., description="ISO 8601 analysis timestamp")
    statement: Optional[str] = Field(None, description="Human-readable executive incident summary statement")
    gps_coordinates: Optional[Dict[str, float]] = Field(None, description="Explicitly null unless verified GPS metadata provided")
    vehicle_counts: Dict[str, int] = Field(default_factory=dict, description="Census breakdown of detected vehicles and road users")
    collision: CollisionCandidate
    hit_and_run: HitAndRunCandidate
    abnormal_driving: List[AbnormalDrivingEvent]
    anpr_detections: List[PlateInfo]
    evidence: EvidencePacket
    incident_summary: Optional[IncidentAlertSummary] = Field(None, description="Command Center alert summary")
    metrics: IncidentMetrics
    error: Optional[str] = None

