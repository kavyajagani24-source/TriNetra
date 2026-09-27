"""
Pairwise Vehicle Interaction Feature Extraction & Windowing.
SIH 2026 | PS 26125 — Person 4 Incident AI

Computes multi-dimensional kinematic interaction features between tracked vehicle pairs.
Instead of classifying entire videos from coarse global appearance, this isolates
candidate interaction temporal windows between pairs of vehicles.

Output classes:
  0 = NORMAL
  1 = NEAR_COLLISION  (hard-negative / close pass / sudden brake without contact)
  2 = COLLISION_CANDIDATE (physical impact / severe kinematic contact)
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
import numpy as np

# Class mapping
CLASS_MAP = {
    "NORMAL": 0,
    "NEAR_COLLISION": 1,
    "COLLISION_CANDIDATE": 2,
}
ID_TO_CLASS = {v: k for k, v in CLASS_MAP.items()}

FEATURE_NAMES = [
    "iou_peak",
    "iou_mean",
    "iou_delta_norm",
    "centroid_dist_min_norm",
    "centroid_dist_delta",
    "relative_velocity_px_s",
    "relative_accel_px_s2",
    "approach_phase_ratio",
    "overlap_duration_frames",
    "bbox_area_change_a",
    "bbox_area_change_b",
    "sudden_decel_a",
    "sudden_decel_b",
    "heading_divergence_deg",
    "post_contact_speed_a",
    "post_contact_speed_b",
    "stationary_ratio_a",
    "stationary_ratio_b",
    "time_to_iou_threshold",
    "class_pair_type",
]


@dataclass
class PairwiseWindow:
    """Represents an interaction temporal window between a pair of tracked vehicles."""
    video: str
    track_a: int
    track_b: int
    class_a: str
    class_b: str
    start_frame: int
    end_frame: int
    start_ts: float
    end_ts: float
    peak_ts: float
    peak_frame_idx: int
    peak_iou: float
    min_dist_norm: float
    features: np.ndarray  # shape (20,)
    label: str = "NORMAL"  # NORMAL, NEAR_COLLISION, COLLISION_CANDIDATE
    label_confidence: float = 1.0  # 1.0 for human annotated, 0.7 for weak prior


def _calc_iou(b1: Tuple[float, float, float, float], b2: Tuple[float, float, float, float]) -> float:
    ix1 = max(b1[0], b2[0])
    iy1 = max(b1[1], b2[1])
    ix2 = min(b1[2], b2[2])
    iy2 = min(b1[3], b2[3])
    iw = max(0.0, ix2 - ix1)
    ih = max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0.0:
        return 0.0
    a1 = (b1[2] - b1[0]) * (b1[3] - b1[1])
    a2 = (b2[2] - b2[0]) * (b2[3] - b2[1])
    denom = a1 + a2 - inter
    return inter / (denom + 1e-6) if denom > 0 else 0.0


def extract_pairwise_features(
    obs_a: List[dict],
    obs_b: List[dict],
    class_a: str = "car",
    class_b: str = "car",
    frame_width: int = 1920,
    frame_height: int = 1080,
) -> Optional[np.ndarray]:
    """
    Extracts a 20-dimensional normalized kinematic interaction feature vector
    from co-occurring observations of vehicle A and vehicle B.
    
    Each obs dict must have:
      - 'frame_idx': int
      - 'timestamp': float
      - 'bbox': (x1, y1, x2, y2)
      - 'centroid': (cx, cy)
      - 'speed': float (optional, px/s)
    """
    # Find overlapping frames
    frames_a = {o["frame_idx"]: o for o in obs_a}
    frames_b = {o["frame_idx"]: o for o in obs_b}
    common_f = sorted(set(frames_a.keys()) & set(frames_b.keys()))
    
    if len(common_f) < 3:
        return None

    times = []
    ious = []
    dists = []
    speeds_a = []
    speeds_b = []
    areas_a = []
    areas_b = []
    headings_a = []
    headings_b = []

    diag_frame = math.hypot(frame_width, frame_height) + 1e-5

    for f in common_f:
        oa = frames_a[f]
        ob = frames_b[f]
        ba = oa["bbox"]
        bb = ob["bbox"]
        ca = oa["centroid"]
        cb = ob["centroid"]
        t = oa["timestamp"]

        times.append(t)
        ious.append(_calc_iou(ba, bb))
        
        # Euclidean distance normalized by frame diagonal
        dist_px = math.hypot(ca[0] - cb[0], ca[1] - cb[1])
        dists.append(dist_px / diag_frame)

        # Areas
        area_a = max(1.0, (ba[2] - ba[0]) * (ba[3] - ba[1]))
        area_b = max(1.0, (bb[2] - bb[0]) * (bb[3] - bb[1]))
        areas_a.append(area_a)
        areas_b.append(area_b)

        speeds_a.append(oa.get("speed", 0.0))
        speeds_b.append(ob.get("speed", 0.0))

    times = np.array(times, dtype=float)
    ious = np.array(ious, dtype=float)
    dists = np.array(dists, dtype=float)
    speeds_a = np.array(speeds_a, dtype=float)
    speeds_b = np.array(speeds_b, dtype=float)
    areas_a = np.array(areas_a, dtype=float)
    areas_b = np.array(areas_b, dtype=float)

    dt = np.diff(times)
    dt = np.where(dt <= 0.0, 1.0 / 30.0, dt)

    # 1. iou_peak
    iou_peak = float(np.max(ious))

    # 2. iou_mean
    iou_mean = float(np.mean(ious))

    # 3. iou_delta_norm
    duration = max(0.1, times[-1] - times[0])
    iou_delta_norm = float((ious[-1] - ious[0]) / duration)

    # 4. centroid_dist_min_norm
    centroid_dist_min_norm = float(np.min(dists))

    # 5. centroid_dist_delta
    centroid_dist_delta = float((dists[-1] - dists[0]) / duration)

    # 6. relative_velocity_px_s
    rel_speed = np.abs(np.diff(dists * diag_frame)) / dt
    relative_velocity_px_s = float(np.mean(rel_speed)) if len(rel_speed) > 0 else 0.0

    # 7. relative_accel_px_s2
    if len(rel_speed) > 1:
        dt_acc = dt[1:]
        dt_acc = np.where(dt_acc <= 0.0, 1.0 / 30.0, dt_acc)
        rel_acc = np.diff(rel_speed) / dt_acc
        relative_accel_px_s2 = float(np.max(np.abs(rel_acc)))
    else:
        relative_accel_px_s2 = 0.0

    # 8. approach_phase_ratio (fraction of frames where distance was decreasing)
    if len(dists) > 1:
        d_diff = np.diff(dists)
        approach_phase_ratio = float(np.mean(d_diff < 0))
    else:
        approach_phase_ratio = 0.5

    # 9. overlap_duration_frames
    overlap_duration_frames = int(np.sum(ious > 0.02))

    # 10. bbox_area_change_a
    bbox_area_change_a = float(np.ptp(areas_a) / (np.mean(areas_a) + 1e-5))

    # 11. bbox_area_change_b
    bbox_area_change_b = float(np.ptp(areas_b) / (np.mean(areas_b) + 1e-5))

    # 12 & 13. sudden_decel_a & sudden_decel_b
    peak_idx = int(np.argmax(ious)) if iou_peak > 0.02 else int(np.argmin(dists))
    
    # Calculate decel in neighborhood of peak
    def _get_max_decel(spds: np.ndarray) -> float:
        if len(spds) > 1:
            dv = np.diff(spds)
            dt_s = dt
            acc = dv / dt_s
            decel = np.maximum(0.0, -acc)
            return float(np.max(decel)) if len(decel) > 0 else 0.0
        return 0.0

    sudden_decel_a = _get_max_decel(speeds_a)
    sudden_decel_b = _get_max_decel(speeds_b)

    # 14. heading_divergence_deg (relative directional change)
    heading_divergence_deg = 0.0
    if len(common_f) >= 3:
        pts_a = [frames_a[f]["centroid"] for f in common_f]
        pts_b = [frames_b[f]["centroid"] for f in common_f]
        dx_a = np.diff([p[0] for p in pts_a])
        dy_a = np.diff([p[1] for p in pts_a])
        dx_b = np.diff([p[0] for p in pts_b])
        dy_b = np.diff([p[1] for p in pts_b])
        ang_a = np.arctan2(dy_a, dx_a)
        ang_b = np.arctan2(dy_b, dx_b)
        ang_diff = np.abs(ang_a - ang_b)
        ang_diff = np.where(ang_diff > np.pi, 2 * np.pi - ang_diff, ang_diff)
        heading_divergence_deg = float(np.degrees(np.mean(ang_diff)))

    # 15 & 16. post_contact_speed_a & post_contact_speed_b
    post_spds_a = speeds_a[peak_idx:] if peak_idx < len(speeds_a) else np.array([0.0])
    post_spds_b = speeds_b[peak_idx:] if peak_idx < len(speeds_b) else np.array([0.0])
    post_contact_speed_a = float(np.mean(post_spds_a)) if len(post_spds_a) > 0 else 0.0
    post_contact_speed_b = float(np.mean(post_spds_b)) if len(post_spds_b) > 0 else 0.0

    # 17 & 18. stationary_ratio_a & stationary_ratio_b
    stationary_ratio_a = float(np.mean(post_spds_a < 15.0)) if len(post_spds_a) > 0 else 0.0
    stationary_ratio_b = float(np.mean(post_spds_b < 15.0)) if len(post_spds_b) > 0 else 0.0

    # 19. time_to_iou_threshold (in seconds from start of interaction window)
    over_thresh = np.where(ious > 0.02)[0]
    time_to_iou_threshold = float(times[over_thresh[0]] - times[0]) if len(over_thresh) > 0 else duration

    # 20. class_pair_type (0: car-car, 1: car-truck/bus, 2: car-motorcycle, 3: other)
    c_set = {class_a, class_b}
    if c_set == {"car"}:
        class_pair_type = 0.0
    elif "truck" in c_set or "bus" in c_set:
        class_pair_type = 1.0
    elif "motorcycle" in c_set:
        class_pair_type = 2.0
    else:
        class_pair_type = 3.0

    feats = np.array([
        iou_peak,
        iou_mean,
        iou_delta_norm,
        centroid_dist_min_norm,
        centroid_dist_delta,
        relative_velocity_px_s,
        relative_accel_px_s2,
        approach_phase_ratio,
        overlap_duration_frames,
        bbox_area_change_a,
        bbox_area_change_b,
        sudden_decel_a,
        sudden_decel_b,
        heading_divergence_deg,
        post_contact_speed_a,
        post_contact_speed_b,
        stationary_ratio_a,
        stationary_ratio_b,
        time_to_iou_threshold,
        class_pair_type,
    ], dtype=np.float32)

    return feats
