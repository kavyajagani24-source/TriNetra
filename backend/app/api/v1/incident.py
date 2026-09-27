"""
TriNetra — Person 4: Incident + ANPR AI — REST API Router
SIH 2026 | PS 26125

Endpoints:
  POST /api/v1/incident/analyze        — Upload video, run collision / HnR / ANPR pipeline
  GET  /api/v1/incident/runs/{run_id}  — Retrieve stored incident.json
  GET  /api/v1/incident/runs/{run_id}/video     — Stream annotated MP4
  GET  /api/v1/incident/runs/{run_id}/evidence  — Evidence manifest
  GET  /api/v1/incident/runs/{run_id}/evidence/{filename} — Individual artifact
  GET  /api/v1/incident/alerts         — All alerts for Command Center
  GET  /api/v1/incident/alerts/{run_id}— Single alert

Author: Dhruvin Shah (Person 4 — Incident & ANPR AI)
"""

from __future__ import annotations

import json
import logging
import shutil
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.ai.incident.inference import IncidentPipeline
from app.ai.incident.schemas import IncidentAlertSummary, IncidentAnalysisResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/incident", tags=["Incident & ANPR AI (Person 4)"])

# ── Output directories ────────────────────────────────────────────────────── #
# Stored relative to this repo's backend/ directory so that outputs persist
# alongside the rest of TriNetra's storage.
_BACKEND_ROOT: Path = Path(__file__).resolve().parents[3]  # …/backend
_RUNS_BASE: Path = _BACKEND_ROOT / "storage" / "incident" / "runs"
_UPLOAD_DIR: Path = _BACKEND_ROOT / "storage" / "incident" / "_uploads"
_RUNS_BASE.mkdir(parents=True, exist_ok=True)
_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}

# Shared pipeline singleton
_pipeline: IncidentPipeline | None = None


def _get_pipeline() -> IncidentPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = IncidentPipeline()
    return _pipeline


# ── POST /analyze ─────────────────────────────────────────────────────────── #

@router.post(
    "/analyze",
    response_model=IncidentAnalysisResponse,
    summary="Analyze video for collisions, rash driving, hit-and-run and license plates",
    responses={
        415: {"description": "Unsupported media type — must be a video file"},
        422: {"description": "Validation error — missing required field"},
        500: {"description": "Pipeline execution error"},
    },
)
async def analyze_incident(
    video: UploadFile = File(..., description="Video file (.mp4/.avi/.mov/.mkv/.webm)"),
    run_id: str = Form(None, description="Optional stable run identifier"),
    gps_lat: Optional[float] = Form(None, description="Optional GPS latitude"),
    gps_lon: Optional[float] = Form(None, description="Optional GPS longitude"),
    render_video: bool = Form(True, description="Render annotated MP4 clip"),
):
    """Upload a dashcam or CCTV video and receive comprehensive incident analysis."""
    suffix = Path(video.filename or "upload.mp4").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported video format '{suffix}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}",
        )

    if not run_id:
        run_id = f"inc_{uuid.uuid4().hex[:12]}"

    gps_coords = None
    if gps_lat is not None and gps_lon is not None:
        gps_coords = {"latitude": float(gps_lat), "longitude": float(gps_lon)}

    upload_path = _UPLOAD_DIR / f"{run_id}{suffix}"
    try:
        content = await video.read()
        if not content:
            raise HTTPException(status_code=422, detail="Uploaded file is empty (0 bytes).")
        upload_path.write_bytes(content)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save upload: {exc}")

    try:
        pipeline = _get_pipeline()
        response = pipeline.analyze_video(
            video_path=str(upload_path),
            run_id=run_id,
            gps_coordinates=gps_coords,
            render_video=render_video,
            output_base=str(_RUNS_BASE),
        )
        return response
    except Exception as exc:
        logger.exception("Incident AI pipeline failed for run %s", run_id)
        raise HTTPException(status_code=500, detail=f"Pipeline execution failed: {exc}")
    finally:
        if upload_path.exists():
            try:
                run_dir = _RUNS_BASE / run_id
                if run_dir.exists():
                    raw_dst = run_dir / f"raw_input{suffix}"
                    if not raw_dst.exists():
                        shutil.copyfile(upload_path, raw_dst)
                upload_path.unlink()
            except Exception:
                pass


# ── GET /runs/{run_id} ────────────────────────────────────────────────────── #

@router.get(
    "/runs/{run_id}",
    summary="Retrieve stored incident analysis record",
    responses={404: {"description": "Run not found"}},
)
async def get_incident_run(run_id: str):
    json_path = _RUNS_BASE / run_id / "incident.json"
    if not json_path.exists():
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
    return json.loads(json_path.read_text(encoding="utf-8"))


# ── GET /runs/{run_id}/video ──────────────────────────────────────────────── #

@router.get(
    "/runs/{run_id}/video",
    summary="Stream annotated incident video",
    responses={404: {"description": "Video not found"}},
)
async def get_incident_video(run_id: str):
    video_path = _RUNS_BASE / run_id / "annotated.mp4"
    if not video_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Annotated video for run '{run_id}' not found.",
        )
    return FileResponse(
        path=str(video_path),
        media_type="video/mp4",
        content_disposition_type="inline",
    )


# ── GET /runs/{run_id}/evidence ───────────────────────────────────────────── #

@router.get(
    "/runs/{run_id}/evidence",
    summary="Retrieve incident evidence manifest and SHA-256 hashes",
    responses={404: {"description": "Manifest not found"}},
)
async def get_incident_evidence(run_id: str):
    manifest_path = _RUNS_BASE / run_id / "evidence_manifest.json"
    if not manifest_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Evidence manifest for run '{run_id}' not found.",
        )
    return json.loads(manifest_path.read_text(encoding="utf-8"))


# ── GET /runs/{run_id}/evidence/{filename} ────────────────────────────────── #

@router.get(
    "/runs/{run_id}/evidence/{filename}",
    summary="Download specific incident evidence artifact",
    responses={404: {"description": "Artifact not found"}},
)
async def get_incident_artifact(run_id: str, filename: str):
    artifact_path = _RUNS_BASE / run_id / filename
    if not artifact_path.exists() or not artifact_path.is_file():
        raise HTTPException(
            status_code=404,
            detail=f"Artifact '{filename}' not found for run '{run_id}'.",
        )
    media_type = "application/octet-stream"
    if filename.endswith((".jpg", ".jpeg")):
        media_type = "image/jpeg"
    elif filename.endswith(".png"):
        media_type = "image/png"
    elif filename.endswith(".json"):
        media_type = "application/json"
    elif filename.endswith(".mp4"):
        media_type = "video/mp4"
    return FileResponse(
        path=str(artifact_path),
        media_type=media_type,
        content_disposition_type="inline",
    )


# ── GET /alerts ───────────────────────────────────────────────────────────── #

@router.get(
    "/alerts",
    summary="List all incident alerts for Command Center",
    response_model=List[IncidentAlertSummary],
)
async def list_incident_alerts():
    """Retrieve all detected incident candidate alerts for Command Center dashboard."""
    alerts: List[IncidentAlertSummary] = []
    if not _RUNS_BASE.exists():
        return alerts

    for run_dir in sorted(_RUNS_BASE.iterdir(), key=lambda d: d.stat().st_mtime, reverse=True):
        if not run_dir.is_dir():
            continue
        inc_json = run_dir / "incident.json"
        if not inc_json.exists():
            continue
        try:
            data = json.loads(inc_json.read_text(encoding="utf-8"))
            if "incident_summary" in data and data["incident_summary"]:
                alerts.append(IncidentAlertSummary(**data["incident_summary"]))
            else:
                col_det = data.get("collision", {}).get("detected", False)
                alerts.append(
                    IncidentAlertSummary(
                        incident_id=f"INC_{data.get('run_id', run_dir.name)}",
                        incident_type="COLLISION_CANDIDATE" if col_det else "NONE",
                        status="REVIEW_REQUIRED" if col_det else "NO_INCIDENT",
                        confidence=float(data.get("collision", {}).get("confidence", 0.0)),
                        timestamp=data.get("timestamp", ""),
                        gps=data.get("gps_coordinates"),
                        vehicle=None,
                        anpr=None,
                        evidence={
                            "annotated_video": f"storage/incident/runs/{run_dir.name}/annotated.mp4",
                            "manifest": f"storage/incident/runs/{run_dir.name}/evidence_manifest.json",
                        },
                    )
                )
        except Exception as exc:
            logger.warning("Could not parse incident run %s: %s", run_dir.name, exc)
            continue

    return alerts


# ── GET /alerts/{run_id} ──────────────────────────────────────────────────── #

@router.get(
    "/alerts/{run_id}",
    summary="Retrieve single incident alert for Command Center",
    response_model=IncidentAlertSummary,
    responses={404: {"description": "Incident alert not found"}},
)
async def get_incident_alert(run_id: str):
    """Retrieve single incident candidate alert formatted for Command Center."""
    inc_json = _RUNS_BASE / run_id / "incident.json"
    if not inc_json.exists():
        raise HTTPException(status_code=404, detail=f"Incident run '{run_id}' not found.")
    data = json.loads(inc_json.read_text(encoding="utf-8"))
    if "incident_summary" in data and data["incident_summary"]:
        return IncidentAlertSummary(**data["incident_summary"])
    col_det = data.get("collision", {}).get("detected", False)
    return IncidentAlertSummary(
        incident_id=f"INC_{run_id}",
        incident_type="COLLISION_CANDIDATE" if col_det else "NONE",
        status="REVIEW_REQUIRED" if col_det else "NO_INCIDENT",
        confidence=float(data.get("collision", {}).get("confidence", 0.0)),
        timestamp=data.get("timestamp", ""),
        gps=data.get("gps_coordinates"),
        vehicle=None,
        anpr=None,
        evidence={
            "annotated_video": f"storage/incident/runs/{run_id}/annotated.mp4",
            "manifest": f"storage/incident/runs/{run_id}/evidence_manifest.json",
        },
    )
