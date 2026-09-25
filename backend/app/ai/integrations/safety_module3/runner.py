"""
TriNetra — SafetyModule3Runner

Authoritative runner for SIH2026 Module 3 — Pedestrian and VRU Safety Intelligence.
Executes Module 3's PipelineRunner (ByteTrack + Trajectory + Risk Engine)
using frozen checkpoint models/best.pt.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, List, Optional

from app.ai.integrations.safety_module3.config import (
    CameraSafetyProfile,
    _ensure_module3_on_path,
    _resolve_module3_root,
)
from app.core.config import get_settings

logger = logging.getLogger(__name__)


class SafetyModule3Runner:
    """
    Authoritative runner for Module 3 Pedestrian/VRU Safety AI.

    Calls SIH2026--Module3's PipelineRunner directly with camera-specific
    spatial calibrations.
    """

    def __init__(self, module3_root: Optional[str | Path] = None) -> None:
        self._root: Optional[Path] = Path(module3_root) if module3_root else None
        self._initialized = False

    def _init(self) -> None:
        """Lazy one-time setup — ensures Module 3 is on sys.path."""
        if self._initialized:
            return
        if self._root is None:
            self._root = _ensure_module3_on_path()
        else:
            import sys
            root_str = str(self._root.resolve())
            if root_str not in sys.path:
                sys.path.insert(0, root_str)
        self._initialized = True

    def analyze(
        self,
        video_path: str | Path,
        output_dir: str | Path,
        camera_profile: Optional[CameraSafetyProfile] = None,
        bus_id: Optional[str] = None,
        camera_id: Optional[str] = None,
        telemetry_path: Optional[str | Path] = None,
        save_video: bool = True,
    ) -> List[Any]:
        """
        Execute safety analysis on a video file.

        Args:
            video_path: Absolute or relative path to the input video.
            output_dir: Output directory for evidence frames and annotated video.
            camera_profile: Optional calibrated zone profile for this specific camera.
            bus_id: Optional identifier of the vehicle/bus.
            camera_id: Optional identifier of the camera viewpoint.
            telemetry_path: Optional path to JSON telemetry data.
            save_video: Whether to generate an annotated safety video.

        Returns:
            list[SafetyEvent]: List of authoritative SafetyEvent domain objects.
        """
        self._init()
        settings = get_settings()

        video_path_obj = Path(video_path).resolve()
        if not video_path_obj.exists():
            raise FileNotFoundError(f"Video file not found for Safety AI: {video_path_obj}")

        out_dir_obj = Path(output_dir).resolve()
        out_dir_obj.mkdir(parents=True, exist_ok=True)

        # Import Module 3 components dynamically
        try:
            from safety_ai.config.loader import load_configs
            from safety_ai.pipeline.runner import PipelineRunner
        except ImportError as e:
            logger.error("Failed to import safety_ai from SIH2026--Module3: %s", e)
            raise RuntimeError(
                f"Module 3 safety_ai could not be imported from {self._root}. "
                f"Ensure SIH2026--Module3 is installed and accessible."
            ) from e

        # Load base configs from Module 3 configs directory
        # load_configs() gracefully falls back to defaults on FileNotFoundError,
        # so we pass actual paths when they exist.
        configs_dir = settings.module3_configs_path
        detector_yaml = configs_dir / "detector.yaml"
        tracker_yaml = configs_dir / "tracker.yaml"
        safety_yaml = configs_dir / "safety.yaml"
        zones_yaml = configs_dir / "zones.yaml"

        load_kwargs: dict = {}
        if detector_yaml.exists():
            load_kwargs["detector_cfg"] = str(detector_yaml)
        if tracker_yaml.exists():
            load_kwargs["tracker_cfg"] = str(tracker_yaml)
        if safety_yaml.exists():
            load_kwargs["safety_cfg"] = str(safety_yaml)
        if zones_yaml.exists():
            load_kwargs["zones_cfg"] = str(zones_yaml)

        all_configs = load_configs(**load_kwargs)

        # Set authoritative model checkpoint
        best_pt = settings.module3_model_path_obj
        if best_pt.exists():
            all_configs.detector.model = str(best_pt)
            logger.info("Module 3 Safety AI using authoritative checkpoint: %s", best_pt)
        else:
            logger.warning(
                "Authoritative checkpoint %s not found; falling back to detector default %s",
                best_pt,
                all_configs.detector.model,
            )

        # Set device if configured
        device = settings.SAFETY_DEVICE if settings.SAFETY_DEVICE != "auto" else settings.AI_DEVICE
        if device != "auto":
            all_configs.detector.device = device

        # Apply camera-specific zones if profile provided
        if camera_profile and camera_profile.zones:
            logger.info(
                "Applying camera-specific safety profile for camera=%s (%d zones)",
                camera_profile.camera_id,
                len(camera_profile.zones),
            )
            all_configs.zones.zones = camera_profile.to_module3_zone_dicts()
        else:
            logger.info(
                "No specific camera safety profile provided for camera=%s; running with default zones",
                camera_id or "unknown",
            )

        # Run pipeline
        logger.info("Starting Module 3 Safety AI inference on %s", video_path_obj.name)
        runner = PipelineRunner(configs=all_configs, output_dir=out_dir_obj)

        events = runner.run(
            source=video_path_obj,
            save_video=save_video,
            telemetry_path=telemetry_path,
            bus_id=bus_id,
            camera_id=camera_id,
        )

        logger.info(
            "Module 3 Safety AI completed: %d safety events detected on %s",
            len(events),
            video_path_obj.name,
        )
        return events
