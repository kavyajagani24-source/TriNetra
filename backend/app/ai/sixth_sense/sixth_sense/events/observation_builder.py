"""
Observation Builder — The Sixth Sense
CRITICAL MODULE: Converts N per-frame detections into ONE Observation.

A detection is NOT an urban event.
20 frames of the same pothole = ONE Observation.
This module enforces that distinction.
"""
from __future__ import annotations
import logging
import uuid
from collections import defaultdict
from typing import List, Dict, Optional, Tuple, Any

from sixth_sense.schemas.urban_event import (
    Detection, Observation, GPSPoint, EventType, SeverityTier,
)
from sixth_sense.events.severity_scorer import SeverityScorer

logger = logging.getLogger(__name__)


def _iou(boxA: Tuple, boxB: Tuple) -> float:
    """IoU for (x1,y1,x2,y2) boxes. Same formula as tracker (TCE origin)."""
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])
    inter = max(0, xB - xA) * max(0, yB - yA)
    areaA = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    areaB = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
    return inter / (areaA + areaB - inter + 1e-6)


class _ActiveGroup:
    """Accumulates detections of the same physical event across frames."""

    def __init__(self, det: Detection) -> None:
        self.class_name = det.class_name
        self.event_type = det.event_type
        self.detections: List[Detection] = [det]
        self.last_frame = det.frame_idx
        self.best_det = det  # detection with highest confidence

    def try_merge(self, det: Detection, max_gap_frames: int, min_iou: float) -> bool:
        """
        Attempt to merge a new detection into this group.
        Returns True if merged, False if this detection starts a new group.
        """
        if det.class_name != self.class_name:
            return False
        if det.frame_idx - self.last_frame > max_gap_frames:
            return False
        if _iou(det.bbox, self.best_det.bbox) < min_iou:
            return False

        self.detections.append(det)
        self.last_frame = det.frame_idx
        if det.confidence > self.best_det.confidence:
            self.best_det = det
        return True

    def to_observation(
        self,
        bus_id: str,
        camera_id: str,
        run_id: str,
        severity_scorer: SeverityScorer,
        min_detections: int,
        evidence_ref: Optional[str],
    ) -> Optional[Observation]:
        """Convert group to Observation, or None if too few detections."""
        if len(self.detections) < min_detections:
            return None

        best = self.best_det
        first = self.detections[0]
        last = self.detections[-1]

        peak_conf = best.confidence
        avg_area = sum(d.relative_area for d in self.detections) / len(self.detections)

        severity = severity_scorer.score(
            event_type=self.event_type,
            relative_area=avg_area,
            detection_count=len(self.detections),
            confidence=peak_conf,
        )

        # Use GPS from best detection
        gps = best.gps if best.gps and best.gps.status.value != "UNAVAILABLE" else None
        if gps is None and self.detections:
            # Fall back to any GPS with valid status
            for d in self.detections:
                if d.gps and d.gps.status.value != "UNAVAILABLE":
                    gps = d.gps
                    break

        return Observation(
            obs_id=Observation.make_id(),
            bus_id=bus_id,
            camera_id=camera_id,
            run_id=run_id,
            event_type=self.event_type,
            class_name=self.class_name,
            first_seen_frame=first.frame_idx,
            last_seen_frame=last.frame_idx,
            first_seen_ts=first.timestamp,
            last_seen_ts=last.timestamp,
            representative_frame=best.frame_idx,
            confidence=round(peak_conf, 4),
            severity=severity,
            bbox=best.bbox,
            bbox_area_px=best.bbox_area_px,
            relative_area=round(avg_area, 6),
            gps=gps,
            evidence_ref=evidence_ref,
            detection_count=len(self.detections),
            model_name=best.model_name,
        )


class ObservationBuilder:
    """
    Accumulates per-frame detections and groups them into Observations.

    Usage:
        builder = ObservationBuilder(cfg, bus_id, camera_id, run_id)
        for frame in video:
            builder.ingest(detections_this_frame)
        observations = builder.finalise()

    One call to finalise() at end of video returns all confirmed Observations.
    """

    def __init__(
        self,
        profile_cfg: Dict[str, Any],
        bus_id: str = "BUS_UNKNOWN",
        camera_id: str = "CAM_FRONT",
        run_id: str = "run_0",
        severity_scorer: Optional[SeverityScorer] = None,
        evidence_frame_saver=None,   # callable(det) -> evidence_ref string
    ) -> None:
        obs_cfg = profile_cfg.get("observation", {})
        self.max_gap_frames = obs_cfg.get("max_gap_frames", 15)
        self.min_iou = obs_cfg.get("min_spatial_overlap_iou", 0.3)
        self.min_detections = obs_cfg.get("min_detections", 3)

        self.bus_id = bus_id
        self.camera_id = camera_id
        self.run_id = run_id
        self.scorer = severity_scorer or SeverityScorer(profile_cfg.get("severity"))
        self.evidence_saver = evidence_frame_saver

        # Separate active groups per class for efficiency
        self._groups: Dict[str, List[_ActiveGroup]] = defaultdict(list)
        self._completed: List[Observation] = []

    def ingest(self, detections: List[Detection]) -> None:
        """Feed detections from one frame. Called once per processed frame."""
        for det in detections:
            key = det.class_name
            merged = False
            for group in self._groups[key]:
                if group.try_merge(det, self.max_gap_frames, self.min_iou):
                    merged = True
                    break
            if not merged:
                self._groups[key].append(_ActiveGroup(det))

        # Finalise groups that have been inactive too long
        current_frame = max((d.frame_idx for d in detections), default=0) if detections else 0
        self._close_expired_groups(current_frame)

    def _close_expired_groups(self, current_frame: int) -> None:
        """Convert groups that haven't seen a detection in max_gap_frames."""
        for key in list(self._groups.keys()):
            still_active = []
            for group in self._groups[key]:
                if current_frame - group.last_frame > self.max_gap_frames:
                    obs = self._finalize_group(group)
                    if obs:
                        self._completed.append(obs)
                else:
                    still_active.append(group)
            self._groups[key] = still_active

    def _finalize_group(self, group: _ActiveGroup) -> Optional[Observation]:
        evidence_ref = None
        if self.evidence_saver and group.best_det:
            try:
                evidence_ref = self.evidence_saver(group.best_det)
            except Exception as exc:
                logger.debug("Evidence save failed: %s", exc)

        return group.to_observation(
            bus_id=self.bus_id,
            camera_id=self.camera_id,
            run_id=self.run_id,
            severity_scorer=self.scorer,
            min_detections=self.min_detections,
            evidence_ref=evidence_ref,
        )

    def finalise(self) -> List[Observation]:
        """Close all remaining groups and return all confirmed Observations."""
        for key in list(self._groups.keys()):
            for group in self._groups[key]:
                obs = self._finalize_group(group)
                if obs:
                    self._completed.append(obs)
            self._groups[key] = []

        logger.info(
            "ObservationBuilder finalised: %d confirmed observations", len(self._completed)
        )
        return self._completed
