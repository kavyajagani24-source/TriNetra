"""
Model Registry — The Sixth Sense
Load-once model store. Models are loaded at startup and reused across all frames.
NEVER load a model inside the frame processing loop.
"""
from __future__ import annotations
import time
import logging
from typing import Optional, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)


# ── RDD2022 road-damage model download configuration ────────────────────── #
# Primary source: HuggingFace keremberke/yolov8-road-damage-detection
# Uses the Ultralytics YOLO interface so same .predict() API applies.
_ROAD_DAMAGE_HF_REPO = "rezzzq/yolo12s-road-damage-rdd2022"
_ROAD_DAMAGE_HF_MODEL = "yolo12s_RDD2022_best.pt"


class ModelRegistry:
    """
    Central model store.  All inference modules obtain their models from here.

    Usage:
        registry = ModelRegistry(profile_cfg, device)
        registry.load()
        # Then pass registry to detectors
    """

    def __init__(self, profile_cfg: Dict[str, Any], device: "torch.device") -> None:
        self.cfg = profile_cfg
        self.device = device
        self._general: Optional[Any] = None    # YOLO general detector
        self._road_damage: Optional[Any] = None
        self.load_times: Dict[str, float] = {}

    # ------------------------------------------------------------------ #
    # Loading
    # ------------------------------------------------------------------ #

    def load(self) -> None:
        """Load all models for the configured profile.  Call once at startup."""
        self._load_general_detector()
        self._load_road_damage_detector()

    def _load_general_detector(self) -> None:
        from ultralytics import YOLO
        model_name = self.cfg.get("general_detector", "yolo11x.pt")
        logger.info("Loading general detector: %s on %s …", model_name, self.device)
        t0 = time.perf_counter()
        model = YOLO(model_name)
        # Move to device; FP16 for GPU
        if str(self.device) != "cpu" and self.cfg.get("general_detector_fp16", True):
            model.model.half()
        self._general = model
        self._general.to(self.device)
        elapsed = time.perf_counter() - t0
        self.load_times["general_detector"] = round(elapsed, 3)
        logger.info("General detector loaded in %.2fs", elapsed)

    def _load_road_damage_detector(self) -> None:
        """
        Load road-damage model (RDD2022 pretrained).
        Priority:
          1. road_damage_local_weights path in profile
          2. HuggingFace download via huggingface_hub
          3. Graceful fallback: log warning, road-damage disabled
        """
        local_path = self.cfg.get("road_damage_local_weights")
        model_name = self.cfg.get("road_damage_detector", _ROAD_DAMAGE_HF_MODEL)

        weight_path = None
        if local_path and Path(local_path).exists():
            weight_path = local_path
            logger.info("Road damage model: using local weights at %s", local_path)
        else:
            weight_path = self._try_hf_download(model_name)

        if weight_path is None:
            logger.warning(
                "Road damage model could NOT be loaded (no local weights, HF download failed). "
                "Road-damage detection will be DISABLED for this run."
            )
            return

        try:
            from ultralytics import YOLO
            t0 = time.perf_counter()
            model = YOLO(weight_path)
            if str(self.device) != "cpu" and self.cfg.get("road_damage_fp16", True):
                model.model.half()
            self._road_damage = model
            self._road_damage.to(self.device)
            elapsed = time.perf_counter() - t0
            self.load_times["road_damage"] = round(elapsed, 3)
            logger.info("Road damage detector loaded in %.2fs", elapsed)
        except Exception as exc:
            logger.warning("Road damage model load failed: %s — disabled.", exc)
            self._road_damage = None

    @staticmethod
    def _try_hf_download(model_name: str) -> Optional[str]:
        """Attempt to download the road-damage model from HuggingFace."""
        try:
            from huggingface_hub import hf_hub_download
            logger.info("Downloading road damage model from HuggingFace: %s/%s …",
                        _ROAD_DAMAGE_HF_REPO, model_name)
            path = hf_hub_download(
                repo_id=_ROAD_DAMAGE_HF_REPO,
                filename=model_name,
            )
            logger.info("HuggingFace download complete: %s", path)
            return path
        except ImportError:
            logger.warning("huggingface_hub not installed — cannot auto-download road damage model.")
        except Exception as exc:
            logger.warning("HuggingFace download failed: %s", exc)
        return None

    # ------------------------------------------------------------------ #
    # Accessors
    # ------------------------------------------------------------------ #

    @property
    def general(self) -> Any:
        if self._general is None:
            raise RuntimeError("General detector not loaded. Call ModelRegistry.load() first.")
        return self._general

    @property
    def road_damage(self) -> Optional[Any]:
        """May be None if road-damage model failed to load — callers must handle this."""
        return self._road_damage

    @property
    def road_damage_available(self) -> bool:
        return self._road_damage is not None

    def model_names(self) -> list[str]:
        names = [self.cfg.get("general_detector", "unknown")]
        if self._road_damage is not None:
            names.append(self.cfg.get("road_damage_detector", "road-damage"))
        return names
