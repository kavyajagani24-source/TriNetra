"""
Quality Gate — The Sixth Sense
Assess frame quality before trusting YOLO detections.
Poor frames reduce confidence rather than silently producing high-confidence events.
"""
from __future__ import annotations
import cv2
import numpy as np
import logging
from typing import Dict, Any

from sixth_sense.schemas.urban_event import QualityScore

logger = logging.getLogger(__name__)


class QualityGate:
    """
    Per-frame quality scorer.

    Computes:
      - Blur score (Laplacian variance of grayscale image)
      - Brightness (mean luminance)
      - Glare ratio (fraction of near-saturated pixels)

    Returns a QualityScore with conf_multiplier in [0.3, 1.0] applied
    to all detection confidences on that frame.  This ensures poor-quality
    frames never silently produce high-confidence events.
    """

    def __init__(
        self,
        min_blur_score: float = 80.0,
        min_brightness: float = 30.0,
        max_brightness: float = 230.0,
        max_glare_ratio: float = 0.15,
    ) -> None:
        self.min_blur_score = min_blur_score
        self.min_brightness = min_brightness
        self.max_brightness = max_brightness
        self.max_glare_ratio = max_glare_ratio

    def assess(self, frame: np.ndarray) -> QualityScore:
        """
        Assess a BGR frame and return a QualityScore.

        Args:
            frame: BGR image from OpenCV

        Returns:
            QualityScore with conf_multiplier and is_usable flag.
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Blur: Laplacian variance (sharp images have high variance)
        blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        # Brightness: mean luminance
        brightness = float(np.mean(gray))

        # Glare: fraction of pixels > 250
        glare_ratio = float(np.mean(gray > 250))

        # Compute per-factor penalties (each in [0, 1])
        blur_penalty = self._sigmoid_penalty(blur_score, self.min_blur_score, sharpness=0.05)
        dark_penalty = self._sigmoid_penalty(brightness, self.min_brightness, sharpness=0.2)
        bright_penalty = self._sigmoid_penalty(self.max_brightness, brightness, sharpness=0.2)
        glare_penalty = self._sigmoid_penalty(self.max_glare_ratio, glare_ratio, sharpness=30.0)

        # Combined multiplier: product of individual penalties, clipped to [0.3, 1.0]
        conf_multiplier = max(0.3, min(1.0, blur_penalty * dark_penalty * bright_penalty * glare_penalty))

        is_usable = (
            blur_score >= self.min_blur_score
            and self.min_brightness <= brightness <= self.max_brightness
            and glare_ratio <= self.max_glare_ratio
        )

        if not is_usable:
            reasons = []
            if blur_score < self.min_blur_score:
                reasons.append(f"blur={blur_score:.1f}<{self.min_blur_score}")
            if brightness < self.min_brightness:
                reasons.append(f"dark={brightness:.1f}")
            if brightness > self.max_brightness:
                reasons.append(f"bright={brightness:.1f}")
            if glare_ratio > self.max_glare_ratio:
                reasons.append(f"glare={glare_ratio:.3f}")
            logger.debug("Frame quality degraded: %s → conf_mult=%.2f", ", ".join(reasons), conf_multiplier)

        return QualityScore(
            blur_score=round(blur_score, 2),
            brightness=round(brightness, 2),
            glare_ratio=round(glare_ratio, 4),
            conf_multiplier=round(conf_multiplier, 4),
            is_usable=is_usable,
        )

    @staticmethod
    def _sigmoid_penalty(value: float, threshold: float, sharpness: float = 0.1) -> float:
        """
        Smooth penalty: 1.0 when value >> threshold, falls toward 0 as value << threshold.
        This avoids hard-cutoff artefacts at quality boundaries.
        """
        import math
        x = sharpness * (value - threshold)
        return 1.0 / (1.0 + math.exp(-x))
