"""
Rash and Abnormal Driving Kinematic Behavior Engine.
SIH 2026 | PS 26125 — Person 4 Incident AI

Analyzes spatio-temporal vehicle trajectories produced by tracking to detect:
1. Excessive speed proxy / rapid acceleration
2. Sudden hard braking / deceleration proxy
3. Erratic lane swerving / high heading change variance
4. High-frequency trajectory oscillation (zigzagging)
5. Jerk proxy (rate of change of acceleration)
6. Stop/go transition count

Outputs:
- NORMAL
- ABNORMAL_DRIVING_CANDIDATE
- REVIEW_REQUIRED

Zero fabrication: relies purely on measured geometric kinematics.
Every alert explicitly breaks down the contributing evidence signals.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
import numpy as np


@dataclass
class TrajectoryPoint:
    frame_idx: int
    timestamp: float
    bbox: Tuple[float, float, float, float]  # [x1, y1, x2, y2]
    centroid: Tuple[float, float]  # (cx, cy)
    width: float
    height: float


@dataclass
class KinematicProfile:
    track_id: int
    class_name: str
    total_frames: int
    duration_sec: float
    avg_speed_px_s: float
    max_speed_px_s: float
    max_accel_px_s2: float
    max_decel_px_s2: float
    heading_change_rate_deg_s: float
    lateral_swerve_px: float
    jerk_proxy_px_s3: float = 0.0
    stop_go_count: int = 0
    trajectory_curvature: float = 0.0
    behavior_label: str = "NORMAL"  # NORMAL, ABNORMAL_DRIVING_CANDIDATE, REVIEW_REQUIRED
    start_ts: float = 0.0
    end_ts: float = 0.0
    anomalies: List[str] = field(default_factory=list)
    evidence_breakdown: Dict[str, bool] = field(default_factory=dict)
    verdict_explanation: str = ""
    confidence: float = 0.0


class BehaviorEngine:
    """
    Trajectory-based kinematic analysis engine for rash and abnormal driving detection.

    Thresholds are calibrated to reject YOLO bounding-box jitter artifacts:
    - A 15px centroid jitter at 15 effective FPS gives ~225 px/s speed / ~3375 px/s² accel.
    - All hard thresholds are set well above this jitter band.
    - Multi-frame smoothing further suppresses single-frame noise.
    """

    def __init__(
        self,
        min_track_frames: int = 18,           # Need enough frames for stable kinematics
        speed_anomaly_factor: float = 2.5,     # Speed relative to stream median (raised from 2.2)
        hard_decel_threshold: float = 1400.0,  # px/s^2 — requires genuine heavy braking (was 850)
        hard_accel_threshold: float = 1400.0,  # px/s^2 — requires genuine flooring it (was 850)
        high_angular_rate_threshold: float = 110.0,  # deg/s — genuine swerving (was 70)
        swerve_displacement_threshold: float = 100.0,  # px — genuine lane change (was 70)
        jerk_threshold: float = 6000.0,        # px/s^3 — only severe jerk (was 4000)
    ):
        self.min_track_frames = min_track_frames
        self.speed_anomaly_factor = speed_anomaly_factor
        self.hard_decel_threshold = hard_decel_threshold
        self.hard_accel_threshold = hard_accel_threshold
        self.high_angular_rate_threshold = high_angular_rate_threshold
        self.swerve_displacement_threshold = swerve_displacement_threshold
        self.jerk_threshold = jerk_threshold

    def analyze_trajectory(
        self,
        track_id: int,
        class_name: str,
        points: List[TrajectoryPoint],
        median_stream_speed: Optional[float] = None,
    ) -> KinematicProfile:
        """
        Analyze a single vehicle track trajectory over time.
        """
        n_points = len(points)
        if n_points < self.min_track_frames:
            return KinematicProfile(
                track_id=track_id,
                class_name=class_name,
                total_frames=n_points,
                duration_sec=0.0,
                avg_speed_px_s=0.0,
                max_speed_px_s=0.0,
                max_accel_px_s2=0.0,
                max_decel_px_s2=0.0,
                heading_change_rate_deg_s=0.0,
                lateral_swerve_px=0.0,
                behavior_label="NORMAL",
                anomalies=[],
                verdict_explanation="Track duration too short for robust kinematic analysis",
                confidence=0.1,
            )

        # Non-motorized road users (pedestrians, cyclists) do not exhibit vehicle driving behaviors
        if class_name.lower() in ("person", "pedestrian", "bicycle", "cyclist"):
            total_sec = float(points[-1].timestamp - points[0].timestamp) if len(points) > 1 else 0.0
            return KinematicProfile(
                track_id=track_id,
                class_name=class_name,
                total_frames=n_points,
                duration_sec=total_sec,
                avg_speed_px_s=0.0,
                max_speed_px_s=0.0,
                max_accel_px_s2=0.0,
                max_decel_px_s2=0.0,
                heading_change_rate_deg_s=0.0,
                lateral_swerve_px=0.0,
                behavior_label="NORMAL",
                anomalies=[],
                verdict_explanation=f"Vulnerable road user ({class_name}) tracked with standard non-motorized kinematics",
                confidence=0.95,
            )

        sorted_pts = sorted(points, key=lambda p: p.frame_idx)
        times = [p.timestamp for p in sorted_pts]
        cx = np.array([p.centroid[0] for p in sorted_pts], dtype=float)
        cy = np.array([p.centroid[1] for p in sorted_pts], dtype=float)
        dt = np.diff(times)
        dt = np.where(dt <= 0.0, 1.0 / 30.0, dt)

        # Smooth centroid jitter using 5-tap weighted moving average (was 3-tap).
        # This suppresses YOLO bounding-box jitter that would otherwise create
        # fake acceleration spikes of ~3000+ px/s² from 10-15px bbox shifts.
        cx_eval = cx.copy()
        cy_eval = cy.copy()
        if len(cx) >= 7:
            k5 = np.array([0.1, 0.2, 0.4, 0.2, 0.1])
            cx_eval[2:-2] = np.convolve(cx, k5, mode='valid')
            cy_eval[2:-2] = np.convolve(cy, k5, mode='valid')
        elif len(cx) >= 5:
            k3 = np.array([0.25, 0.5, 0.25])
            cx_eval[1:-1] = np.convolve(cx, k3, mode='valid')
            cy_eval[1:-1] = np.convolve(cy, k3, mode='valid')

        # 1. Velocities
        dx = np.diff(cx_eval)
        dy = np.diff(cy_eval)
        disp = np.sqrt(dx**2 + dy**2)
        speeds = disp / dt  # px/sec

        # Jitter rejection: cap individual speed samples to 4× the track median.
        # YOLO bbox oscillation creates momentary 500-800 px/s spikes on stationary cars.
        if len(speeds) >= 5:
            speed_median = float(np.median(speeds))
            jitter_cap = max(300.0, speed_median * 4.0)
            speeds = np.clip(speeds, 0.0, jitter_cap)

        avg_speed = float(np.mean(speeds)) if len(speeds) > 0 else 0.0
        max_speed = float(np.max(speeds)) if len(speeds) > 0 else 0.0

        # 2. Accelerations & Decelerations
        max_jerk = 0.0
        if len(speeds) > 1:
            dv = np.diff(speeds)
            dt_acc = dt[1:]
            dt_acc = np.where(dt_acc <= 0.0, 1.0 / 30.0, dt_acc)
            accels = dv / dt_acc
            max_accel = float(np.max(accels)) if len(accels) > 0 else 0.0
            max_decel = float(np.abs(np.min(accels))) if len(accels) > 0 else 0.0

            # 2b. Jerk Proxy (da / dt)
            if len(accels) > 1:
                da = np.diff(accels)
                dt_jerk = dt_acc[1:]
                dt_jerk = np.where(dt_jerk <= 0.0, 1.0 / 30.0, dt_jerk)
                jerks = np.abs(da / dt_jerk)
                max_jerk = float(np.max(jerks)) if len(jerks) > 0 else 0.0
        else:
            max_accel = 0.0
            max_decel = 0.0

        # 3. Stop / Go Transitions
        stop_go_count = 0
        if len(speeds) > 2:
            is_stopped = speeds < 20.0
            transitions = np.diff(is_stopped.astype(int))
            stop_go_count = int(np.sum(transitions != 0)) // 2

        # 4. Heading angles & Angular velocity (swerving proxy)
        angles = np.arctan2(dy, dx)
        angle_diffs = np.abs(np.diff(angles))
        angle_diffs = np.where(angle_diffs > np.pi, 2 * np.pi - angle_diffs, angle_diffs)
        angle_diffs_deg = np.degrees(angle_diffs)
        if len(angle_diffs_deg) > 0:
            angular_rates = angle_diffs_deg / dt[1:]
            mean_angular_rate = float(np.mean(angular_rates))
        else:
            mean_angular_rate = 0.0

        # 5. Lateral swerving relative to best-fit linear trajectory
        if len(cx_eval) >= 5 and np.ptp(cx_eval) > 15.0:
            try:
                import warnings
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    coeffs = np.polyfit(cx_eval, cy_eval, deg=1)
                    a, b = coeffs[0], coeffs[1]
                    dist_to_line = np.abs(a * cx_eval - cy_eval + b) / np.sqrt(a**2 + 1)
                    max_lateral = float(np.max(dist_to_line))
            except Exception:
                max_lateral = 0.0
        else:
            max_lateral = 0.0

        # 6. Trajectory Curvature Proxy
        curvature_proxy = float(np.mean(angle_diffs_deg)) if len(angle_diffs_deg) > 0 else 0.0

        # Speed-gated anomaly detection.
        # Require both peak speed and non-trivial average speed so single-frame jitter doesn't trigger alerts
        is_moving_fast = (max_speed >= 180.0 and avg_speed >= 50.0)
        is_traveling = avg_speed >= 80.0

        evidence = {
            "sudden_hard_braking": bool(is_moving_fast and max_decel >= self.hard_decel_threshold),
            "rapid_acceleration": bool(is_moving_fast and max_accel >= self.hard_accel_threshold),
            "erratic_heading_swerve": bool(is_traveling and mean_angular_rate >= self.high_angular_rate_threshold),
            "high_lateral_drift": bool(is_traveling and max_lateral >= self.swerve_displacement_threshold),
            "jerk_spike": bool(is_moving_fast and max_jerk >= self.jerk_threshold),
            "excessive_speed_relative_to_flow": bool(
                median_stream_speed and avg_speed >= median_stream_speed * self.speed_anomaly_factor
                and avg_speed >= 150.0  # Additional absolute floor — don't flag if entire scene is slow
            ),
            "extreme_overspeeding": bool(max_speed >= 300.0 and avg_speed >= 180.0),
        }

        anomalies = []
        if evidence["sudden_hard_braking"]:
            anomalies.append("SUDDEN_HARD_BRAKING")
        if evidence["rapid_acceleration"]:
            anomalies.append("RAPID_ACCELERATION")
        if evidence["erratic_heading_swerve"]:
            anomalies.append("ERRATIC_HEADING_SWERVE")
        if evidence["high_lateral_drift"]:
            anomalies.append("HIGH_LATERAL_DRIFT")
        if evidence["jerk_spike"]:
            anomalies.append("JERK_SPIKE")
        if evidence["excessive_speed_relative_to_flow"]:
            anomalies.append("EXCESSIVE_SPEED_RELATIVE_TO_FLOW")
        if evidence["extreme_overspeeding"]:
            anomalies.append("EXTREME_OVERSPEEDING")

        # Determine label, confidence, and explanation.
        # Requires MULTIPLE corroborating anomalies or verified severe overspeeding for ABNORMAL_DRIVING_CANDIDATE.
        # Single anomaly alone is NOT enough (rejecting jitter/turns).
        has_swerving = (
            evidence["erratic_heading_swerve"]
            and evidence["high_lateral_drift"]
            and is_moving_fast
            and max_lateral >= self.swerve_displacement_threshold
        )
        has_excessive_speed = evidence["excessive_speed_relative_to_flow"] or evidence["extreme_overspeeding"]
        has_severe_maneuver = (
            (evidence["rapid_acceleration"] or evidence["sudden_hard_braking"])
            and (evidence["erratic_heading_swerve"] or evidence["high_lateral_drift"])
            and max_speed >= 200.0  # Require genuinely fast vehicle
        )
        has_extreme_anomalies = len(anomalies) >= 4 and max_speed >= 200.0

        is_rash = (has_excessive_speed or has_swerving or has_severe_maneuver or has_extreme_anomalies)

        if is_rash:
            behavior_label = "ABNORMAL_DRIVING_CANDIDATE"
            score = min(0.95, 0.70 + 0.06 * len(anomalies))
            verdict_exp = f"Rash driving candidate flagged due to: {', '.join(anomalies)}"
        elif len(anomalies) >= 2:
            # Only REVIEW_REQUIRED when 2+ anomalies corroborate — not a single jitter artifact
            behavior_label = "REVIEW_REQUIRED"
            score = 0.55
            verdict_exp = f"Multiple anomalies observed ({', '.join(anomalies)}); flagged for human review"
        else:
            behavior_label = "NORMAL"
            score = 0.90
            verdict_exp = "Normal trajectory kinematics; within standard traffic variance"

        t_start = float(times[0]) if len(times) > 0 else 0.0
        t_end = float(times[-1]) if len(times) > 0 else 0.0
        total_sec = float(times[-1] - times[0]) if len(times) > 1 else 0.0

        return KinematicProfile(
            track_id=track_id,
            class_name=class_name,
            total_frames=n_points,
            duration_sec=total_sec,
            avg_speed_px_s=round(avg_speed, 2),
            max_speed_px_s=round(max_speed, 2),
            max_accel_px_s2=round(max_accel, 2),
            max_decel_px_s2=round(max_decel, 2),
            heading_change_rate_deg_s=round(mean_angular_rate, 2),
            lateral_swerve_px=round(max_lateral, 2),
            jerk_proxy_px_s3=round(max_jerk, 2),
            stop_go_count=stop_go_count,
            trajectory_curvature=round(curvature_proxy, 2),
            behavior_label=behavior_label,
            start_ts=round(t_start, 2),
            end_ts=round(t_end, 2),
            anomalies=anomalies,
            evidence_breakdown=evidence,
            verdict_explanation=verdict_exp,
            confidence=round(score, 3),
        )

    def analyze_stream(
        self,
        tracks: Dict[int, List[TrajectoryPoint]],
        class_names: Optional[Dict[int, str]] = None,
    ) -> List[KinematicProfile]:
        """Analyze all tracks in a video stream."""
        if not tracks:
            return []

        all_speeds = []
        for tid, pts in tracks.items():
            if len(pts) >= 3:
                sorted_p = sorted(pts, key=lambda p: p.frame_idx)
                dx = np.diff([p.centroid[0] for p in sorted_p])
                dy = np.diff([p.centroid[1] for p in sorted_p])
                dt = np.diff([p.timestamp for p in sorted_p])
                dt = np.where(dt <= 0.0, 1.0 / 30.0, dt)
                speeds = np.sqrt(dx**2 + dy**2) / dt
                all_speeds.extend(speeds.tolist())

        median_flow_speed = float(np.median(all_speeds)) if all_speeds else None

        results = []
        for tid, pts in tracks.items():
            cname = (class_names or {}).get(tid, "vehicle")
            profile = self.analyze_trajectory(
                track_id=tid,
                class_name=cname,
                points=pts,
                median_stream_speed=median_flow_speed,
            )
            results.append(profile)

        return results


