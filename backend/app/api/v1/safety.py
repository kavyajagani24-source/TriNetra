"""
TriNetra — Safety Intelligence API

Endpoints:
    GET  /api/v1/safety/runs                          — list all safety runs (paginated)
    GET  /api/v1/safety/runs/{run_id}/summary         — run metadata + KPIs
    GET  /api/v1/safety/runs/{run_id}/events          — events with filters
    GET  /api/v1/safety/videos/{video_id}/run         — run for a specific video
    GET  /api/v1/safety/videos/{video_id}/events      — events for a specific video
    GET  /api/v1/safety/events/{event_id}             — full event detail
    GET  /api/v1/safety/evidence/{event_id}/{filename} — serve JPEG evidence frame
    GET  /api/v1/safety/videos/{filename}             — stream annotated MP4

All evidence and video URLs returned in JSON bodies are fully qualified
API URLs pointing to the serve-from-disk endpoints above.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse, Response, StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.repositories.safety_repository import SafetyRepository
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.schemas.safety import (
    SafetyEventDetailResponse,
    SafetyEventListItem,
    SafetyRunListItem,
    SafetyRunSummaryResponse,
)
from app.services.exceptions import NotFoundError

router = APIRouter(prefix="/safety", tags=["Safety Intelligence"])

DatabaseDep = Annotated[Session, Depends(get_db)]


# ── Internal helper: build evidence URL ──────────────────────────────────────

def _evidence_url(request: Request, event_id: str, abs_path: str, idx: int = 0) -> str:
    """
    Convert a filesystem evidence frame path to a full API URL.
    """
    try:
        p = Path(abs_path)
        parts = p.parts
        if len(parts) >= 2:
            rel = f"{parts[-2]}/{parts[-1]}"
        elif p.name:
            rel = p.name
        else:
            rel = f"frame_{idx}.jpg"
        base = str(request.base_url).rstrip("/")
        return f"{base}/api/v1/safety/evidence/{event_id}/{rel}"
    except Exception:
        base = str(request.base_url).rstrip("/")
        return f"{base}/api/v1/safety/evidence/{event_id}/frame_{idx}.jpg"


def _annotated_video_url(request: Request, run_id: uuid.UUID | str, abs_path: str) -> Optional[str]:
    """Build serving URL for the annotated safety MP4."""
    if not abs_path:
        return None
    try:
        base = str(request.base_url).rstrip("/")
        return f"{base}/api/v1/safety/runs/{run_id}/video"
    except Exception:
        return abs_path


def _enrich_event_urls(event_orm, event_schema, request: Request) -> None:
    """Populate evidence_frame_urls on a schema instance from ORM evidence_frames."""
    frames = event_orm.evidence_frames or []
    event_schema.evidence_frame_urls = [
        _evidence_url(request, str(event_orm.id), f, idx) for idx, f in enumerate(frames)
    ]


# ── Run endpoints ─────────────────────────────────────────────────────────────

@router.get(
    "/runs",
    response_model=PaginatedResponse[SafetyRunListItem],
    summary="List Safety Runs",
    description="Return all safety analysis runs, newest first.",
)
def list_safety_runs(
    db: DatabaseDep,
    request: Request,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> PaginatedResponse[SafetyRunListItem]:
    repo = SafetyRepository(db)
    runs, total = repo.list_runs(page=page, limit=limit)
    items: list[SafetyRunListItem] = []
    for r in runs:
        item = SafetyRunListItem.model_validate(r)
        if r.annotated_video_path:
            item.annotated_video_path = _annotated_video_url(request, r.id, r.annotated_video_path)
        items.append(item)
    return PaginatedResponse.build(
        items=items,
        page=page,
        limit=limit,
        total=total,
    )


@router.get(
    "/runs/{run_id}/summary",
    response_model=SuccessResponse[SafetyRunSummaryResponse],
    summary="Get Safety Run Summary",
    description="Return run metadata and KPI summary (mirrors run_summary.json).",
)
def get_safety_run_summary(
    run_id: uuid.UUID,
    db: DatabaseDep,
    request: Request,
) -> SuccessResponse[SafetyRunSummaryResponse]:
    repo = SafetyRepository(db)
    run = repo.get_run_by_id(run_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Safety run not found.")

    data = SafetyRunSummaryResponse.model_validate(run)
    # Enrich annotated video URL
    if run.annotated_video_path:
        data.annotated_video_path = _annotated_video_url(request, run.id, run.annotated_video_path)
    return SuccessResponse(message="Safety run summary retrieved.", data=data)


@router.get(
    "/runs/{run_id}/events",
    response_model=PaginatedResponse[SafetyEventListItem],
    summary="List Events for a Safety Run",
    description=(
        "Return safety events for a run with optional filters.\n\n"
        "**Filters**: `risk_level` (high/medium/low), `event_type`, `min_score` (0.0–1.0)."
    ),
)
def list_run_events(
    run_id: uuid.UUID,
    db: DatabaseDep,
    request: Request,
    risk_level: Optional[str] = Query(default=None, description="Filter: high | medium | low"),
    event_type: Optional[str] = Query(default=None, description="Filter by event type"),
    min_score: Optional[float] = Query(default=None, ge=0.0, le=1.0),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
) -> PaginatedResponse[SafetyEventListItem]:
    repo = SafetyRepository(db)

    # Verify run exists
    run = repo.get_run_by_id(run_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Safety run not found.")

    events, total = repo.get_events_for_run(
        run_id=run_id,
        risk_level=risk_level,
        event_type=event_type,
        min_score=min_score,
        page=page,
        limit=limit,
    )

    items: list[SafetyEventListItem] = []
    for ev in events:
        item = SafetyEventListItem.model_validate(ev)
        item.evidence_frame_urls = [
            _evidence_url(request, str(ev.id), f, idx) for idx, f in enumerate(ev.evidence_frames or [])
        ]
        items.append(item)

    return PaginatedResponse.build(items=items, page=page, limit=limit, total=total)


# ── Video-scoped endpoints ────────────────────────────────────────────────────

@router.get(
    "/videos/{video_id}/run",
    response_model=SuccessResponse[SafetyRunSummaryResponse],
    summary="Get Safety Run for a Video",
    description="Return the most-recent safety run for a specific video.",
)
def get_safety_run_for_video(
    video_id: uuid.UUID,
    db: DatabaseDep,
    request: Request,
) -> SuccessResponse[SafetyRunSummaryResponse]:
    repo = SafetyRepository(db)
    run = repo.get_run_by_video_id(video_id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No safety run found for this video.",
        )
    data = SafetyRunSummaryResponse.model_validate(run)
    if run.annotated_video_path:
        data.annotated_video_path = _annotated_video_url(request, run.id, run.annotated_video_path)
    return SuccessResponse(message="Safety run retrieved.", data=data)


@router.get(
    "/videos/{video_id}/events",
    response_model=PaginatedResponse[SafetyEventListItem],
    summary="List Safety Events for a Video",
    description="Return safety events for a video (all runs), with optional filters.",
)
def list_video_safety_events(
    video_id: uuid.UUID,
    db: DatabaseDep,
    request: Request,
    risk_level: Optional[str] = Query(default=None),
    event_type: Optional[str] = Query(default=None),
    min_score: Optional[float] = Query(default=None, ge=0.0, le=1.0),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
) -> PaginatedResponse[SafetyEventListItem]:
    repo = SafetyRepository(db)
    events, total = repo.get_events_for_video(
        video_id=video_id,
        risk_level=risk_level,
        event_type=event_type,
        min_score=min_score,
        page=page,
        limit=limit,
    )
    items: list[SafetyEventListItem] = []
    for ev in events:
        item = SafetyEventListItem.model_validate(ev)
        item.evidence_frame_urls = [
            _evidence_url(request, str(ev.id), f, idx) for idx, f in enumerate(ev.evidence_frames or [])
        ]
        items.append(item)
    return PaginatedResponse.build(items=items, page=page, limit=limit, total=total)


# ── Single event detail ───────────────────────────────────────────────────────

@router.get(
    "/events/{event_id}",
    response_model=SuccessResponse[SafetyEventDetailResponse],
    summary="Get Safety Event Detail",
    description=(
        "Return full detail for a single safety event including "
        "risk explanation, bounding box, trajectory snapshot, "
        "and resolved evidence frame URLs."
    ),
)
def get_safety_event(
    event_id: uuid.UUID,
    db: DatabaseDep,
    request: Request,
) -> SuccessResponse[SafetyEventDetailResponse]:
    repo = SafetyRepository(db)
    ev = repo.get_event_by_id(event_id)
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Safety event not found.")

    data = SafetyEventDetailResponse.model_validate(ev)
    data.evidence_frame_urls = [
        _evidence_url(request, str(ev.id), f, idx) for idx, f in enumerate(ev.evidence_frames or [])
    ]
    return SuccessResponse(message="Safety event retrieved.", data=data)


# ── Static asset serving ──────────────────────────────────────────────────────

@router.api_route(
    "/evidence/{event_id}/{filename:path}",
    methods=["GET", "HEAD"],
    summary="Serve Evidence Frame",
    description=(
        "Stream a JPEG evidence keyframe for a safety event. "
        "Supports browser image embedding with correct Content-Type."
    ),
    response_class=FileResponse,
)
def serve_evidence_frame(
    event_id: uuid.UUID,
    filename: str,
    db: DatabaseDep,
    request: Request,
) -> Response:
    repo = SafetyRepository(db)
    ev = repo.get_event_by_id(event_id)
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    settings = get_settings()
    run = repo.get_run_by_id(ev.run_id) if ev.run_id else None
    clean_target_name = Path(filename).name

    candidates: list[Path] = []

    # 1. Stored paths from event
    for fpath in (ev.evidence_frames or []):
        p = Path(fpath)
        candidates.append(p)
        if run and run.safety_output_dir:
            run_dir = Path(run.safety_output_dir)
            candidates.append(run_dir / fpath)
            candidates.append(run_dir / p.name)
            norm_f = fpath.replace("\\", "/")
            if "evidence/" in norm_f:
                sub = norm_f[norm_f.index("evidence/"):]
                candidates.append(run_dir / sub)
        if settings.MODULE3_ROOT:
            m3_dir = Path(settings.MODULE3_ROOT)
            candidates.append(m3_dir / fpath)
            candidates.append(m3_dir / "results" / fpath)

    # 2. Filename-based candidates
    if run and run.safety_output_dir:
        run_dir = Path(run.safety_output_dir)
        candidates.append(run_dir / filename)
        candidates.append(run_dir / "evidence" / filename)
    if settings.MODULE3_ROOT:
        m3_dir = Path(settings.MODULE3_ROOT)
        candidates.append(m3_dir / filename)

    # Direct candidate checks (instant O(1) checks, no recursive rglob)
    target: Optional[Path] = None
    for cand in candidates:
        try:
            if cand.is_file():
                target = cand
                break
        except Exception:
            continue

    if target is None or not target.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence frame '{filename}' not found for event {event_id}.",
        )

    if request.method == "HEAD":
        return Response(
            status_code=200,
            media_type="image/jpeg",
            headers={"Content-Length": str(target.stat().st_size), "Accept-Ranges": "bytes"},
        )

    return FileResponse(
        path=str(target),
        media_type="image/jpeg",
        headers={
            "Cache-Control": "public, max-age=86400",
            "X-Event-Id": str(event_id),
        },
    )


def _build_video_streaming_response(target: Path, request: Request) -> Response:
    """Helper to stream an MP4 file with byte-range request support and HEAD response."""
    file_size = target.stat().st_size

    if request.method == "HEAD":
        return Response(
            status_code=200,
            media_type="video/mp4",
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
                "Content-Type": "video/mp4",
            },
        )

    range_header = request.headers.get("range")

    if range_header:
        try:
            ranges = range_header.strip().split("=")[1]
            start_str, end_str = ranges.split("-")
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else file_size - 1
            end = min(end, file_size - 1)
            content_length = end - start + 1

            def _iter_file(path: Path, s: int, e: int, chunk: int = 1024 * 1024):
                with open(path, "rb") as f:
                    f.seek(s)
                    remaining = e - s + 1
                    while remaining > 0:
                        data = f.read(min(chunk, remaining))
                        if not data:
                            break
                        remaining -= len(data)
                        yield data

            return StreamingResponse(
                _iter_file(target, start, end),
                status_code=206,
                media_type="video/mp4",
                headers={
                    "Content-Range": f"bytes {start}-{end}/{file_size}",
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(content_length),
                },
            )
        except Exception:
            pass  # Fall through to full-file response

    def _stream_full(path: Path, chunk: int = 1024 * 1024):
        with open(path, "rb") as f:
            while True:
                data = f.read(chunk)
                if not data:
                    break
                yield data

    return StreamingResponse(
        _stream_full(target),
        media_type="video/mp4",
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
        },
    )


@router.api_route(
    "/runs/{run_id}/video",
    methods=["GET", "HEAD"],
    summary="Stream Annotated Safety Video for a Run",
    description=(
        "Stream the annotated safety MP4 video produced for a specific SafetyRun. "
        "Supports Range requests and HEAD requests for seamless HTML5 video seeking."
    ),
)
async def stream_run_safety_video(
    run_id: uuid.UUID,
    db: DatabaseDep,
    request: Request,
) -> Response:
    repo = SafetyRepository(db)
    run = repo.get_run_by_id(run_id)
    if not run or not run.annotated_video_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Annotated video not found for safety run {run_id}.",
        )
    target = Path(run.annotated_video_path)
    if not target.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Annotated video file not found on disk at {target.name}.",
        )
    return _build_video_streaming_response(target, request)


@router.api_route(
    "/videos/{filename:path}",
    methods=["GET", "HEAD"],
    summary="Stream Annotated Safety Video",
    description=(
        "Stream the annotated safety MP4 video produced by Module 3 by filename. "
        "Supports Range requests and HEAD requests so the HTML5 video element can seek."
    ),
)
async def stream_safety_video(
    filename: str,
    db: DatabaseDep,
    request: Request,
) -> Response:
    from sqlalchemy import select
    from app.models.safety_run import SafetyRun as SafetyRunModel

    stmt = select(SafetyRunModel).where(
        SafetyRunModel.annotated_video_path.isnot(None)
    )
    runs = db.execute(stmt).scalars().all()

    target: Optional[Path] = None
    for run in runs:
        if run.annotated_video_path:
            p = Path(run.annotated_video_path)
            if p.name == filename and p.exists():
                target = p
                break

    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Annotated video '{filename}' not found.",
        )

    return _build_video_streaming_response(target, request)
