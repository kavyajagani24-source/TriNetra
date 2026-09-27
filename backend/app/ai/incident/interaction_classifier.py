"""
Pairwise Vehicle Interaction Classifier for Person 4 Incident AI.
SIH 2026 | PS 26125

Trained on 20-dimensional pairwise kinematic interaction feature vectors.
Classifies interaction windows into 3 classes:
  0: NORMAL
  1: NEAR_COLLISION (hard negative / near miss)
  2: COLLISION_CANDIDATE (true collision)

Provides both window-level and video-level aggregation.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union
import pickle
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

from app.ai.incident.pairwise import CLASS_MAP, ID_TO_CLASS, FEATURE_NAMES, PairwiseWindow


class InteractionClassifier:
    """
    Classifies vehicle interaction pairs using gradient boosted trees or random forests.
    """

    def __init__(
        self,
        model_type: str = "gradient_boosting",
        model_path: Optional[str] = None,
    ):
        self.model_type = model_type
        self.model_path = model_path
        self.scaler = StandardScaler()
        self.model = None
        self.is_fitted = False

        if model_type == "gradient_boosting":
            self.model = GradientBoostingClassifier(
                n_estimators=200,
                max_depth=3,
                learning_rate=0.05,
                subsample=0.8,
                random_state=42,
            )
        elif model_type == "random_forest":
            self.model = RandomForestClassifier(
                n_estimators=300,
                max_depth=5,
                class_weight="balanced",
                random_state=42,
            )
        elif model_type == "logistic_regression":
            self.model = LogisticRegression(
                C=0.1,
                class_weight="balanced",
                max_iter=1000,
                random_state=42,
            )
        else:
            raise ValueError(f"Unknown model_type: {model_type}")

        if model_path and os.path.exists(model_path):
            self.load(model_path)

    def fit(self, X: np.ndarray, y: np.ndarray):
        """Fit scaler and model on training feature matrix and labels."""
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)
        self.is_fitted = True
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """
        Returns probability distribution over [NORMAL, NEAR_COLLISION, COLLISION_CANDIDATE].
        Shape: (N, 3) or (N, n_classes).
        """
        if not self.is_fitted:
            # Fallback heuristic if not fitted
            probs = np.zeros((len(X), 3), dtype=float)
            probs[:, 0] = 1.0
            return probs

        X_scaled = self.scaler.transform(X)
        raw_probs = self.model.predict_proba(X_scaled)

        # Ensure 3-column shape even if some class was missing during training
        if raw_probs.shape[1] == 3:
            return raw_probs

        classes = getattr(self.model, "classes_", np.arange(raw_probs.shape[1]))
        full_probs = np.zeros((len(X), 3), dtype=float)
        for idx, cls_id in enumerate(classes):
            if cls_id < 3:
                full_probs[:, cls_id] = raw_probs[:, idx]
        return full_probs

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Returns predicted class indices [0, 1, or 2]."""
        probs = self.predict_proba(X)
        return np.argmax(probs, axis=1)

    def evaluate_video_windows(
        self,
        windows: List[PairwiseWindow],
        collision_thresh: float = 0.50,
        near_collision_thresh: float = 0.40,
    ) -> Dict[str, Union[float, bool, Optional[int], Optional[float], str]]:
        """
        Aggregates pairwise windows from a single video into video-level incident signals.
        """
        if not windows:
            return {
                "pairwise_collision_prob": 0.0,
                "pairwise_near_collision_prob": 0.0,
                "collision_candidate": False,
                "near_collision_flagged": False,
                "collision_class": "NORMAL",
                "best_pair": None,
                "peak_timestamp_sec": None,
                "involved_track_ids": [],
            }

        X = np.stack([w.features for w in windows], axis=0)
        probs = self.predict_proba(X)  # (N, 3)

        coll_probs = probs[:, 2]
        near_probs = probs[:, 1]

        best_coll_idx = int(np.argmax(coll_probs))
        max_coll_prob = float(coll_probs[best_coll_idx])

        best_near_idx = int(np.argmax(near_probs))
        max_near_prob = float(near_probs[best_near_idx])

        best_window = windows[best_coll_idx]

        is_coll = max_coll_prob >= collision_thresh
        is_near = (max_near_prob >= near_collision_thresh) and not is_coll

        if is_coll:
            verdict = "COLLISION_CANDIDATE"
        elif is_near:
            verdict = "NEAR_COLLISION"
        else:
            verdict = "NORMAL"

        return {
            "pairwise_collision_prob": round(max_coll_prob, 3),
            "pairwise_near_collision_prob": round(max_near_prob, 3),
            "collision_candidate": is_coll,
            "near_collision_flagged": is_near,
            "collision_class": verdict,
            "best_pair": (best_window.track_a, best_window.track_b),
            "peak_timestamp_sec": round(best_window.peak_ts, 2) if (is_coll or is_near) else None,
            "involved_track_ids": [best_window.track_a, best_window.track_b] if (is_coll or is_near) else [],
        }

    def save(self, filepath: str):
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "wb") as f:
            pickle.dump({
                "model_type": self.model_type,
                "model": self.model,
                "scaler": self.scaler,
                "is_fitted": self.is_fitted,
            }, f)

    def load(self, filepath: str):
        with open(filepath, "rb") as f:
            data = pickle.load(f)
        self.model_type = data["model_type"]
        self.model = data["model"]
        self.scaler = data["scaler"]
        self.is_fitted = data["is_fitted"]
        self.model_path = filepath
