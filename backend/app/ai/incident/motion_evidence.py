"""
Lightweight Optical Flow Motion Burst Corroboration.
SIH 2026 | PS 26125 — Person 4 Incident AI

Computes Farneback dense optical flow LOCALLY around the candidate interaction
region (not whole frame) across the candidate temporal window.

Detects sudden anomalous motion vectors, shattering/crumple velocity bursts,
or camera-vehicle divergence characteristic of physical collisions.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple
import cv2
import numpy as np


@dataclass
class MotionEvidence:
    """Motion burst corroboration result from localized optical flow."""
    flow_computed: bool = False
    mean_flow_magnitude: float = 0.0
    peak_flow_magnitude: float = 0.0
    baseline_flow_magnitude: float = 0.0
    flow_burst_ratio: float = 0.0
    is_motion_burst: bool = False
    peak_motion_ts: Optional[float] = None
    reason: str = "No candidate window analyzed"


class MotionCorroborator:
    """
    Lightweight, localized optical flow analyzer for interaction candidate windows.
    """

    def __init__(
        self,
        pyr_scale: float = 0.5,
        levels: int = 2,
        winsize: int = 15,
        iterations: int = 2,
        poly_n: int = 5,
        poly_sigma: float = 1.1,
        burst_threshold_ratio: float = 2.0,
    ):
        self.pyr_scale = pyr_scale
        self.levels = levels
        self.winsize = winsize
        self.iterations = iterations
        self.poly_n = poly_n
        self.poly_sigma = poly_sigma
        self.burst_threshold_ratio = burst_threshold_ratio

    def analyze_crop_window(
        self,
        frames: List[Tuple[float, np.ndarray]],  # list of (timestamp, frame_bgr)
        roi_bbox: Tuple[int, int, int, int],    # (x1, y1, x2, y2) union of vehicle pair
        impact_ts: Optional[float] = None,
    ) -> MotionEvidence:
        """
        Analyzes motion vectors in the ROI crop across a series of frames.
        Frames should be cropped to ROI and downscaled to keep computation < 0.2s.
        """
        if len(frames) < 3:
            return MotionEvidence(reason="Insufficient frames in candidate window")

        x1, y1, x2, y2 = roi_bbox
        # Pad ROI slightly (15%) for surrounding motion
        pad_x = int((x2 - x1) * 0.15)
        pad_y = int((y2 - y1) * 0.15)

        h_full, w_full = frames[0][1].shape[:2]
        rx1 = max(0, x1 - pad_x)
        ry1 = max(0, y1 - pad_y)
        rx2 = min(w_full, x2 + pad_x)
        ry2 = min(h_full, y2 + pad_y)

        if rx2 - rx1 < 20 or ry2 - ry1 < 20:
            return MotionEvidence(reason="ROI too small for optical flow")

        # Downscale crop to standard max dimension (e.g. 160px width)
        crop_w = rx2 - rx1
        crop_h = ry2 - ry1
        target_w = min(160, crop_w)
        scale = target_w / float(crop_w)
        target_h = max(10, int(crop_h * scale))

        gray_crops = []
        timestamps = []
        for ts, frm in frames:
            crop = frm[ry1:ry2, rx1:rx2]
            if crop.size == 0:
                continue
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            if scale != 1.0:
                gray = cv2.resize(gray, (target_w, target_h), interpolation=cv2.INTER_LINEAR)
            gray_crops.append(gray)
            timestamps.append(ts)

        if len(gray_crops) < 2:
            return MotionEvidence(reason="Failed to extract crops")

        flow_magnitudes = []
        for i in range(len(gray_crops) - 1):
            prev = gray_crops[i]
            curr = gray_crops[i + 1]
            flow = cv2.calcOpticalFlowFarneback(
                prev, curr, None,
                self.pyr_scale, self.levels, self.winsize,
                self.iterations, self.poly_n, self.poly_sigma, 0
            )
            mag, _ = cv2.cartToPolar(flow[..., 0], flow[..., 1])
            flow_magnitudes.append(float(np.mean(mag)))

        flow_mags = np.array(flow_magnitudes, dtype=float)
        mean_flow = float(np.mean(flow_mags))
        peak_flow = float(np.max(flow_mags))
        peak_idx = int(np.argmax(flow_mags))
        peak_ts = timestamps[peak_idx]

        # Baseline flow (median of first half or non-peak frames)
        baseline = float(np.median(flow_mags)) + 1e-4
        burst_ratio = peak_flow / baseline

        is_burst = burst_ratio >= self.burst_threshold_ratio and peak_flow > 1.5

        reason = (
            f"Motion burst detected (ratio {burst_ratio:.1f}x > {self.burst_threshold_ratio}x, peak={peak_flow:.2f})"
            if is_burst
            else f"Normal motion flow (ratio {burst_ratio:.1f}x, peak={peak_flow:.2f})"
        )

        return MotionEvidence(
            flow_computed=True,
            mean_flow_magnitude=round(mean_flow, 3),
            peak_flow_magnitude=round(peak_flow, 3),
            baseline_flow_magnitude=round(baseline, 3),
            flow_burst_ratio=round(burst_ratio, 2),
            is_motion_burst=is_burst,
            peak_motion_ts=round(peak_ts, 2),
            reason=reason,
        )
