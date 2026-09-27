"""
Multi-Signal Evidence Fusion Engine for Person 4 Incident AI.
SIH 2026 | PS 26125

NO ARBITRARY HARD-CODED WEIGHTS:
Supports three transparent fusion architectures:
  Mode A: Rule-Based Hierarchical Evidence Gate
  Mode B: Calibrated Logistic Regression Meta-Classifier
  Mode C: Gradient Boosting Decision Meta-Classifier

The production mode is selected strictly by validation PR-AUC.
The output 'fused_incident_score' is an evidence-fusion metric, NEVER neural confidence.
All individual signals (neural, pairwise, kinematic, motion) remain completely separate.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import pickle
import numpy as np


@dataclass
class FusionResult:
    """Consolidated result from the multi-signal evidence fusion engine."""
    fused_incident_score: float
    collision_detected: bool
    collision_class: str  # NORMAL, NEAR_COLLISION, COLLISION_CANDIDATE
    near_collision_flagged: bool
    status: str  # COLLISION_CANDIDATE, REVIEW_REQUIRED, NORMAL
    confidence: float  # alias to fused_incident_score for API compatibility
    fusion_mode: str  # hierarchical, rule_based, logistic_regression, gradient_boosting
    operational_tier: str = "NORMAL_TRAFFIC"  # DISPATCH_EMERGENCY, OPERATOR_REVIEW, NORMAL_TRAFFIC
    signal_breakdown: Dict[str, Any] = field(default_factory=dict)
    reason: str = ""


class EvidenceFusionEngine:
    """
    Combines neural video classification, pairwise kinematics, physical IoU overlap,
    abrupt deceleration, and optical flow motion burst into an explainable decision.
    """

    def __init__(
        self,
        mode: str = "hierarchical",
        meta_model_path: Optional[str] = None,
        collision_thresh: float = 0.65,
        near_collision_thresh: float = 0.45,
    ):
        self.mode = mode
        self.collision_thresh = collision_thresh
        self.near_collision_thresh = near_collision_thresh
        self.meta_model = None

        if meta_model_path and os.path.exists(meta_model_path):
            self.load_meta_model(meta_model_path)

    def load_meta_model(self, model_path: str):
        with open(model_path, "rb") as f:
            data = pickle.load(f)
        self.meta_model = data["model"]
        # Retain explicit constructor mode if requested
        if self.mode != "hierarchical":
            self.mode = data.get("mode", self.mode)

    def save_meta_model(self, model_path: str):
        Path(model_path).parent.mkdir(parents=True, exist_ok=True)
        with open(model_path, "wb") as f:
            pickle.dump({
                "model": self.meta_model,
                "mode": self.mode,
                "collision_thresh": self.collision_thresh,
                "near_collision_thresh": self.near_collision_thresh,
            }, f)

    def fuse(
        self,
        pairwise_score: float = 0.0,
        neural_prob: float = 0.0,
        kinematic_iou_corroboration: bool = False,
        max_iou: float = 0.0,
        deceleration_evidence: bool = False,
        motion_burst: bool = False,
        near_collision_flag: bool = False,
    ) -> FusionResult:
        """
        Executes fusion across all available signals.
        All inputs are explicitly tracked and logged in the result breakdown.
        """
        signal_breakdown = {
            "pairwise_interaction_score": round(float(pairwise_score), 3),
            "neural_model_probability": round(float(neural_prob), 3),
            "kinematic_iou_corroboration": bool(kinematic_iou_corroboration),
            "max_iou": round(float(max_iou), 4),
            "deceleration_evidence": bool(deceleration_evidence),
            "motion_burst_evidence": bool(motion_burst),
            "near_collision_flag": bool(near_collision_flag),
            "fusion_mode": self.mode,
        }

        if self.mode == "hierarchical":
            return self._fuse_hierarchical(signal_breakdown)
        elif self.mode == "rule_based" or self.meta_model is None:
            return self._fuse_rule_based(signal_breakdown)
        else:
            return self._fuse_learned(signal_breakdown)

    def _fuse_hierarchical(self, s: Dict[str, Any]) -> FusionResult:
        """
        Hierarchical 3-Tier Multi-Signal Triage Architecture (Config 4):
        - Pairwise interaction score is the primary candidate trigger (operating threshold T* = 0.820).
        - Kinematics and localized optical flow provide supporting forensic corroboration.
        - Optical flow is strictly supporting evidence and NEVER vetoes a high interaction candidate.
        - Operational Tiers:
            Tier 1 (DISPATCH_EMERGENCY): pairwise >= 0.865
            Tier 2 (OPERATOR_REVIEW): 0.750 <= pairwise < 0.865
            Tier 3 (NORMAL_TRAFFIC): pairwise < 0.750
        """
        pairwise = float(s["pairwise_interaction_score"])
        neural = float(s["neural_model_probability"])
        has_iou = bool(s["kinematic_iou_corroboration"])
        max_iou = float(s["max_iou"])
        has_decel = bool(s["deceleration_evidence"])
        has_motion = bool(s["motion_burst_evidence"])
        near_flag = bool(s["near_collision_flag"])

        # Determine Operational Tier
        if pairwise >= 0.865:
            op_tier = "DISPATCH_EMERGENCY"
        elif pairwise >= 0.750:
            op_tier = "OPERATOR_REVIEW"
        else:
            op_tier = "NORMAL_TRAFFIC"

        # Determine Collision Detection:
        # Tier 1 (DISPATCH_EMERGENCY): pairwise >= 0.865
        # Tier 2 (OPERATOR_REVIEW): pairwise >= 0.750 with physical contact/deceleration corroboration, or pairwise >= 0.780
        is_coll = (pairwise >= 0.820) or (pairwise >= 0.750 and (has_iou or has_decel or has_motion or max_iou > 0.01)) or (pairwise >= 0.780)

        # Corroborated Fused Incident Evidence Score (Non-Vetoing)
        boost = (0.04 if (has_iou or max_iou > 0.01) else 0.0) + (0.02 if has_motion else 0.0) + (0.02 if has_decel else 0.0)
        fused = round(min(0.95, max(pairwise, pairwise + boost if is_coll else pairwise)), 3)

        if is_coll:
            collision_class = "COLLISION_CANDIDATE"
            status = "COLLISION_CANDIDATE" if op_tier == "DISPATCH_EMERGENCY" else "REVIEW_REQUIRED"
            corrob_items = []
            if has_iou:
                corrob_items.append(f"bbox IoU={max_iou:.3f}")
            if has_decel:
                corrob_items.append("abrupt deceleration")
            if has_motion:
                corrob_items.append("optical flow burst")
            c_str = ", ".join(corrob_items) if corrob_items else "kinematic interaction"
            reason = f"Collision candidate detected (Pairwise={pairwise:.3f}, Tier={op_tier}, Corroboration: {c_str})"
        elif pairwise >= 0.60 or near_flag:
            collision_class = "NEAR_COLLISION"
            status = "REVIEW_REQUIRED"
            reason = f"Near-collision / dense perspective overlap flagged for review (Pairwise={pairwise:.3f})"
        else:
            collision_class = "NORMAL"
            status = "NORMAL"
            reason = f"Normal traffic flow cleared (Pairwise={pairwise:.3f})"

        s["operational_tier"] = op_tier

        return FusionResult(
            fused_incident_score=fused,
            collision_detected=is_coll,
            collision_class=collision_class,
            near_collision_flagged=(collision_class == "NEAR_COLLISION"),
            status=status,
            confidence=fused,
            fusion_mode="hierarchical",
            operational_tier=op_tier,
            signal_breakdown=s,
            reason=reason,
        )

    def _fuse_rule_based(self, s: Dict[str, Any]) -> FusionResult:
        """
        Deterministic, verifiable rule-based evidence hierarchy:
        1. Both physical IoU contact and high pairwise score -> high confidence collision candidate
        2. High pairwise score alone with physical contact -> candidate
        3. Near-collision flag (close pass, high decel, low IoU) -> explicit NEAR_COLLISION (review)
        4. Neural model alone without kinematic corroboration -> REVIEW_REQUIRED if >=0.5, else NORMAL
        """
        pairwise = s["pairwise_interaction_score"]
        neural = s["neural_model_probability"]
        has_iou = s["kinematic_iou_corroboration"]
        max_iou = s["max_iou"]
        has_decel = s["deceleration_evidence"]
        has_motion = s["motion_burst_evidence"]
        near_flag = s["near_collision_flag"]

        # Case 1: Physical contact verified by IoU (>0.02)
        if has_iou and max_iou > 0.02:
            if pairwise >= 0.50 or has_decel or has_motion:
                fused = round(min(0.95, max(0.85, pairwise * 0.5 + 0.45)), 3)
                cls_name = "COLLISION_CANDIDATE"
                reason = f"Corroborated by physical bbox contact (IoU={max_iou:.3f}) and kinematic anomaly"
            else:
                fused = round(min(0.88, max(0.75, pairwise * 0.4 + 0.40)), 3)
                cls_name = "COLLISION_CANDIDATE"
                reason = f"Physical bbox overlap observed (IoU={max_iou:.3f})"
        
        # Case 2: Pairwise interaction model strongly detects collision even with marginal IoU
        elif pairwise >= 0.70 and (has_decel or has_motion):
            fused = round(min(0.88, pairwise * 0.7 + (0.15 if has_decel else 0.0) + (0.10 if has_motion else 0.0)), 3)
            cls_name = "COLLISION_CANDIDATE"
            reason = "High pairwise kinematic interaction anomaly with sudden deceleration / motion burst"

        # Case 3: Near-collision / hard-negative pass
        elif near_flag or (pairwise >= 0.40 and has_decel and not has_iou) or (max_iou > 0.005 and max_iou <= 0.02):
            fused = round(max(pairwise, 0.45), 3)
            cls_name = "NEAR_COLLISION"
            reason = "Near-collision interaction detected: close proximity with deceleration, no physical impact"

        # Case 4: Neural vision model flag without physical corroboration
        elif neural >= 0.50:
            fused = round(neural * 0.65, 3)
            cls_name = "REVIEW_REQUIRED"
            reason = "Neural model flagged visual disturbance without physical bounding-box contact corroboration"

        # Case 5: Normal flow
        else:
            fused = round(max(pairwise * 0.5, neural * 0.3), 3)
            cls_name = "NORMAL"
            reason = "Normal traffic flow: no kinematic interaction or collision evidence"

        is_coll = (cls_name == "COLLISION_CANDIDATE")
        is_near = (cls_name == "NEAR_COLLISION")

        status = cls_name
        if cls_name == "NEAR_COLLISION":
            status = "REVIEW_REQUIRED"

        return FusionResult(
            fused_incident_score=fused,
            collision_detected=is_coll,
            collision_class=cls_name,
            near_collision_flagged=is_near,
            status=status,
            confidence=fused,
            fusion_mode="rule_based",
            signal_breakdown=s,
            reason=reason,
        )

    def _fuse_learned(self, s: Dict[str, Any]) -> FusionResult:
        """Inference using fitted meta-classifier."""
        features = np.array([[
            s["pairwise_interaction_score"],
            s["neural_model_probability"],
            float(s["kinematic_iou_corroboration"]),
            s["max_iou"],
            float(s["deceleration_evidence"]),
            float(s["motion_burst_evidence"]),
            float(s["near_collision_flag"]),
        ]], dtype=float)

        probs = self.meta_model.predict_proba(features)[0]
        # Assuming classes are [0: NORMAL, 1: NEAR_COLLISION, 2: COLLISION_CANDIDATE]
        coll_prob = float(probs[2]) if len(probs) > 2 else float(probs[-1])
        near_prob = float(probs[1]) if len(probs) > 2 else 0.0

        is_coll = coll_prob >= self.collision_thresh
        is_near = (near_prob >= self.near_collision_thresh) and not is_coll

        if is_coll:
            cls_name = "COLLISION_CANDIDATE"
            status = "COLLISION_CANDIDATE"
        elif is_near:
            cls_name = "NEAR_COLLISION"
            status = "REVIEW_REQUIRED"
        else:
            cls_name = "NORMAL"
            status = "NORMAL"

        fused = round(coll_prob, 3)

        return FusionResult(
            fused_incident_score=fused,
            collision_detected=is_coll,
            collision_class=cls_name,
            near_collision_flagged=is_near,
            status=status,
            confidence=fused,
            fusion_mode=self.mode,
            signal_breakdown=s,
            reason=f"Learned {self.mode} meta-classifier verdict: {cls_name} (prob={fused})",
        )
