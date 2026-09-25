"""
TriNetra — SixthSenseClient

Clean service interface for calling The-Sixth-Sense-AI inference functions directly
(Mode B — local Python integration). The rest of TriNetra must not care whether
Sixth Sense is remote or local; this client is the single point of contact.

Sixth Sense ownership:
  Road AI   → models/yolo12s_RDD2022_best.pt  (FROZEN — do not modify)
  Traffic AI → models/yolo11x.pt               (FROZEN — do not modify)

Neither model is re-implemented or duplicated inside TriNetra.
"""

from __future__ import annotations

import logging
import sys
import uuid
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Sixth Sense path resolution
# ---------------------------------------------------------------------------
# The-Sixth-Sense-AI must be discoverable.  We reuse the same resolution logic
# as sixth_sense_router.py so there is a single canonical discovery path.
# We do NOT import sixth_sense_router here to avoid circular FastAPI startup
# dependencies; we repeat the path resolution logic directly.

def _resolve_sixth_sense_root() -> Path:
    """Resolve The-Sixth-Sense-AI root directory."""
    try:
        from app.core.config import get_settings
        settings = get_settings()
        if settings.SIXTH_SENSE_ROOT:
            p = Path(settings.SIXTH_SENSE_ROOT).resolve()
            if p.exists():
                return p
            logger.warning(
                "SIXTH_SENSE_ROOT=%s does not exist — falling back to auto-discovery.",
                settings.SIXTH_SENSE_ROOT,
            )
    except Exception:
        pass

    # Auto-discover: this file is at
    # urbaneye-ai/backend/app/ai/integrations/sixth_sense/client.py
    # parents[0]=sixth_sense, [1]=integrations, [2]=ai, [3]=app, [4]=backend, [5]=urbaneye-ai, [6]=sih
    candidate = Path(__file__).resolve().parents[5] / "The-Sixth-Sense-AI"
    if candidate.exists():
        return candidate

    raise RuntimeError(
        f"Cannot locate The-Sixth-Sense-AI repository. "
        f"Set SIXTH_SENSE_ROOT in .env or place it at {candidate}"
    )


def _ensure_sixth_sense_on_path() -> Path:
    """Add Sixth Sense root to sys.path (idempotent). Returns root path."""
    root = _resolve_sixth_sense_root()
    root_str = str(root)
    if root_str not in sys.path:
        sys.path.insert(0, root_str)
        logger.info("SixthSenseClient: added to sys.path: %s", root_str)
    return root


# ---------------------------------------------------------------------------
# SixthSenseClient
# ---------------------------------------------------------------------------

class SixthSenseClient:
    """
    Authoritative interface between TriNetra and The-Sixth-Sense-AI.

    Wraps:
      ai.road_infrastructure.inference.analyze_video()
      ai.traffic.inference.analyze_video()

    Returns SixthSenseRunResult for both — callers never touch Sixth Sense
    internal types directly.

    GPU note:
      The client runs inference synchronously.  TriNetra's pipeline calls
      analyze_road() then analyze_traffic() sequentially so that GPU memory
      from one engine is freed before the next is loaded.
    """

    def __init__(self) -> None:
        self._ss_root: Optional[Path] = None
        self._road_analyze_fn = None
        self._traffic_analyze_fn = None

    def _init(self) -> None:
        """Lazy one-time initialisation — resolves path and imports."""
        if self._ss_root is not None:
            return  # already done

        self._ss_root = _ensure_sixth_sense_on_path()

        try:
            from ai.road_infrastructure.inference import analyze_video as _road_fn
            self._road_analyze_fn = _road_fn
            logger.info("SixthSenseClient: road inference function loaded")
        except ImportError as exc:
            logger.error(
                "SixthSenseClient: cannot import road inference from %s: %s",
                self._ss_root, exc,
            )
            raise

        try:
            from ai.traffic.inference import analyze_video as _traffic_fn
            self._traffic_analyze_fn = _traffic_fn
            logger.info("SixthSenseClient: traffic inference function loaded")
        except ImportError as exc:
            logger.error(
                "SixthSenseClient: cannot import traffic inference from %s: %s",
                self._ss_root, exc,
            )
            raise

    # ── Public API ────────────────────────────────────────────────────────────

    def analyze_road(
        self,
        video_path: str,
        output_base: str,
        run_id: Optional[str] = None,
        profile: str = "urban_mvp",
    ) -> "SixthSenseRunResult":
        """
        Run Sixth Sense Road Infrastructure AI on the provided video.

        Args:
            video_path:  Absolute path to the source video file.
            output_base: Directory where Sixth Sense writes its run outputs.
            run_id:      Stable identifier for this run (auto-generated if None).
            profile:     Sixth Sense profile name (default: urban_mvp).

        Returns:
            SixthSenseRunResult with road damage detections, summary, metrics,
            and annotated video path.

        Raises:
            RuntimeError: If Sixth Sense cannot be imported or inference fails.

        Provenance guarantee:
            result.source is always "REAL_VIDEO_INFERENCE" — never fabricated.
        """
        from app.ai.integrations.sixth_sense.schemas import SixthSenseRunResult

        self._init()

        rid = run_id or f"road_{uuid.uuid4().hex[:8]}"
        logger.info(
            "[engine=sixth_sense][module=road][run=%s] road analysis starting: %s",
            rid, video_path,
        )

        try:
            raw = self._road_analyze_fn(
                video_path=video_path,
                output_base=output_base,
                profile=profile,
                run_id=rid,
            )
        except Exception as exc:
            logger.error(
                "[engine=sixth_sense][module=road][run=%s] inference failed: %s",
                rid, exc,
            )
            return SixthSenseRunResult(
                run_id=rid,
                module="road",
                status="failed",
                source="REAL_VIDEO_INFERENCE",
                error=str(exc),
            )

        # Convert Pydantic model → SixthSenseRunResult
        result = SixthSenseRunResult(
            run_id=raw.run_id,
            module=raw.module,
            status=raw.status,
            source=raw.source,
            detections=[d.model_dump() for d in raw.detections],
            summary=raw.summary.model_dump(),
            metrics=raw.metrics.model_dump(),
            video=raw.video.model_dump(),
            error=raw.error,
        )

        logger.info(
            "[engine=sixth_sense][module=road][run=%s] completed — "
            "%d detections, max_severity=%s",
            rid,
            len(result.detections),
            result.summary.get("max_severity", "N/A"),
        )
        return result

    def analyze_traffic(
        self,
        video_path: str,
        output_base: str,
        run_id: Optional[str] = None,
        profile: str = "urban_mvp",
    ) -> "SixthSenseRunResult":
        """
        Run Sixth Sense Traffic AI on the provided video.

        Args:
            video_path:  Absolute path to the source video file.
            output_base: Directory where Sixth Sense writes its run outputs.
            run_id:      Stable identifier for this run (auto-generated if None).
            profile:     Sixth Sense profile name (default: urban_mvp).

        Returns:
            SixthSenseRunResult with vehicle track detections, summary, metrics,
            and annotated video path.

        Raises:
            RuntimeError: If Sixth Sense cannot be imported or inference fails.

        Provenance guarantee:
            result.source is always "REAL_VIDEO_INFERENCE" — never fabricated.
        """
        from app.ai.integrations.sixth_sense.schemas import SixthSenseRunResult

        self._init()

        rid = run_id or f"traffic_{uuid.uuid4().hex[:8]}"
        logger.info(
            "[engine=sixth_sense][module=traffic][run=%s] traffic analysis starting: %s",
            rid, video_path,
        )

        try:
            raw = self._traffic_analyze_fn(
                video_path=video_path,
                output_base=output_base,
                profile=profile,
                run_id=rid,
            )
        except Exception as exc:
            logger.error(
                "[engine=sixth_sense][module=traffic][run=%s] inference failed: %s",
                rid, exc,
            )
            return SixthSenseRunResult(
                run_id=rid,
                module="traffic",
                status="failed",
                source="REAL_VIDEO_INFERENCE",
                error=str(exc),
            )

        result = SixthSenseRunResult(
            run_id=raw.run_id,
            module=raw.module,
            status=raw.status,
            source=raw.source,
            detections=[d.model_dump() for d in raw.detections],
            summary=raw.summary.model_dump(),
            metrics=raw.metrics.model_dump(),
            video=raw.video.model_dump(),
            error=raw.error,
        )

        logger.info(
            "[engine=sixth_sense][module=traffic][run=%s] completed — "
            "%d unique vehicles, congestion=%s",
            rid,
            result.summary.get("total_vehicles", 0),
            result.summary.get("congestion_level", "N/A"),
        )
        return result
