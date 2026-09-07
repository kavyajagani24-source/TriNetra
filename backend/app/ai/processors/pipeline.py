"""
UrbanEye AI — End-to-End AI Processing Pipeline

Orchestrates full video processing: decoding, YOLO detection, ByteTrack tracking,
trajectory smoothing, traffic counting, density/congestion analytics, and annotated video generation.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Callable, List, Optional

import cv2

from app.ai.analytics.congestion_detector import CongestionDetector
from app.ai.analytics.traffic_density import TrafficDensityAnalyzer
from app.ai.analytics.vehicle_counter import VehicleCounter
from app.ai.behavior.rash_driving_detector import RashDrivingDetector
from app.ai.detector.yolo_detector import YOLODetector
from app.ai.events.event_engine import EventEngine
from app.ai.hazards.road_hazard_detector import RoadHazardDetector
from app.ai.infrastructure.infrastructure_analyser import InfrastructureAnalyser
from app.ai.models.detection_types import (
    CongestionLevel,
    DensityLevel,
    FrameResult,
    PipelineResult,
)
from app.ai.processors.frame_processor import FrameProcessor
from app.ai.processors.video_processor import VideoProcessor
from app.ai.safety.pedestrian_risk_analyser import PedestrianRiskAnalyser
from app.ai.tracker.byte_tracker import ByteTrackerWrapper
from app.ai.tracker.trajectory_manager import TrajectoryManager
from app.ai.visualization.video_annotator import VideoAnnotator
from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class UrbanAIPipeline:
    """
    End-to-end computer vision pipeline for processing urban traffic videos.
    """

    def __init__(self, settings: Optional[Settings] = None, detector: Optional[YOLODetector] = None):
        self.settings = settings or get_settings()

        # Detector: can be injected (e.g. for testing) or instantiated
        self.detector = detector or YOLODetector(
            model_name=self.settings.YOLO_MODEL,
            confidence_threshold=self.settings.YOLO_CONFIDENCE_THRESHOLD,
            iou_threshold=self.settings.YOLO_IOU_THRESHOLD,
            device=self.settings.YOLO_DEVICE,
            tracker_type=self.settings.TRACKER_TYPE,
        )

        self.tracker = ByteTrackerWrapper()
        self.trajectory_manager = TrajectoryManager(
            max_points=self.settings.MAX_TRAJECTORY_POINTS
        )
        self.vehicle_counter = VehicleCounter()
        self.density_analyzer = TrafficDensityAnalyzer(
            low_threshold=self.settings.TRAFFIC_LOW_THRESHOLD,
            medium_threshold=self.settings.TRAFFIC_MEDIUM_THRESHOLD,
            high_threshold=self.settings.TRAFFIC_HIGH_THRESHOLD,
        )
        self.congestion_detector = CongestionDetector(
            vehicle_threshold=self.settings.CONGESTION_VEHICLE_THRESHOLD,
            speed_threshold=self.settings.CONGESTION_SPEED_THRESHOLD,
        )
        self.annotator = VideoAnnotator(
            draw_trajectories=self.settings.DRAW_TRAJECTORIES
        )

        # ── Phase 3: Road Hazards, Infrastructure, Safety & Behavior ───────
        self.hazard_detector = (
            RoadHazardDetector(enabled=self.settings.ENABLE_HAZARD_DETECTION)
            if self.settings.ENABLE_HAZARD_DETECTION
            else None
        )
        self.infra_analyser = (
            InfrastructureAnalyser(enabled=self.settings.ENABLE_INFRASTRUCTURE_ANALYSIS)
            if self.settings.ENABLE_INFRASTRUCTURE_ANALYSIS
            else None
        )
        self.safety_analyser = (
            PedestrianRiskAnalyser(
                enabled=self.settings.ENABLE_SAFETY_ANALYSIS,
                near_miss_distance_px=self.settings.NEAR_MISS_DISTANCE_PX,
            )
            if self.settings.ENABLE_SAFETY_ANALYSIS
            else None
        )
        self.behavior_detector = (
            RashDrivingDetector(
                enabled=self.settings.ENABLE_BEHAVIOR_ANALYSIS,
                swerve_angle_threshold_deg=self.settings.RASH_DRIVING_ANGLE_DEG,
            )
            if self.settings.ENABLE_BEHAVIOR_ANALYSIS
            else None
        )
        self.event_engine = EventEngine(
            dedup_frame_window=self.settings.EVENT_DEDUP_FRAME_WINDOW
        )

        self.frame_processor = FrameProcessor(
            detector=self.detector,
            tracker=self.tracker,
            trajectory_manager=self.trajectory_manager,
            vehicle_counter=self.vehicle_counter,
            density_analyzer=self.density_analyzer,
            congestion_detector=self.congestion_detector,
            enable_tracking=self.settings.ENABLE_TRACKING,
            hazard_detector=self.hazard_detector,
            infra_analyser=self.infra_analyser,
            safety_analyser=self.safety_analyser,
            behavior_detector=self.behavior_detector,
        )

    def run(
        self,
        video_path: str,
        video_id: str,
        job_id: str,
        output_dir: Optional[str] = None,
        evidence_dir: Optional[str] = None,
        progress_callback: Optional[Callable[[int, int, float, int], None]] = None,
    ) -> PipelineResult:
        """
        Execute full pipeline on the specified video.
        """
        out_dir = Path(output_dir or self.settings.PROCESSED_PATH)
        out_dir.mkdir(parents=True, exist_ok=True)

        ev_dir = Path(evidence_dir or self.settings.EVIDENCE_PATH)
        ev_dir.mkdir(parents=True, exist_ok=True)

        annotated_video_path = str(out_dir / f"annotated_{Path(video_path).stem}.mp4")
        evidence_paths: List[str] = []
        frame_results: List[FrameResult] = []

        total_detections_count = 0
        peak_density = DensityLevel.LOW
        density_rank = {
            DensityLevel.LOW: 0,
            DensityLevel.MEDIUM: 1,
            DensityLevel.HIGH: 2,
            DensityLevel.SEVERE: 3,
        }
        congestion_rank = {
            CongestionLevel.LOW: 0,
            CongestionLevel.MODERATE: 1,
            CongestionLevel.HIGH: 2,
            CongestionLevel.SEVERE: 3,
        }
        congestion_scores: List[int] = []

        with VideoProcessor(video_path) as reader:
            fps = reader.fps
            width = reader.width
            height = reader.height
            total_frames = reader.total_frames
            duration = reader.duration_seconds

            writer = None
            if self.settings.SAVE_ANNOTATED_VIDEO and width > 0 and height > 0:
                writer = self.annotator.create_video_writer(
                    output_path=annotated_video_path,
                    fps=fps,
                    width=width,
                    height=height,
                )

            try:
                processed_count = 0
                for frame_num, timestamp, frame in reader.read_frames(
                    step_n=self.settings.PROCESS_EVERY_N_FRAMES
                ):
                    processed_count += 1

                    frame_res = self.frame_processor.process_frame(
                        frame=frame,
                        frame_number=frame_num,
                        timestamp=timestamp,
                    )
                    frame_results.append(frame_res)
                    total_detections_count += len(frame_res.tracked_detections)

                    # Submit Phase 3 frame events to event engine
                    emitted_events = []
                    if hasattr(frame_res, "events") and frame_res.events:
                        emitted_events = self.event_engine.submit_all(frame_res.events)

                    # Update peak density & congestion tracking
                    if density_rank[frame_res.density_level] > density_rank[peak_density]:
                        peak_density = frame_res.density_level
                    congestion_scores.append(congestion_rank[frame_res.congestion_level])

                    # Annotate frame
                    annotated_frame = self.annotator.annotate_frame(
                        frame=frame,
                        tracked_detections=frame_res.tracked_detections,
                        urban_events=emitted_events,
                        trajectories=self.trajectory_manager.get_all_active_trajectories(),
                        frame_number=frame_num,
                        timestamp=timestamp,
                        active_vehicle_count=frame_res.active_vehicle_count,
                        density_level=frame_res.density_level,
                        congestion_level=frame_res.congestion_level,
                    )

                    if writer is not None:
                        writer.write(annotated_frame)

                    # Save evidence screenshot periodically or on emitted hazard/incident events
                    should_save_evidence = (
                        self.settings.SAVE_DETECTION_EVIDENCE
                        and (
                            (frame_res.active_vehicle_count > 0 and frame_num % self.settings.EVIDENCE_SAVE_INTERVAL == 0)
                            or bool(emitted_events)
                        )
                    )
                    if should_save_evidence:
                        evidence_file = ev_dir / f"ev_{job_id}_frame_{frame_num}.jpg"
                        cv2.imwrite(str(evidence_file), annotated_frame)
                        evidence_paths.append(str(evidence_file))
                        evidence_url = f"evidence/{evidence_file.name}"
                        for event in emitted_events:
                            event.extra_metadata["evidence_path"] = evidence_url

                    # Invoke progress callback
                    if progress_callback is not None:
                        # Report progress based on total frames
                        pct = (
                            min(100.0, (frame_num / total_frames) * 100.0)
                            if total_frames > 0
                            else 100.0
                        )
                        progress_callback(
                            frame_num,
                            total_frames,
                            pct,
                            self.vehicle_counter.total_unique_vehicles + self.event_engine.total_emitted,
                        )

            finally:
                if writer is not None:
                    writer.release()

        # Compute average congestion level
        avg_score = (
            sum(congestion_scores) / len(congestion_scores) if congestion_scores else 0.0
        )
        if avg_score >= 2.5:
            avg_congestion = CongestionLevel.SEVERE
        elif avg_score >= 1.5:
            avg_congestion = CongestionLevel.HIGH
        elif avg_score >= 0.5:
            avg_congestion = CongestionLevel.MODERATE
        else:
            avg_congestion = CongestionLevel.LOW

        return PipelineResult(
            video_id=video_id,
            job_id=job_id,
            total_frames=total_frames,
            frames_processed=processed_count,
            fps=fps,
            duration_seconds=duration,
            total_unique_vehicles=self.vehicle_counter.total_unique_vehicles,
            counts_by_class=self.vehicle_counter.get_cumulative_counts(),
            total_detections_recorded=total_detections_count,
            peak_density=peak_density,
            avg_congestion_level=avg_congestion,
            annotated_video_path=annotated_video_path if self.settings.SAVE_ANNOTATED_VIDEO else None,
            evidence_image_paths=evidence_paths,
            frame_results=frame_results,
            active_tracks_summary=self.tracker.get_track_summary(),
            urban_events=self.event_engine.get_all_events(),
        )
