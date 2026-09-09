"""
Urban Tracker — The Sixth Sense
IoU-based object tracker adapted from TCE ObjectTracker.
Adds: track_id, class matching, temporal confirmation, trajectory, first/last seen.
One physical vehicle = one Track within the camera's field of view.
"""
from __future__ import annotations
import logging
from collections import deque
from typing import List, Dict, Optional, Tuple

from sixth_sense.schemas.urban_event import (
    Detection, Track, ClassificationSource,
)

logger = logging.getLogger(__name__)


def _iou(boxA: Tuple, boxB: Tuple) -> float:
    """
    Intersection over Union for two (x1,y1,x2,y2) boxes.
    Reused from TCE ObjectTracker — clean, correct implementation.
    """
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])
    inter = max(0, xB - xA) * max(0, yB - yA)
    areaA = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    areaB = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
    denom = areaA + areaB - inter
    return inter / (denom + 1e-6)


class UrbianTracker:
    """
    Multi-object tracker using IoU matching with class constraint.

    Key properties:
    - Tracks are confirmed only after N consecutive detections (reduces noise).
    - Lost tracks are kept alive for max_lost_frames before removal.
    - One physical object = one Track ID within the camera FOV.
    - Does NOT count the same vehicle once per frame.
    """

    def __init__(
        self,
        iou_threshold: float = 0.30,
        confirm_frames: int = 3,
        max_lost_frames: int = 10,
        max_trajectory_len: int = 200,
    ) -> None:
        self.iou_threshold = iou_threshold
        self.confirm_frames = confirm_frames
        self.max_lost_frames = max_lost_frames
        self.max_trajectory_len = max_trajectory_len

        self._tracks: Dict[int, _TrackState] = {}
        self._next_id: int = 0
        self._completed_tracks: List[Track] = []

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def update(self, detections: List[Detection], frame_idx: int) -> List[Track]:
        """
        Update tracker with current frame detections.

        Args:
            detections: Detection list from vehicle/road-damage detectors
            frame_idx: Current frame index

        Returns:
            List of currently ACTIVE confirmed Track objects.
        """
        matched_track_ids = set()
        unmatched_dets: List[Detection] = []

        # ── Match each detection to an existing track ─────────────────── #
        for det in detections:
            best_iou = 0.0
            best_id = None
            for tid, state in self._tracks.items():
                if state.class_name != det.class_name:
                    continue  # class constraint — car cannot match truck track
                iou = _iou(det.bbox, state.latest_bbox)
                if iou > best_iou and iou >= self.iou_threshold:
                    best_iou = iou
                    best_id = tid

            if best_id is not None:
                self._tracks[best_id].update(det, frame_idx)
                matched_track_ids.add(best_id)
            else:
                unmatched_dets.append(det)

        # ── Create new tracks for unmatched detections ─────────────────── #
        for det in unmatched_dets:
            new_id = self._next_id
            self._next_id += 1
            self._tracks[new_id] = _TrackState(
                track_id=new_id,
                det=det,
                frame_idx=frame_idx,
                confirm_frames=self.confirm_frames,
                max_trajectory_len=self.max_trajectory_len,
            )

        # ── Age unmatched tracks; remove expired ones ──────────────────── #
        expired_ids = []
        for tid, state in self._tracks.items():
            if tid not in matched_track_ids:
                state.lost_frames += 1
                if state.lost_frames > self.max_lost_frames:
                    expired_ids.append(tid)

        for tid in expired_ids:
            state = self._tracks.pop(tid)
            if state.confirmed:
                self._completed_tracks.append(state.to_track())
            logger.debug("Track %d expired after %d lost frames", tid, state.lost_frames)

        # ── Return active confirmed tracks ─────────────────────────────── #
        active: List[Track] = [
            s.to_track() for s in self._tracks.values() if s.confirmed
        ]
        return active

    @property
    def all_tracks(self) -> List[Track]:
        """All tracks: active + completed (for final report)."""
        active = [s.to_track() for s in self._tracks.values() if s.confirmed]
        return self._completed_tracks + active

    def flush(self) -> List[Track]:
        """Finalise all remaining tracks at end of video."""
        for state in self._tracks.values():
            if state.confirmed:
                self._completed_tracks.append(state.to_track())
        self._tracks.clear()
        return self._completed_tracks


# ─────────────────────────────────────────────────────────────────────────── #
# Internal track state (not exposed outside this module)
# ─────────────────────────────────────────────────────────────────────────── #

class _TrackState:
    def __init__(
        self,
        track_id: int,
        det: Detection,
        frame_idx: int,
        confirm_frames: int,
        max_trajectory_len: int,
    ) -> None:
        self.track_id = track_id
        self.class_name = det.class_name
        self.classification_source = det.classification_source
        self.first_seen_frame = frame_idx
        self.first_seen_ts = det.timestamp
        self.last_seen_frame = frame_idx
        self.last_seen_ts = det.timestamp
        self.latest_bbox = det.bbox
        self.consecutive = 1
        self.confirm_frames = confirm_frames
        self.confirmed = (confirm_frames <= 1)
        self.lost_frames = 0
        self.trajectory: deque = deque(maxlen=max_trajectory_len)
        self.detections: List[Detection] = [det]
        cx = (det.bbox[0] + det.bbox[2]) // 2
        cy = (det.bbox[1] + det.bbox[3]) // 2
        self.trajectory.append((cx, cy))

    def update(self, det: Detection, frame_idx: int) -> None:
        self.last_seen_frame = frame_idx
        self.last_seen_ts = det.timestamp
        self.latest_bbox = det.bbox
        self.lost_frames = 0
        self.consecutive += 1
        if self.consecutive >= self.confirm_frames:
            self.confirmed = True
        cx = (det.bbox[0] + det.bbox[2]) // 2
        cy = (det.bbox[1] + det.bbox[3]) // 2
        self.trajectory.append((cx, cy))
        self.detections.append(det)

    def to_track(self) -> Track:
        return Track(
            track_id=self.track_id,
            class_name=self.class_name,
            classification_source=self.classification_source,
            first_seen_frame=self.first_seen_frame,
            last_seen_frame=self.last_seen_frame,
            first_seen_ts=self.first_seen_ts,
            last_seen_ts=self.last_seen_ts,
            confirmed=self.confirmed,
            trajectory=list(self.trajectory),
            detections=list(self.detections),
        )
