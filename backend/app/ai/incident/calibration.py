"""
Probability Calibration & Reliability Assessment for Person 4 Incident AI.
SIH 2026 | PS 26125

Evaluates:
- Expected Calibration Error (ECE)
- Brier Score
- Reliability Diagram binning
- Temperature Scaling for logit calibration (fitted ONLY on validation split)
"""

from __future__ import annotations

import math
from typing import Dict, List, Optional, Tuple
import numpy as np


class ProbabilityCalibrator:
    """
    Temperature scaling calibrator for neural network and fused probability outputs.
    """

    def __init__(self, temperature: float = 1.0):
        self.temperature = max(0.01, float(temperature))
        self.is_fitted = False
        self.sample_size_warning: Optional[str] = None

    def fit_temperature(self, probs: np.ndarray, targets: np.ndarray, lr: float = 0.05, max_iter: int = 150):
        """
        Fit temperature parameter T on held-out validation probabilities.
        Minimizes cross-entropy: -sum(y*log(p_T) + (1-y)*log(1-p_T)).
        """
        probs = np.clip(np.array(probs, dtype=float), 1e-6, 1.0 - 1e-6)
        targets = np.array(targets, dtype=float)
        n = len(probs)

        if n < 30:
            self.sample_size_warning = (
                f"Validation sample size (N={n}) is too small (<30) for statistically robust temperature scaling. "
                "Calibrated probabilities should be interpreted as regularized estimates."
            )

        # Convert probs to logits: z = log(p / (1 - p))
        logits = np.log(probs / (1.0 - probs))

        # Optimize T using gradient descent on scalar T
        T = 1.0
        for _ in range(max_iter):
            # Sigmoid(z / T)
            scaled_logits = logits / T
            # Guard against overflow
            scaled_logits = np.clip(scaled_logits, -30.0, 30.0)
            p_T = 1.0 / (1.0 + np.exp(-scaled_logits))
            
            # Loss gradient w.r.t. T: dL/dT = sum((p_T - y) * (-z / T^2))
            grad = np.sum((p_T - targets) * (-logits / (T * T))) / n
            T = max(0.1, T - lr * grad)

        self.temperature = float(T)
        self.is_fitted = True
        return self

    def calibrate(self, prob: float) -> float:
        """Calibrates a single probability using fitted temperature."""
        if not self.is_fitted or abs(self.temperature - 1.0) < 1e-4:
            return float(prob)
        p = np.clip(prob, 1e-6, 1.0 - 1e-6)
        logit = np.log(p / (1.0 - p))
        scaled = np.clip(logit / self.temperature, -30.0, 30.0)
        return float(1.0 / (1.0 + np.exp(-scaled)))

    def calibrate_array(self, probs: np.ndarray) -> np.ndarray:
        """Calibrates array of probabilities."""
        if not self.is_fitted or abs(self.temperature - 1.0) < 1e-4:
            return np.array(probs, dtype=float)
        p = np.clip(probs, 1e-6, 1.0 - 1e-6)
        logits = np.log(p / (1.0 - p))
        scaled = np.clip(logits / self.temperature, -30.0, 30.0)
        return 1.0 / (1.0 + np.exp(-scaled))


def compute_calibration_metrics(
    probs: np.ndarray,
    targets: np.ndarray,
    n_bins: int = 10,
) -> Dict[str, Union[float, List[dict], str]]:
    """
    Computes ECE, Brier Score, and reliability diagram bins.
    """
    probs = np.clip(np.array(probs, dtype=float), 0.0, 1.0)
    targets = np.array(targets, dtype=int)
    n = len(probs)
    if n == 0:
        return {"ece": 0.0, "brier_score": 0.0, "bins": []}

    # Brier Score: mean squared error
    brier = float(np.mean((probs - targets) ** 2))

    # Reliability diagram bins
    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    bins_data = []

    for b in range(n_bins):
        low, high = bin_edges[b], bin_edges[b + 1]
        mask = (probs >= low) & (probs <= high if b == n_bins - 1 else probs < high)
        count = int(np.sum(mask))
        if count > 0:
            avg_conf = float(np.mean(probs[mask]))
            avg_acc = float(np.mean(targets[mask]))
            weight = count / n
            ece += weight * abs(avg_acc - avg_conf)
            bins_data.append({
                "bin_idx": b,
                "range": [round(low, 2), round(high, 2)],
                "count": count,
                "avg_confidence": round(avg_conf, 3),
                "empirical_accuracy": round(avg_acc, 3),
            })
        else:
            bins_data.append({
                "bin_idx": b,
                "range": [round(low, 2), round(high, 2)],
                "count": 0,
                "avg_confidence": round((low + high) / 2.0, 3),
                "empirical_accuracy": 0.0,
            })

    return {
        "ece": round(float(ece), 4),
        "brier_score": round(brier, 4),
        "bins": bins_data,
        "sample_size": n,
        "is_reliable": n >= 30,
        "note": "Reliable sample size >= 30" if n >= 30 else f"Small sample size (N={n}); ECE is indicative only",
    }
