"""
TriNetra — Safety Ingestion Service

Parses safety_events.jsonl and run_summary.json produced by Module 3 Safety AI,
then persists them as SafetyRun + SafetyEvent records in the database.

Also exposes SafetyEventParser as a standalone utility for testing.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.safety_run import SafetyEvent, SafetyRun

logger = logging.getLogger(__name__)


# ── Parser (pure, no DB) ──────────────────────────────────────────────────────

class SafetyEventParser:
    """
    Stateless utility that parses Safety AI output files into plain dicts.
    No database interaction — safe to use in tests or CLI scripts.
    """

    @staticmethod
    def parse_jsonl(file_path: str | Path) -> list[dict]:
        """
        Read safety_events.jsonl line by line.
        Skips blank lines and logs (but tolerates) malformed JSON.
        """
        path = Path(file_path)
        if not path.exists():
            logger.warning("safety_events.jsonl not found: %s", path)
            return []

        events: list[dict] = []
        with open(path, "r", encoding="utf-8") as f:
            for lineno, raw in enumerate(f, start=1):
                line = raw.strip()
                if not line:
                    continue
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError as exc:
                    logger.warning(
                        "Malformed JSON on line %d of %s: %s", lineno, path.name, exc
                    )
        logger.info("Parsed %d safety events from %s", len(events), path.name)
        return events

    @staticmethod
    def parse_summary(file_path: str | Path) -> Optional[dict]:
        """
        Read run_summary.json.  Returns None if the file is missing or malformed.
        """
        path = Path(file_path)
        if not path.exists():
            logger.warning("run_summary.json not found: %s", path)
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("Could not read run_summary.json (%s): %s", path, exc)
            return None

    @staticmethod
    def resolve_evidence_paths(
        event_dict: dict,
        output_dir: Path,
    ) -> list[str]:
        """
        Resolve relative evidence frame paths to absolute paths using output_dir.
        Preserves paths that are already absolute.
        """
        raw_frames: list[str] = (event_dict.get("evidence") or {}).get("frames") or []
        resolved: list[str] = []
        for rel in raw_frames:
            p = Path(rel)
            if p.is_absolute() and p.exists():
                resolved.append(str(p))
            else:
                abs_p = output_dir / p
                resolved.append(str(abs_p) if abs_p.exists() else rel)
        return resolved


# ── Persistence service ───────────────────────────────────────────────────────

class SafetyIngestionService:
    """
    Reads Module 3 output artifacts from disk and persists them to the DB.
    Called at the end of the AI pipeline run (Stage 3 post-processing).
    """

    parser = SafetyEventParser()

    def __init__(self, db: Session) -> None:
        self._db = db

    def ingest(
        self,
        *,
        output_dir: str | Path,
        job_id: uuid.UUID,
        video_id: uuid.UUID,
        video_fps: float = 30.0,
        annotated_video_path: Optional[str] = None,
    ) -> SafetyRun:
        """
        Parse safety_events.jsonl + run_summary.json from output_dir and
        create/update one SafetyRun + N SafetyEvent rows.

        Args:
            output_dir:           Module 3 output directory (contains jsonl + summary)
            job_id:               ProcessingJob.id
            video_id:             Video.id
            video_fps:            FPS extracted from video headers (for seek math)
            annotated_video_path: Path to annotated .mp4 from Module 3

        Returns:
            The persisted SafetyRun ORM instance.
        """
        out = Path(output_dir)

        # ── Upsert SafetyRun ──────────────────────────────────────────────────
        run = self._get_or_create_run(
            job_id=job_id,
            video_id=video_id,
            out=out,
            video_fps=video_fps,
            annotated_video_path=annotated_video_path,
        )
        self._db.flush()

        # ── Parse events ──────────────────────────────────────────────────────
        jsonl_path = out / "safety_events.jsonl"
        raw_events = self.parser.parse_jsonl(jsonl_path)

        # Collect existing source_event_ids for idempotency
        existing_ids: set[str] = set()
        for ev in run.events:
            existing_ids.add(ev.source_event_id)

        new_events: list[SafetyEvent] = []
        for raw in raw_events:
            source_id = raw.get("event_id", "")
            if source_id in existing_ids:
                continue  # already persisted — skip on re-run

            orm_event = self._build_event(
                raw=raw,
                run_id=run.id,
                job_id=job_id,
                video_id=video_id,
                output_dir=out,
            )
            new_events.append(orm_event)
            existing_ids.add(source_id)

        if new_events:
            self._db.add_all(new_events)

        self._db.commit()
        self._db.refresh(run)

        logger.info(
            "SafetyIngestion: job=%s persisted SafetyRun %s with %d new events",
            job_id,
            run.id,
            len(new_events),
        )
        return run

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _get_or_create_run(
        self,
        *,
        job_id: uuid.UUID,
        video_id: uuid.UUID,
        out: Path,
        video_fps: float,
        annotated_video_path: Optional[str],
    ) -> SafetyRun:
        """Find existing SafetyRun for this job or create a new one."""
        existing = (
            self._db.query(SafetyRun)
            .filter(SafetyRun.job_id == job_id)
            .first()
        )
        if existing:
            if annotated_video_path and not existing.annotated_video_path:
                existing.annotated_video_path = annotated_video_path
            if video_fps and video_fps > 0:
                existing.video_fps = video_fps
            return existing

        summary = self.parser.parse_summary(out / "run_summary.json") or {}

        run = SafetyRun(
            job_id=job_id,
            video_id=video_id,
            source_video_path=summary.get("source"),
            total_frames=int(summary.get("total_frames", 0)),
            processed_frames=int(summary.get("processed_frames", 0)),
            elapsed_seconds=float(summary.get("elapsed_seconds", 0.0)),
            processing_fps=float(summary.get("processing_fps", 0.0)),
            total_events=int(summary.get("total_events", 0)),
            events_by_type=summary.get("events_by_type") or {},
            annotated_video_path=annotated_video_path,
            safety_output_dir=str(out),
            video_fps=video_fps,
        )
        self._db.add(run)
        return run

    def _build_event(
        self,
        *,
        raw: dict[str, Any],
        run_id: uuid.UUID,
        job_id: uuid.UUID,
        video_id: uuid.UUID,
        output_dir: Path,
    ) -> SafetyEvent:
        """Convert a single raw event dict to a SafetyEvent ORM instance."""

        evidence: dict = raw.get("evidence") or {}
        risk: dict = raw.get("risk") or {}
        location: dict = raw.get("location") or {}
        source: dict = raw.get("source") or {}
        track: dict = raw.get("track") or {}
        bbox: dict = raw.get("bounding_box") or {}
        context: dict = raw.get("context") or {}

        # Resolve evidence frames to abs paths
        resolved_frames = self.parser.resolve_evidence_paths(raw, output_dir)

        # Parse ISO timestamp
        raw_ts = raw.get("timestamp")
        event_ts: Optional[datetime] = None
        if raw_ts:
            try:
                event_ts = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                pass

        # risk_reasons can be list[str] or list[enum-like dicts]
        reasons_raw = risk.get("reasons") or []
        reasons: list[str] = [
            r.get("value", str(r)) if isinstance(r, dict) else str(r)
            for r in reasons_raw
        ]

        # trajectory_snapshot: normalise each item
        traj_raw = evidence.get("trajectory_snapshot") or []
        traj: list[dict] = [
            {
                "frame_index": int(t.get("frame_index", 0)),
                "x": float(t.get("x", 0)),
                "y": float(t.get("y", 0)),
                "timestamp_ms": t.get("timestamp_ms"),
            }
            for t in traj_raw
            if isinstance(t, dict)
        ]

        return SafetyEvent(
            run_id=run_id,
            job_id=job_id,
            video_id=video_id,
            source_event_id=str(raw.get("event_id", "")),
            schema_version=str(raw.get("schema_version", "1.0")),
            event_type=str(raw.get("event_type", "unknown")),
            event_timestamp=event_ts,
            frame_index=int(raw.get("frame_index", 0)),
            start_frame=int(raw.get("start_frame", 0)),
            end_frame=int(raw.get("end_frame", 0)),
            duration_frames=int(raw.get("duration_frames", 0)),
            bus_id=source.get("bus_id"),
            camera_id=source.get("camera_id"),
            source_video_path=source.get("video_path"),
            latitude=_opt_float(location.get("lat") if "lat" in location else location.get("latitude")),
            longitude=_opt_float(location.get("lon") if "lon" in location else location.get("longitude")),
            gps_accuracy_m=_opt_float(location.get("accuracy_m") if "accuracy_m" in location else location.get("gps_accuracy_m")),
            track_id=_opt_int(track.get("track_id")),
            object_type=track.get("object_type"),
            track_first_frame=_opt_int(track.get("first_frame")),
            track_last_frame=_opt_int(track.get("last_frame")),
            track_age_frames=_opt_int(track.get("track_age_frames")),
            bbox_x1=_opt_float(bbox.get("x1")),
            bbox_y1=_opt_float(bbox.get("y1")),
            bbox_x2=_opt_float(bbox.get("x2")),
            bbox_y2=_opt_float(bbox.get("y2")),
            bbox_confidence=_opt_float(bbox.get("confidence")),
            risk_level=str(risk.get("level", "low")).lower(),
            risk_score=float(risk.get("score", 0.0)),
            risk_confidence=float(risk.get("confidence", 0.0)),
            risk_explanation=risk.get("explanation") or "",
            risk_reasons=reasons,
            context=context if isinstance(context, dict) else {},
            evidence_frames=resolved_frames,
            evidence_clip=evidence.get("clip"),
            trigger_frame_index=_opt_int(evidence.get("trigger_frame_index")),
            peak_frame_index=_opt_int(evidence.get("peak_frame_index")),
            trajectory_snapshot=traj,
            in_school_zone=bool(context.get("school_zone") or context.get("in_school_zone", False)),
            in_crossing_zone=bool(context.get("crossing_zone") or context.get("in_crossing_zone", False)),
            road_entry=bool(context.get("road_entry", False)),
        )


# ── Tiny helpers ──────────────────────────────────────────────────────────────

def _opt_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _opt_int(v: Any) -> Optional[int]:
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None
