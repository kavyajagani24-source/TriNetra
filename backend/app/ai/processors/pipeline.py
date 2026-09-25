"""
TriNetra — Orchestrated Urban AI Processing Pipeline

Authoritative orchestrator coordinating the three AI systems:
  1. The-Sixth-Sense-AI (Road Infrastructure: D00/D10/D20/D40/Repair)
  2. The-Sixth-Sense-AI (Traffic: Vehicles, Tracking, Congestion)
  3. SIH2026 Module 3   (Safety: Pedestrian/VRU Safety, ByteTrack, Risk Engine)

GPU Memory Management:
  Engines are invoked sequentially (Road -> Traffic -> Safety) so that each
  engine finishes and releases memory before the next runs.
"""

from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import cv2

from app.ai.integrations.normalization.detection_normalizer import DetectionNormalizer
from app.ai.integrations.normalization.event_normalizer import EventNormalizer
from app.ai.integrations.normalization.evidence_normalizer import EvidenceNormalizer
from app.ai.integrations.safety_module3.adapter import SafetyAdapter
from app.ai.integrations.safety_module3.config import CameraSafetyProfile
from app.ai.integrations.safety_module3.runner import SafetyModule3Runner
from app.ai.integrations.sixth_sense.client import SixthSenseClient
from app.ai.integrations.sixth_sense.road_adapter import RoadAdapter
from app.ai.integrations.sixth_sense.schemas import SixthSenseRunResult
from app.ai.integrations.sixth_sense.traffic_adapter import TrafficAdapter
from app.ai.models.detection_types import (
    CongestionLevel,
    DensityLevel,
    PipelineResult,
)
from app.ai.models.event_types import UrbanEventData
from app.core.config import Settings, get_settings
from app.core.constants import ProcessingStatus

logger = logging.getLogger(__name__)


class UrbanAIPipeline:
    """
    Central AI Pipeline Orchestrator.
    Dispatches video inference to authoritative engines and consolidates results.
    """

    def __init__(
        self,
        settings: Optional[Settings] = None,
        sixth_sense_client: Optional[SixthSenseClient] = None,
        safety_runner: Optional[SafetyModule3Runner] = None,
        detector: Optional[Any] = None,  # For backward-compatibility in testing
    ) -> None:
        self.settings = settings or get_settings()
        self.sixth_sense_client = sixth_sense_client or SixthSenseClient()
        self.safety_runner = safety_runner or SafetyModule3Runner()

        self.road_adapter = RoadAdapter()
        self.traffic_adapter = TrafficAdapter()
        self.safety_adapter = SafetyAdapter()

        self.event_normalizer = EventNormalizer()
        self.detection_normalizer = DetectionNormalizer()
        self.evidence_normalizer = EvidenceNormalizer()

    def run(
        self,
        video_path: str,
        video_id: str,
        job_id: str,
        camera_profile: Optional[CameraSafetyProfile] = None,
        bus_id: Optional[str] = None,
        camera_id: Optional[str] = None,
        video_lat: Optional[float] = None,
        video_lon: Optional[float] = None,
        output_dir: Optional[str] = None,
        evidence_dir: Optional[str] = None,
        status_callback: Optional[Callable[[ProcessingStatus, float], None]] = None,
        progress_callback: Optional[Callable[[int, int, float, int], None]] = None,
    ) -> PipelineResult:
        """
        Execute multi-engine pipeline on the target video.

        Stages:
          1. ROAD_ANALYSIS: Sixth Sense Road AI (RDD2022 checkpoint)
          2. TRAFFIC_ANALYSIS: Sixth Sense Traffic AI (YOLO11x checkpoint)
          3. SAFETY_ANALYSIS: Module 3 Safety AI (models/best.pt + ByteTrack)
          4. NORMALIZING & PERSISTING: Deduplication, evidence normalization
        """
        video_path_obj = Path(video_path).resolve()
        if not video_path_obj.exists():
            raise FileNotFoundError(f"Video file not found: {video_path_obj}")

        # Extract lightweight video headers (no frame loop)
        cap = cv2.VideoCapture(str(video_path_obj))
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1920)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1080)
        cap.release()

        duration = total_frames / max(1.0, fps)

        out_dir = Path(output_dir or self.settings.PROCESSED_PATH) / job_id
        out_dir.mkdir(parents=True, exist_ok=True)

        ev_dir = Path(evidence_dir or self.settings.EVIDENCE_PATH) / job_id
        ev_dir.mkdir(parents=True, exist_ok=True)

        engine_statuses: Dict[str, Any] = {}
        annotated_paths: Dict[str, Optional[str]] = {
            "road": None,
            "traffic": None,
            "safety": None,
        }

        # ── Stage 1: Road AI (The-Sixth-Sense-AI) ──────────────────────────────
        road_result: Optional[SixthSenseRunResult] = None
        road_events: List[UrbanEventData] = []
        road_detections: List[Dict[str, Any]] = []

        if self.settings.ROAD_AI_ENABLED:
            logger.info("[%s] Starting Stage 1: Road Infrastructure AI", job_id)
            if status_callback:
                status_callback(ProcessingStatus.ROAD_ANALYSIS, 15.0)

            t0 = time.monotonic()
            try:
                road_result = self.sixth_sense_client.analyze_road(
                    video_path=str(video_path_obj),
                    output_base=str(out_dir),
                    profile=self.settings.SIXTH_SENSE_PROFILE,
                    run_id=f"{job_id}_road",
                )
                t_road = time.monotonic() - t0
                engine_statuses["road"] = {
                    "status": road_result.status,
                    "runtime_sec": round(t_road, 2),
                    "detections_count": len(road_result.detections),
                    "annotated_video": road_result.annotated_video_path,
                }
                annotated_paths["road"] = self.evidence_normalizer.normalize_video_url(
                    road_result.annotated_video_path
                )
                road_events = self.road_adapter.to_urban_events(
                    result=road_result,
                    video_id=video_id,
                    job_id=job_id,
                    video_lat=video_lat,
                    video_lon=video_lon,
                )
                road_detections = self.detection_normalizer.from_road_detections(
                    detections=road_result.detections,
                    video_id=video_id,
                    job_id=job_id,
                )
            except Exception as e:
                logger.exception("[%s] Road AI failed: %s", job_id, e)
                engine_statuses["road"] = {"status": "failed", "error": str(e)}
        else:
            engine_statuses["road"] = {"status": "skipped", "reason": "disabled_by_config"}

        # ── Stage 2: Traffic AI (The-Sixth-Sense-AI) ───────────────────────────
        traffic_result: Optional[SixthSenseRunResult] = None
        traffic_detections: List[Dict[str, Any]] = []
        traffic_analytics_dict: Optional[Dict[str, Any]] = None
        total_unique_vehicles = 0
        counts_by_class: Dict[str, int] = {}
        peak_density = DensityLevel.LOW
        avg_congestion = CongestionLevel.LOW

        if self.settings.TRAFFIC_AI_ENABLED:
            logger.info("[%s] Starting Stage 2: Traffic AI", job_id)
            if status_callback:
                status_callback(ProcessingStatus.TRAFFIC_ANALYSIS, 45.0)

            t0 = time.monotonic()
            try:
                traffic_result = self.sixth_sense_client.analyze_traffic(
                    video_path=str(video_path_obj),
                    output_base=str(out_dir),
                    profile=self.settings.SIXTH_SENSE_PROFILE,
                    run_id=f"{job_id}_traffic",
                )
                t_traffic = time.monotonic() - t0
                engine_statuses["traffic"] = {
                    "status": traffic_result.status,
                    "runtime_sec": round(t_traffic, 2),
                    "tracks_count": len(traffic_result.detections),
                    "annotated_video": traffic_result.annotated_video_path,
                }
                annotated_paths["traffic"] = self.evidence_normalizer.normalize_video_url(
                    traffic_result.annotated_video_path
                )
                traffic_summary = self.traffic_adapter.to_traffic_summary(traffic_result)
                total_unique_vehicles = traffic_summary.unique_vehicle_count
                counts_by_class = traffic_summary.counts_by_class

                density_enum_map = {
                    "LOW": DensityLevel.LOW,
                    "MODERATE": DensityLevel.MEDIUM,
                    "HIGH": DensityLevel.HIGH,
                    "VERY_HIGH": DensityLevel.SEVERE,
                }
                peak_density = density_enum_map.get(traffic_summary.traffic_density, DensityLevel.LOW)

                congestion_enum_map = {
                    "LOW": CongestionLevel.LOW,
                    "MEDIUM": CongestionLevel.MODERATE,
                    "MODERATE": CongestionLevel.MODERATE,
                    "HIGH": CongestionLevel.HIGH,
                    "SEVERE": CongestionLevel.SEVERE,
                }
                avg_congestion = congestion_enum_map.get(traffic_summary.congestion_level, CongestionLevel.LOW)

                traffic_analytics_dict = self.traffic_adapter.to_traffic_analytics_dict(
                    result=traffic_result,
                    video_id=video_id,
                    job_id=job_id,
                )
                traffic_detections = self.detection_normalizer.from_traffic_detections(
                    detections=traffic_result.detections,
                    video_id=video_id,
                    job_id=job_id,
                )
            except Exception as e:
                logger.exception("[%s] Traffic AI failed: %s", job_id, e)
                engine_statuses["traffic"] = {"status": "failed", "error": str(e)}
        else:
            engine_statuses["traffic"] = {"status": "skipped", "reason": "disabled_by_config"}

        # ── Stage 3: Safety AI (SIH2026 Module 3) ──────────────────────────────
        raw_safety_events: List[Any] = []
        safety_urban_events: List[UrbanEventData] = []
        safety_detections: List[Dict[str, Any]] = []

        if self.settings.SAFETY_AI_ENABLED:
            logger.info("[%s] Starting Stage 3: Module 3 Safety AI", job_id)
            if status_callback:
                status_callback(ProcessingStatus.SAFETY_ANALYSIS, 75.0)

            t0 = time.monotonic()
            try:
                safety_out_dir = out_dir / "safety"
                safety_out_dir.mkdir(parents=True, exist_ok=True)

                raw_safety_events = self.safety_runner.analyze(
                    video_path=video_path_obj,
                    output_dir=safety_out_dir,
                    camera_profile=camera_profile,
                    bus_id=bus_id,
                    camera_id=camera_id,
                    save_video=True,
                )
                t_safety = time.monotonic() - t0

                annotated_safety_file = safety_out_dir / f"{video_path_obj.stem}_annotated.mp4"
                annotated_safety_str = (
                    str(annotated_safety_file) if annotated_safety_file.exists() else None
                )
                annotated_paths["safety"] = self.evidence_normalizer.normalize_video_url(
                    annotated_safety_str
                )

                engine_statuses["safety"] = {
                    "status": "completed",
                    "runtime_sec": round(t_safety, 2),
                    "events_count": len(raw_safety_events),
                    "annotated_video": annotated_safety_str,
                }
                safety_urban_events = self.safety_adapter.to_urban_events(
                    events=raw_safety_events,
                    video_id=video_id,
                    job_id=job_id,
                    video_lat=video_lat,
                    video_lon=video_lon,
                )
                safety_detections = self.detection_normalizer.from_safety_events(
                    safety_events=raw_safety_events,
                    video_id=video_id,
                    job_id=job_id,
                )
            except Exception as e:
                logger.exception("[%s] Safety AI failed: %s", job_id, e)
                engine_statuses["safety"] = {"status": "failed", "error": str(e)}
        else:
            engine_statuses["safety"] = {"status": "skipped", "reason": "disabled_by_config"}

        # ── Stage 4: Normalizing & Evidence Integration ───────────────────────
        if status_callback:
            status_callback(ProcessingStatus.NORMALIZING, 90.0)

        all_raw_events = road_events + safety_urban_events
        deduped_events = self.event_normalizer.deduplicate(all_raw_events)

        # Normalize evidence paths in extra_metadata
        for ev in deduped_events:
            ev.extra_metadata = self.evidence_normalizer.normalize_event_evidence(ev.extra_metadata)

        all_detections = road_detections + traffic_detections + safety_detections

        # Construct backward-compatible active_tracks_summary from traffic tracks
        active_tracks_summary: Dict[int, Dict[str, Any]] = {}
        if traffic_result and traffic_result.detections:
            for d in traffic_result.detections:
                try:
                    tid = int(d.get("track_id", 0))
                    active_tracks_summary[tid] = {
                        "class_name": d.get("class_name", "vehicle"),
                        "first_seen_frame": d.get("first_seen_frame", 0),
                        "last_seen_frame": d.get("last_seen_frame", 0),
                        "first_seen_timestamp": d.get("first_seen_ts", 0.0),
                        "last_seen_timestamp": d.get("last_seen_ts", 0.0),
                        "max_confidence": float(d.get("latest_confidence", 0.0)),
                        "average_confidence": float(d.get("latest_confidence", 0.0)),
                        "status": "confirmed" if d.get("confirmed") else "tentative",
                    }
                except Exception:
                    pass

        # Primary annotated video: road if available, else safety, else traffic
        primary_annotated_video = (
            annotated_paths["road"] or annotated_paths["safety"] or annotated_paths["traffic"]
        )

        if progress_callback:
            progress_callback(
                total_frames,
                total_frames,
                100.0,
                total_unique_vehicles + len(deduped_events),
            )

        return PipelineResult(
            video_id=video_id,
            job_id=job_id,
            total_frames=total_frames,
            frames_processed=total_frames,
            fps=fps,
            duration_seconds=duration,
            total_unique_vehicles=total_unique_vehicles,
            counts_by_class=counts_by_class,
            total_detections_recorded=len(all_detections),
            peak_density=peak_density,
            avg_congestion_level=avg_congestion,
            annotated_video_path=primary_annotated_video,
            evidence_image_paths=[],
            frame_results=[],
            active_tracks_summary=active_tracks_summary,
            urban_events=deduped_events,
            road_result=road_result,
            traffic_result=traffic_result,
            safety_events=raw_safety_events,
            engine_statuses=engine_statuses,
            annotated_video_paths=annotated_paths,
            normalized_detections=all_detections,
            traffic_analytics_record=traffic_analytics_dict,
        )
