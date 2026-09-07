"""
UrbanEye AI — Frame Processor

Coordinates detection, tracking, trajectory updates, and telemetry analytics
for a single video frame.
"""

from __future__ import annotations

from typing import List, Optional

import numpy as np

from app.ai.analytics.congestion_detector import CongestionDetector
from app.ai.analytics.traffic_density import TrafficDensityAnalyzer
from app.ai.analytics.vehicle_counter import VehicleCounter
from app.ai.behavior.rash_driving_detector import RashDrivingDetector
from app.ai.hazards.road_hazard_detector import RoadHazardDetector
from app.ai.infrastructure.infrastructure_analyser import InfrastructureAnalyser
from app.ai.models.detection_types import (
    Detection,
    FrameResult,
    TrackedDetection,
)
from app.ai.models.event_types import UrbanEventData
from app.ai.safety.pedestrian_risk_analyser import PedestrianRiskAnalyser
from app.ai.tracker.byte_tracker import ByteTrackerWrapper
from app.ai.tracker.trajectory_manager import TrajectoryManager


class FrameProcessor:
    """
    Stateful processor combining vision models and analytics engines on frame-by-frame basis.
    """

    def __init__(
        self,
        detector: YOLODetector,
        tracker: ByteTrackerWrapper,
        trajectory_manager: TrajectoryManager,
        vehicle_counter: VehicleCounter,
        density_analyzer: TrafficDensityAnalyzer,
        congestion_detector: CongestionDetector,
        enable_tracking: bool = True,
        hazard_detector: Optional[RoadHazardDetector] = None,
        infra_analyser: Optional[InfrastructureAnalyser] = None,
        safety_analyser: Optional[PedestrianRiskAnalyser] = None,
        behavior_detector: Optional[RashDrivingDetector] = None,
    ):
        self.detector = detector
        self.tracker = tracker
        self.trajectory_manager = trajectory_manager
        self.vehicle_counter = vehicle_counter
        self.density_analyzer = density_analyzer
        self.congestion_detector = congestion_detector
        self.enable_tracking = enable_tracking
        self.hazard_detector = hazard_detector
        self.infra_analyser = infra_analyser
        self.safety_analyser = safety_analyser
        self.behavior_detector = behavior_detector

    def process_frame(
        self,
        frame: np.ndarray,
        frame_number: int,
        timestamp: float,
    ) -> FrameResult:
        """
        Execute the full frame analysis pipeline:
        1. YOLO Detection & Tracking
        2. Trajectory updates
        3. Vehicle count updates
        4. Traffic density assessment
        5. Fleet speed & Congestion assessment
        """
        detections: List[Detection] = []
        tracked_detections: List[TrackedDetection] = []

        if self.enable_tracking:
            tracked = self.detector.detect_and_track(frame, persist=True)
            tracked_detections = self.tracker.update(tracked, frame_number, timestamp)
            # Map tracked detections to raw detections representation as well
            detections = [
                Detection(
                    bbox=td.bbox,
                    class_id=td.class_id,
                    class_name=td.class_name,
                    confidence=td.confidence,
                )
                for td in tracked_detections
            ]
        else:
            detections = self.detector.detect(frame)

        # Update trajectories for tracked entities
        active_track_ids = set()
        for td in tracked_detections:
            if td.track_id >= 0:
                active_track_ids.add(td.track_id)
                self.trajectory_manager.add_point(
                    track_id=td.track_id,
                    x=td.bbox.center_x,
                    y=td.bbox.center_y,
                    frame_number=frame_number,
                    timestamp=timestamp,
                )

        # Update vehicle counting
        frame_counts = self.vehicle_counter.update(tracked_detections)
        active_vehicle_count = sum(
            frame_counts.get(cls, 0)
            for cls in ("car", "motorcycle", "bus", "truck")
        )

        # Analyze density
        density_level = self.density_analyzer.analyze(active_vehicle_count)

        # Analyze speed and congestion
        avg_speed = self.trajectory_manager.calculate_current_fleet_average_speed(active_track_ids)
        congestion_level = self.congestion_detector.analyze(active_vehicle_count, avg_speed)

        frame_result = FrameResult(
            frame_number=frame_number,
            timestamp=timestamp,
            detections=detections,
            tracked_detections=tracked_detections,
            active_vehicle_count=active_vehicle_count,
            vehicle_counts_by_class=frame_counts,
            density_level=density_level,
            congestion_level=congestion_level,
            avg_pixel_speed=avg_speed,
        )

        # ── Phase 3: Road Hazards, Infrastructure, Safety & Behavior ───────
        detected_events: List[UrbanEventData] = []
        h, w = frame.shape[:2]

        if self.hazard_detector:
            detected_events.extend(
                self.hazard_detector.analyse(
                    frame=frame,
                    frame_result=frame_result,
                    frame_number=frame_number,
                    timestamp=timestamp,
                    video_width=w,
                    video_height=h,
                )
            )

        if self.infra_analyser:
            detected_events.extend(
                self.infra_analyser.analyse(
                    frame=frame,
                    frame_result=frame_result,
                    frame_number=frame_number,
                    timestamp=timestamp,
                )
            )

        if self.safety_analyser:
            detected_events.extend(
                self.safety_analyser.analyse(
                    frame_result=frame_result,
                    frame_number=frame_number,
                    timestamp=timestamp,
                    frame_height=h,
                    frame_width=w,
                )
            )

        if self.behavior_detector:
            detected_events.extend(
                self.behavior_detector.analyse(
                    frame_result=frame_result,
                    trajectory_manager=self.trajectory_manager,
                    frame_number=frame_number,
                    timestamp=timestamp,
                )
            )

        frame_result.events = detected_events
        return frame_result
