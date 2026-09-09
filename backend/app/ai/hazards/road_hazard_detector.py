"""
UrbanEye AI — Road Hazard Detector  (Sixth Sense Engine Adapter)

This module is a bridge layer.  ALL detection logic lives untouched inside
app/ai/sixth_sense/sixth_sense/perception/road_damage_detector.py
(the Sixth Sense RDD2022 engine).

This class:
  1. Loads the Sixth Sense ModelRegistry (which loads yolo12s_RDD2022_best.pt).
  2. Instantiates the Sixth Sense QualityGate and RoadDamageDetector EXACTLY as
     the Sixth Sense main loop does.
  3. Per frame — runs QualityGate → RoadDamageDetector → ObservationBuilder.
  4. At the end of a video converts Sixth Sense Observations → UrbanEye UrbanEventData.

The Sixth Sense source files are NOT modified.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import torch

# ── Make the Sixth Sense package importable ───────────────────────────────────
_SIXTH_SENSE_ROOT = Path(__file__).resolve().parent.parent / "sixth_sense"
if str(_SIXTH_SENSE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SIXTH_SENSE_ROOT))

# ── Sixth Sense imports (unmodified originals) ────────────────────────────────
from sixth_sense.core.gpu_context import verify_cuda
from sixth_sense.core.quality_gate import QualityGate
from sixth_sense.perception.road_damage_detector import RoadDamageDetector
from sixth_sense.events.observation_builder import ObservationBuilder
from sixth_sense.events.severity_scorer import SeverityScorer
from sixth_sense.schemas.urban_event import (
    SeverityTier,
    EventType as SSEventType,
)

# ── UrbanEye internal types ───────────────────────────────────────────────────
from app.ai.models.detection_types import FrameResult
from app.ai.models.event_types import (
    EventCategory,
    EventSeverity,
    EventType,
    UrbanEventData,
)

logger = logging.getLogger(__name__)

# ── Local weights path (relative to backend root) ────────────────────────────
_MODEL_WEIGHTS = Path(__file__).resolve().parent.parent.parent.parent / "yolo12s_RDD2022_best.pt"

# ── Default Sixth Sense profile (from profiles.yaml road_damage_sensitive) ───
_DEFAULT_PROFILE: Dict[str, Any] = {
    "road_damage_detector": "yolo12s_RDD2022_best.pt",
    "road_damage_local_weights": str(_MODEL_WEIGHTS),
    "road_damage_imgsz": 640,
    "road_damage_fp16": True,
    "conf_thresholds": {
        "D00": 0.22, "D10": 0.22, "D20": 0.22, "D40": 0.22,
        "pothole": 0.22, "crack": 0.20, "road_damage": 0.22,
    },
    "quality": {
        "min_blur_score": 60.0,
        "min_brightness": 20.0,
        "max_brightness": 235.0,
        "max_glare_ratio": 0.20,
    },
    "observation": {
        "max_gap_frames": 20,
        "min_spatial_overlap_iou": 0.20,
        "min_detections": 2,
    },
    "severity": {
        "relative_area_low":    0.0005,
        "relative_area_medium": 0.002,
        "relative_area_high":   0.008,
        "persistence_weight":   0.3,
    },
}

# ── Severity mapping: Sixth Sense → UrbanEye ──────────────────────────────────
_SS_SEVERITY_MAP = {
    SeverityTier.LOW:      EventSeverity.LOW,
    SeverityTier.MEDIUM:   EventSeverity.MEDIUM,
    SeverityTier.HIGH:     EventSeverity.HIGH,
    SeverityTier.CRITICAL: EventSeverity.CRITICAL,
    SeverityTier.UNKNOWN:  EventSeverity.LOW,
}

# ── EventType mapping: Sixth Sense → UrbanEye ────────────────────────────────
_SS_EVENT_TYPE_MAP = {
    SSEventType.POTHOLE:    EventType.POTHOLE,
    SSEventType.ROAD_CRACK: EventType.ROAD_CRACK,
    SSEventType.ROAD_DAMAGE: EventType.ROAD_DAMAGE,
    SSEventType.ROAD_REPAIR: EventType.ROAD_REPAIR,
    SSEventType.WATERLOGGING: EventType.WATERLOGGING,
}


def _load_rdd_model(device: str, profile: Dict[str, Any]) -> Optional[Any]:
    """Load yolo12s_RDD2022_best.pt — local path first, then HuggingFace."""
    local_path = profile.get("road_damage_local_weights")
    if local_path and Path(local_path).exists():
        try:
            from ultralytics import YOLO
            logger.info("Loading Sixth Sense RDD2022 model from %s on %s", local_path, device)
            model = YOLO(str(local_path))
            if device != "cpu" and profile.get("road_damage_fp16", True):
                try:
                    model.model.half()
                except Exception:
                    pass
            return model
        except Exception as exc:
            logger.error("Failed to load RDD2022 model from %s: %s", local_path, exc)

    # Try HuggingFace download as fallback
    try:
        from huggingface_hub import hf_hub_download
        from ultralytics import YOLO
        logger.info("Downloading Sixth Sense RDD2022 model from HuggingFace …")
        path = hf_hub_download(
            repo_id="rezzzq/yolo12s-road-damage-rdd2022",
            filename="yolo12s_RDD2022_best.pt",
        )
        model = YOLO(path)
        return model
    except Exception as exc:
        logger.warning("HuggingFace download failed: %s", exc)

    return None


class RoadHazardDetector:
    """
    Sixth Sense Road Damage Detector — UrbanEye Adapter.

    Wraps the unmodified Sixth Sense perception engine
    (sixth_sense.perception.road_damage_detector.RoadDamageDetector)
    and converts its Observations to UrbanEye UrbanEventData objects.
    """

    # COCO proxy classes (kept from original UrbanEye)
    _OBSTACLE_PROXY_CLASSES = {"suitcase", "backpack", "umbrella", "sports ball"}

    def __init__(
        self,
        enabled: bool = True,
        confidence_threshold: float = 0.22,
        profile: Optional[Dict[str, Any]] = None,
        device: Optional[str] = None,
    ) -> None:
        self.enabled = enabled
        self.confidence_threshold = confidence_threshold
        self._profile = profile or _DEFAULT_PROFILE
        self.device: str = device or ("cuda:0" if torch.cuda.is_available() else "cpu")

        self._quality_gate: Optional[QualityGate] = None
        self._rdd: Optional[RoadDamageDetector] = None
        self._obs_builder: Optional[ObservationBuilder] = None

        if not enabled:
            return

        logger.info("RoadHazardDetector (Sixth Sense Engine) starting on device=%s", self.device)

        # ── Quality Gate (Sixth Sense, unmodified) ────────────────────────────
        qcfg = self._profile.get("quality", {})
        self._quality_gate = QualityGate(
            min_blur_score=qcfg.get("min_blur_score", 60.0),
            min_brightness=qcfg.get("min_brightness", 20.0),
            max_brightness=qcfg.get("max_brightness", 235.0),
            max_glare_ratio=qcfg.get("max_glare_ratio", 0.20),
        )

        # ── Load RDD2022 model (Sixth Sense ModelRegistry logic) ──────────────
        raw_model = _load_rdd_model(self.device, self._profile)

        # ── RoadDamageDetector (Sixth Sense, unmodified) ──────────────────────
        per_class = self._profile.get("conf_thresholds", {})
        self._rdd = RoadDamageDetector(
            model=raw_model,
            conf_threshold=self.confidence_threshold,
            per_class_thresholds={k: v for k, v in per_class.items()},
            imgsz=self._profile.get("road_damage_imgsz", 640),
            device=self.device,
        )

        if raw_model is not None:
            logger.info(
                "Sixth Sense RDD2022 engine ready. model=%s available=%s",
                "yolo12s_RDD2022_best.pt", self._rdd.available,
            )
        else:
            logger.warning(
                "Sixth Sense RDD2022 model NOT loaded — road damage detection is DISABLED."
            )

        # ── ObservationBuilder (Sixth Sense, unmodified) ──────────────────────
        # Reset per-video by calling reset_observation_builder() from the pipeline.
        self._obs_builder = ObservationBuilder(
            profile_cfg=self._profile,
            bus_id="BUS_UNKNOWN",
            camera_id="CAM_FRONT",
            run_id="run_0",
            severity_scorer=SeverityScorer(self._profile.get("severity")),
        )

    # ── Public API ────────────────────────────────────────────────────────────

    def reset_observation_builder(
        self,
        bus_id: str = "BUS_UNKNOWN",
        camera_id: str = "CAM_FRONT",
        run_id: str = "run_0",
    ) -> None:
        """Call at the start of each new video to reset temporal state."""
        if not self.enabled:
            return
        self._obs_builder = ObservationBuilder(
            profile_cfg=self._profile,
            bus_id=bus_id,
            camera_id=camera_id,
            run_id=run_id,
            severity_scorer=SeverityScorer(self._profile.get("severity")),
        )

    def analyse(
        self,
        frame: np.ndarray,
        frame_result: FrameResult,
        frame_number: int,
        timestamp: float,
        video_width: int = 0,
        video_height: int = 0,
    ) -> List[UrbanEventData]:
        """
        Run per-frame road damage detection using the Sixth Sense engine.

        Returns a list of UrbanEventData events (may be empty — the
        ObservationBuilder accumulates detections and will emit confirmed
        events when finalise() is called at the end of the video).

        For live frame-by-frame compatibility we also return any detections
        from this frame individually so the caller can record progress.
        """
        if not self.enabled or self._rdd is None:
            return []

        events: List[UrbanEventData] = []

        try:
            # 1. Quality gate
            quality = self._quality_gate.assess(frame) if self._quality_gate else None

            # 2. Sixth Sense RoadDamageDetector (unmodified)
            detections = self._rdd.detect(
                frame=frame,
                frame_idx=frame_number,
                timestamp=timestamp,
                quality=quality,
                gps=None,  # GPS not wired in per-frame; added in finalise()
            )

            # 3. Feed into ObservationBuilder for temporal grouping
            if self._obs_builder:
                self._obs_builder.ingest(detections)

            # 4. Emit raw frame-level events immediately (for live telemetry)
            for det in detections:
                event_type = _SS_EVENT_TYPE_MAP.get(det.event_type, EventType.ROAD_DAMAGE)
                events.append(
                    UrbanEventData(
                        event_type=event_type,
                        severity=EventSeverity.MEDIUM,  # refined in finalise()
                        confidence=round(det.confidence, 4),
                        frame_number=frame_number,
                        timestamp=timestamp,
                        bbox_x1=float(det.bbox[0]),
                        bbox_y1=float(det.bbox[1]),
                        bbox_x2=float(det.bbox[2]),
                        bbox_y2=float(det.bbox[3]),
                        description=f"[Sixth Sense RDD2022] {det.event_type.value} class={det.class_name}",
                        extra_metadata={
                            "rdd_class": det.class_name,
                            "raw_confidence": det.raw_confidence,
                            "relative_area": det.relative_area,
                            "engine": "SixthSense_RDD2022",
                            "device": self.device,
                            "quality_multiplier": quality.conf_multiplier if quality else 1.0,
                        },
                    )
                )

        except Exception as exc:
            logger.error("Sixth Sense RDD2022 inference failed at frame %d: %s", frame_number, exc)

        # 5. Proxy obstacle detection from COCO tracked objects (kept from original)
        events.extend(
            self._detect_proxy_obstacles(
                frame_result.tracked_detections, frame_number, timestamp
            )
        )

        return events

    def finalise_observations(self) -> List[UrbanEventData]:
        """
        Call ONCE at the end of a video.

        Runs the Sixth Sense ObservationBuilder.finalise() which applies
        temporal grouping (N frames of same pothole → ONE observation with
        accurate severity) and returns deduplicated high-quality UrbanEventData.

        These should REPLACE (not supplement) the raw per-frame events for
        storage in the database.
        """
        if not self.enabled or self._obs_builder is None:
            return []

        observations = self._obs_builder.finalise()
        events: List[UrbanEventData] = []

        for obs in observations:
            event_type = _SS_EVENT_TYPE_MAP.get(obs.event_type, EventType.ROAD_DAMAGE)
            severity = _SS_SEVERITY_MAP.get(obs.severity, EventSeverity.MEDIUM)
            x1, y1, x2, y2 = obs.bbox

            events.append(
                UrbanEventData(
                    event_type=event_type,
                    severity=severity,
                    confidence=round(obs.confidence, 4),
                    frame_number=obs.representative_frame,
                    timestamp=obs.last_seen_ts,
                    bbox_x1=float(x1),
                    bbox_y1=float(y1),
                    bbox_x2=float(x2),
                    bbox_y2=float(y2),
                    description=(
                        f"[Sixth Sense] {obs.event_type.value} — "
                        f"{obs.detection_count} detections over "
                        f"frames {obs.first_seen_frame}–{obs.last_seen_frame}"
                    ),
                    extra_metadata={
                        "obs_id": obs.obs_id,
                        "detection_count": obs.detection_count,
                        "first_seen_frame": obs.first_seen_frame,
                        "last_seen_frame": obs.last_seen_frame,
                        "relative_area": obs.relative_area,
                        "engine": "SixthSense_RDD2022_Observation",
                        "device": self.device,
                    },
                )
            )

        logger.info(
            "Sixth Sense finalise: %d raw observations → %d UrbanEvents",
            len(observations), len(events),
        )
        return events

    # ── Private ───────────────────────────────────────────────────────────────

    def _detect_proxy_obstacles(
        self,
        tracked: list,
        frame_number: int,
        timestamp: float,
    ) -> List[UrbanEventData]:
        """Detect road obstacles from COCO-tracked objects (supplementary)."""
        events: List[UrbanEventData] = []
        for td in tracked:
            if (
                td.class_name in self._OBSTACLE_PROXY_CLASSES
                and td.confidence >= self.confidence_threshold
            ):
                events.append(
                    UrbanEventData(
                        event_type=EventType.ROAD_OBSTACLE,
                        severity=EventSeverity.MEDIUM,
                        confidence=td.confidence,
                        frame_number=frame_number,
                        timestamp=timestamp,
                        bbox_x1=td.bbox.x1,
                        bbox_y1=td.bbox.y1,
                        bbox_x2=td.bbox.x2,
                        bbox_y2=td.bbox.y2,
                        description=f"Road obstacle detected: {td.class_name}.",
                        extra_metadata={
                            "class_name": td.class_name,
                            "track_id": td.track_id,
                        },
                    )
                )
        return events
