"""
TriNetra — Orchestrated Urban AI Processing Pipeline

Authoritative orchestrator coordinating the three AI systems:
  1. The-Sixth-Sense-AI (Road Infrastructure: D00/D10/D20/D40/Repair)
  2. The-Sixth-Sense-AI (Traffic: Vehicles, UrbianTracker, Congestion)
  3. SIH2026 Module 3   (Safety: Pedestrian/VRU Safety, Risk Engine)

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
        status_callback: Optional[Callable[..., None]] = None,
        progress_callback: Optional[Callable[[int, int, float, int], None]] = None,
        mode: str = "multi_engine",
    ) -> PipelineResult:
        """
        Execute multi-engine pipeline on the target video.

        Stages:
          1. ROAD_ANALYSIS: Sixth Sense Road AI (RDD2022 checkpoint)
          2. TRAFFIC_ANALYSIS: Sixth Sense Traffic AI (YOLO11x checkpoint)
          3. SAFETY_ANALYSIS: Module 3 Safety AI (models/best.pt + VRU tracking)
          4. INCIDENT_ANALYSIS: Person 4 Incident + ANPR AI
          5. NORMALIZING & PERSISTING: Deduplication, evidence normalization
        """
        video_path_obj = Path(video_path).resolve()
        if not video_path_obj.exists():
            raise FileNotFoundError(f"Video file not found: {video_path_obj}")

        def emit_status(
            new_status: ProcessingStatus,
            pct: float,
            module_update: Optional[Dict[str, Any]] = None,
        ) -> None:
            if not status_callback:
                return
            try:
                status_callback(new_status, pct, module_update)
            except TypeError:
                status_callback(new_status, pct)

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
            "incident": None,
        }

        # Determine which engines to execute based on mode
        run_road = (mode in ("multi_engine", "road")) and self.settings.ROAD_AI_ENABLED
        run_traffic = (mode in ("multi_engine", "traffic")) and self.settings.TRAFFIC_AI_ENABLED
        run_safety = (mode in ("multi_engine", "safety")) and self.settings.SAFETY_AI_ENABLED
        run_incident = (mode in ("multi_engine", "incident")) and getattr(self.settings, "INCIDENT_AI_ENABLED", True)

        # ── Stage 1: Road AI (The-Sixth-Sense-AI) ──────────────────────────────
        road_result: Optional[SixthSenseRunResult] = None
        road_events: List[UrbanEventData] = []
        road_detections: List[Dict[str, Any]] = []

        if run_road:
            logger.info("[%s] Starting Stage 1: Road Infrastructure AI", job_id)
            engine_statuses["road"] = {"status": "running"}
            emit_status(ProcessingStatus.ROAD_ANALYSIS, 15.0, {"road": engine_statuses["road"]})

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
            emit_status(ProcessingStatus.ROAD_ANALYSIS, 35.0, {"road": engine_statuses["road"]})
        else:
            engine_statuses["road"] = {
                "status": "skipped",
                "reason": "disabled_by_config" if not self.settings.ROAD_AI_ENABLED else f"not_selected_in_{mode}",
            }
            emit_status(ProcessingStatus.PROCESSING, 25.0, {"road": engine_statuses["road"]})

        # ── Stage 2: Traffic AI (The-Sixth-Sense-AI) ───────────────────────────
        traffic_result: Optional[SixthSenseRunResult] = None
        traffic_detections: List[Dict[str, Any]] = []
        traffic_analytics_dict: Optional[Dict[str, Any]] = None
        total_unique_vehicles = 0
        counts_by_class: Dict[str, int] = {}
        peak_density = DensityLevel.LOW
        avg_congestion = CongestionLevel.LOW

        if run_traffic:
            logger.info("[%s] Starting Stage 2: Traffic AI", job_id)
            engine_statuses["traffic"] = {"status": "running"}
            emit_status(ProcessingStatus.TRAFFIC_ANALYSIS, 45.0, {"traffic": engine_statuses["traffic"]})

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
            emit_status(ProcessingStatus.TRAFFIC_ANALYSIS, 65.0, {"traffic": engine_statuses["traffic"]})
        else:
            engine_statuses["traffic"] = {
                "status": "skipped",
                "reason": "disabled_by_config" if not self.settings.TRAFFIC_AI_ENABLED else f"not_selected_in_{mode}",
            }
            emit_status(ProcessingStatus.PROCESSING, 50.0, {"traffic": engine_statuses["traffic"]})

        # ── Stage 3: Safety AI (SIH2026 Module 3) ──────────────────────────────
        raw_safety_events: List[Any] = []
        safety_urban_events: List[UrbanEventData] = []
        safety_detections: List[Dict[str, Any]] = []

        if run_safety:
            if self.safety_runner.is_available():
                logger.info("[%s] Starting Stage 3: Module 3 Safety AI (External Runner)", job_id)
                engine_statuses["safety"] = {"status": "running"}
                emit_status(ProcessingStatus.SAFETY_ANALYSIS, 70.0, {"safety": engine_statuses["safety"]})

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
                        "engine": "Module 3 VRU Runner",
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
                emit_status(ProcessingStatus.SAFETY_ANALYSIS, 80.0, {"safety": engine_statuses["safety"]})
            else:
                logger.info("[%s] Starting Stage 3: Native Pedestrian & VRU Safety AI", job_id)
                engine_statuses["safety"] = {"status": "running"}
                emit_status(ProcessingStatus.SAFETY_ANALYSIS, 70.0, {"safety": engine_statuses["safety"]})

                t0 = time.monotonic()
                try:
                    from app.ai.models.detection_types import BoundingBox, FrameResult, TrackedDetection
                    from app.ai.safety.pedestrian_risk_analyser import PedestrianRiskAnalyser

                    analyser = PedestrianRiskAnalyser(enabled=True)
                    frames_map: Dict[int, List[TrackedDetection]] = {}

                    if traffic_result and traffic_result.detections:
                        for d in traffic_result.detections:
                            bbox_raw = d.get("bbox", [])
                            if len(bbox_raw) >= 4:
                                bbox_obj = BoundingBox(
                                    x1=float(bbox_raw[0]),
                                    y1=float(bbox_raw[1]),
                                    x2=float(bbox_raw[2]),
                                    y2=float(bbox_raw[3]),
                                )
                                td = TrackedDetection(
                                    bbox=bbox_obj,
                                    class_id=int(d.get("class_id", 0)),
                                    class_name=str(d.get("class_name", "unknown")),
                                    confidence=float(d.get("latest_confidence", 0.8)),
                                    track_id=int(d.get("track_id", 0)),
                                )
                                f_idx = int(d.get("first_seen_frame", 0))
                                frames_map.setdefault(f_idx, []).append(td)

                    native_safety_events: List[UrbanEventData] = []
                    for f_idx, tracked_list in sorted(frames_map.items()):
                        ts = f_idx / max(1.0, fps)
                        fr = FrameResult(
                            frame_number=f_idx,
                            timestamp=ts,
                            tracked_detections=tracked_list,
                        )
                        evs = analyser.analyse(
                            frame_result=fr,
                            frame_number=f_idx,
                            timestamp=ts,
                            frame_height=height,
                            frame_width=width,
                        )
                        for ev in evs:
                            ev.latitude = video_lat
                            ev.longitude = video_lon
                            native_safety_events.append(ev)

                    t_safety = time.monotonic() - t0
                    safety_urban_events = native_safety_events
                    engine_statuses["safety"] = {
                        "status": "completed",
                        "runtime_sec": round(t_safety, 2),
                        "events_count": len(safety_urban_events),
                        "engine": "Native Pedestrian & VRU Safety Analyser",
                    }
                except Exception as e:
                    logger.exception("[%s] Native Safety AI failed: %s", job_id, e)
                    engine_statuses["safety"] = {"status": "failed", "error": str(e)}
                emit_status(ProcessingStatus.SAFETY_ANALYSIS, 80.0, {"safety": engine_statuses["safety"]})
        else:
            engine_statuses["safety"] = {
                "status": "skipped",
                "reason": "disabled_by_config" if not self.settings.SAFETY_AI_ENABLED else f"not_selected_in_{mode}",
            }
            emit_status(ProcessingStatus.PROCESSING, 75.0, {"safety": engine_statuses["safety"]})

        # ── Stage 4: Incident & ANPR AI (Person 4) ───────────────────────────
        incident_urban_events: List[UrbanEventData] = []
        if run_incident:
            logger.info("[%s] Starting Stage 4: Incident & ANPR AI", job_id)
            engine_statuses["incident"] = {"status": "running"}
            emit_status(ProcessingStatus.INCIDENT_ANALYSIS, 82.0, {"incident": engine_statuses["incident"]})

            t0 = time.monotonic()
            try:
                from app.ai.incident.inference import IncidentPipeline
                inc_pipeline = IncidentPipeline()
                inc_report = inc_pipeline.analyze_video(
                    video_path=str(video_path_obj),
                    run_id=f"{job_id}_incident",
                    gps_coordinates={"latitude": video_lat, "longitude": video_lon} if video_lat and video_lon else None,
                    render_video=True,
                )
                t_inc = time.monotonic() - t0
                engine_statuses["incident"] = {
                    "status": "completed",
                    "runtime_sec": round(t_inc, 2),
                    "collision_detected": inc_report.collision.detected,
                    "hit_and_run_candidate": inc_report.hit_and_run.is_hit_and_run_candidate,
                    "rash_driving_count": len(inc_report.abnormal_driving),
                    "annotated_video": inc_report.evidence.annotated_video_url,
                }
                annotated_paths["incident"] = self.evidence_normalizer.normalize_video_url(
                    inc_report.evidence.annotated_video_url
                )

                # Convert incident detections to UrbanEventData
                from app.ai.models.event_types import EventSeverity, EventType
                is_true_accident = inc_report.collision.detected and getattr(inc_report.collision, "operational_tier", "") == "DISPATCH_EMERGENCY"

                if inc_report.collision.detected or inc_report.collision.near_collision_flagged:
                    incident_urban_events.append(
                        UrbanEventData(
                            event_type=EventType.ACCIDENT if is_true_accident else EventType.NEAR_MISS,
                            severity=EventSeverity.CRITICAL if is_true_accident else EventSeverity.HIGH,
                            confidence=inc_report.collision.confidence,
                            frame_number=inc_report.collision.peak_frame_idx or 0,
                            timestamp=inc_report.collision.peak_timestamp_sec or 0.0,
                            latitude=video_lat,
                            longitude=video_lon,
                            description=(
                                f"Collision candidate detected (Score: {int(inc_report.collision.confidence*100)}%). "
                                f"Involved tracks: {inc_report.collision.involved_track_ids}."
                                if is_true_accident
                                else f"Near-collision / vehicle proximity interaction (Score: {int(inc_report.collision.confidence*100)}%). Involved tracks: {inc_report.collision.involved_track_ids}."
                            ),
                            extra_metadata={
                                "fusion_score": inc_report.collision.fused_incident_score,
                                "operational_tier": inc_report.collision.operational_tier,
                                "evidence_frame": inc_report.evidence.during_image_url,
                                "evidence_before": inc_report.evidence.before_image_url,
                                "evidence_after": inc_report.evidence.after_image_url,
                            },
                        )
                    )

                for rd in inc_report.abnormal_driving:
                    incident_urban_events.append(
                        UrbanEventData(
                            event_type=EventType.RASH_DRIVING,
                            severity=EventSeverity.HIGH,
                            confidence=rd.confidence,
                            frame_number=0,
                            timestamp=rd.timestamp or 0.0,
                            latitude=video_lat,
                            longitude=video_lon,
                            description=f"Rash driving candidate: Track #{rd.track_id} ({rd.class_name}). {rd.verdict_explanation or ''}",
                            extra_metadata={
                                "track_id": rd.track_id,
                                "anomalies": rd.anomalies,
                                "max_speed_px_s": rd.max_speed_px_s,
                                "max_accel_px_s2": rd.max_accel_px_s2,
                            },
                        )
                    )

                if inc_report.hit_and_run.is_hit_and_run_candidate and is_true_accident:
                    incident_urban_events.append(
                        UrbanEventData(
                            event_type=EventType.ACCIDENT,
                            severity=EventSeverity.CRITICAL,
                            confidence=inc_report.hit_and_run.confidence,
                            frame_number=0,
                            timestamp=inc_report.collision.peak_timestamp_sec or 0.0,
                            latitude=video_lat,
                            longitude=video_lon,
                            description=f"Hit-and-Run assessment: {inc_report.hit_and_run.reason}",
                            extra_metadata={
                                "offending_track_id": inc_report.hit_and_run.offending_track_id,
                                "offending_plate": inc_report.hit_and_run.offending_plate.model_dump() if inc_report.hit_and_run.offending_plate else None,
                                "departure_speed_px_s": inc_report.hit_and_run.departure_speed_px_s,
                            },
                        )
                    )
            except Exception as e:
                logger.exception("[%s] Incident AI failed: %s", job_id, e)
                engine_statuses["incident"] = {"status": "failed", "error": str(e)}
            emit_status(ProcessingStatus.INCIDENT_ANALYSIS, 90.0, {"incident": engine_statuses["incident"]})
        else:
            engine_statuses["incident"] = {
                "status": "skipped",
                "reason": "disabled_by_config" if not getattr(self.settings, "INCIDENT_AI_ENABLED", True) else f"not_selected_in_{mode}",
            }
            emit_status(ProcessingStatus.PROCESSING, 88.0, {"incident": engine_statuses["incident"]})

        # ── Stage 5: Normalizing & Evidence Integration ───────────────────────
        if status_callback:
            status_callback(ProcessingStatus.NORMALIZING, 92.0)

        all_raw_events = road_events + safety_urban_events + incident_urban_events
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

        # Primary annotated video: incident if available, else road, else safety, else traffic
        primary_annotated_video = (
            annotated_paths.get("incident")
            or annotated_paths.get("road")
            or annotated_paths.get("safety")
            or annotated_paths.get("traffic")
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
