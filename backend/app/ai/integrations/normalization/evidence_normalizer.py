"""
TriNetra — Evidence Normalizer

Standardizes evidence artifacts (annotated videos, evidence frame crops,
trajectory snapshots) produced across AI engines into web-accessible URLs
and validated storage paths.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class EvidenceNormalizer:
    """Normalizes evidence paths and links across AI engines."""

    def __init__(self) -> None:
        self.settings = get_settings()

    def normalize_video_url(self, video_path: Optional[str]) -> Optional[str]:
        """Convert a local video path or relative URL to a consistent web URL."""
        if not video_path:
            return None

        # If already an HTTP URL or root-relative URL
        if video_path.startswith("http://") or video_path.startswith("https://") or video_path.startswith("/"):
            return video_path

        p = Path(video_path)
        # Check if inside Sixth Sense outputs
        try:
            ss_out = self.settings.sixth_sense_root_path / "outputs"
            if p.is_relative_to(ss_out):
                rel = p.relative_to(ss_out).as_posix()
                return f"/outputs/{rel}"
        except Exception:
            pass

        # Check if inside UrbanEye storage
        try:
            storage_path = Path(self.settings.STORAGE_PATH).resolve()
            if p.resolve().is_relative_to(storage_path):
                rel = p.resolve().relative_to(storage_path).as_posix()
                return f"/storage/{rel}"
        except Exception:
            pass

        return video_path

    def normalize_frame_url(self, frame_path: Optional[str]) -> Optional[str]:
        """Convert a local evidence frame path to a web URL."""
        if not frame_path:
            return None

        if frame_path.startswith("http://") or frame_path.startswith("https://") or frame_path.startswith("/"):
            return frame_path

        p = Path(frame_path)
        try:
            storage_path = Path(self.settings.STORAGE_PATH).resolve()
            if p.resolve().is_relative_to(storage_path):
                rel = p.resolve().relative_to(storage_path).as_posix()
                return f"/storage/{rel}"
        except Exception:
            pass

        try:
            ss_out = self.settings.sixth_sense_root_path / "outputs"
            if p.resolve().is_relative_to(ss_out):
                rel = p.resolve().relative_to(ss_out).as_posix()
                return f"/outputs/{rel}"
        except Exception:
            pass

        return frame_path

    def normalize_event_evidence(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Normalizes evidence references stored in an event's extra_metadata."""
        updated = dict(metadata)

        # Evidence ref from road AI
        if "evidence_ref" in updated and updated["evidence_ref"]:
            updated["evidence_ref"] = self.normalize_frame_url(updated["evidence_ref"])

        # Annotated video path
        if "annotated_video_path" in updated and updated["annotated_video_path"]:
            updated["annotated_video_path"] = self.normalize_video_url(updated["annotated_video_path"])

        # Evidence frames from safety AI
        if "evidence_frames" in updated and isinstance(updated["evidence_frames"], list):
            updated["evidence_frames"] = [
                self.normalize_frame_url(f) for f in updated["evidence_frames"] if f
            ]

        # Evidence clip from safety AI
        if "evidence_clip" in updated and updated["evidence_clip"]:
            updated["evidence_clip"] = self.normalize_video_url(updated["evidence_clip"])

        return updated
