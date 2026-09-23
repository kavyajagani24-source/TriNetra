"""
TriNetra / UrbanEye AI — Sixth Sense Router Bridge
SIH 2026

This module:
  1. Resolves the absolute path to The-Sixth-Sense-AI repository.
  2. Inserts it into sys.path so the Sixth Sense packages are importable.
  3. Patches _RUNS_BASE and _UPLOAD_DIR in the Sixth Sense router modules
     to use absolute paths derived from SIXTH_SENSE_ROOT - preventing CWD
     sensitivity when uvicorn is launched from a different directory.
  4. Re-exports both FastAPI routers for inclusion in main.py.

IMPORTANT: No AI logic lives here. This is purely a wiring/import bridge.
The actual inference is 100% owned by The-Sixth-Sense-AI.
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


# -- 1. Resolve Sixth Sense root ---------------------------------------------

def _resolve_sixth_sense_root() -> Path:
    """Return the absolute path to The-Sixth-Sense-AI directory."""
    if settings.SIXTH_SENSE_ROOT:
        p = Path(settings.SIXTH_SENSE_ROOT).resolve()
        if p.exists():
            return p
        logger.warning(
            "SIXTH_SENSE_ROOT=%s does not exist - falling back to auto-discovery.",
            settings.SIXTH_SENSE_ROOT,
        )
    # Auto-discover: The-Sixth-Sense-AI is a sibling of urbaneye-ai
    # This file is at: urbaneye-ai/backend/app/api/sixth_sense_router.py
    # parents[0] = app/api, [1] = app, [2] = backend, [3] = urbaneye-ai, [4] = parent/
    candidate = Path(__file__).resolve().parents[3].parent / "The-Sixth-Sense-AI"
    if candidate.exists():
        logger.info("Sixth Sense auto-discovered at: %s", candidate)
        return candidate
    raise RuntimeError(
        f"Cannot locate The-Sixth-Sense-AI repository. "
        f"Set SIXTH_SENSE_ROOT in .env or place it at {candidate}"
    )


SIXTH_SENSE_ROOT: Path = _resolve_sixth_sense_root()


# -- 2. Add to sys.path (idempotent) -----------------------------------------

_ss_root_str = str(SIXTH_SENSE_ROOT)
if _ss_root_str not in sys.path:
    sys.path.insert(0, _ss_root_str)
    logger.info("Added Sixth Sense root to sys.path: %s", _ss_root_str)


# -- 3. Import Sixth Sense routers -------------------------------------------
# Must happen AFTER sys.path manipulation above.

try:
    import api.road as _road_module
    import api.traffic as _traffic_module
except ImportError as exc:
    raise ImportError(
        f"Failed to import Sixth Sense API modules from {SIXTH_SENSE_ROOT}. "
        f"Ensure The-Sixth-Sense-AI is complete and its dependencies are installed. "
        f"Original error: {exc}"
    ) from exc


# -- 4. Patch absolute paths -------------------------------------------------
# The Sixth Sense routers use relative paths (Path("outputs/...")).
# When uvicorn runs from the backend directory, these resolve incorrectly.
# We patch them to absolute paths here before any request handler executes.

_road_output_base = SIXTH_SENSE_ROOT / "outputs" / "api_runs" / "road"
_traffic_output_base = SIXTH_SENSE_ROOT / "outputs" / "api_runs" / "traffic"
_upload_dir = SIXTH_SENSE_ROOT / "outputs" / "_uploads"

_road_output_base.mkdir(parents=True, exist_ok=True)
_traffic_output_base.mkdir(parents=True, exist_ok=True)
_upload_dir.mkdir(parents=True, exist_ok=True)

# Patch module-level path variables in the Sixth Sense routers
_road_module._RUNS_BASE = _road_output_base
_road_module._UPLOAD_DIR = _upload_dir
_traffic_module._RUNS_BASE = _traffic_output_base
_traffic_module._UPLOAD_DIR = _upload_dir

logger.info(
    "Sixth Sense paths patched - Road runs: %s | Traffic runs: %s",
    _road_output_base,
    _traffic_output_base,
)


# -- 5. Export routers --------------------------------------------------------

road_router = _road_module.router
traffic_router = _traffic_module.router

logger.info(
    "Sixth Sense routers ready - Road: %s | Traffic: %s",
    road_router.prefix,
    traffic_router.prefix,
)
