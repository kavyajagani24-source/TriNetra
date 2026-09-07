"""
UrbanEye AI — ByteTracker Wrapper

Tracks objects across video frames and maintains metadata for each active track ID
(first seen, last seen, average confidence, class name, lifetime).
"""

from __future__ import annotations

from typing import Dict, List, Optional

from app.ai.models.detection_types import TrackedDetection


class TrackState:
    """State metadata for a single tracked entity."""

    def __init__(self, track_id: int, class_name: str, first_seen_frame: int, timestamp: float, confidence: float):
        self.track_id = track_id
        self.class_name = class_name
        self.first_seen_frame = first_seen_frame
        self.last_seen_frame = first_seen_frame
        self.first_seen_timestamp = timestamp
        self.last_seen_timestamp = timestamp
        self.max_confidence = confidence
        self._conf_sum = confidence
        self._count = 1
        self.status = "ACTIVE"

    def update(self, frame_number: int, timestamp: float, confidence: float) -> None:
        self.last_seen_frame = frame_number
        self.last_seen_timestamp = timestamp
        self.max_confidence = max(self.max_confidence, confidence)
        self._conf_sum += confidence
        self._count += 1
        self.status = "ACTIVE"

    @property
    def average_confidence(self) -> float:
        return self._conf_sum / self._count if self._count > 0 else 0.0

    @property
    def total_frames(self) -> int:
        return self.last_seen_frame - self.first_seen_frame + 1


class ByteTrackerWrapper:
    """
    Stateful manager for tracked detections.
    Tracks lifecycle of unique object IDs across frames.
    """

    def __init__(self, max_lost_frames: int = 30):
        self.max_lost_frames = max_lost_frames
        self.tracks: Dict[int, TrackState] = {}
        self.active_ids: set[int] = set()

    def update(
        self,
        tracked_detections: List[TrackedDetection],
        frame_number: int,
        timestamp: float,
    ) -> List[TrackedDetection]:
        """
        Record detections for the current frame and update track metadata.
        Returns the valid tracked detections (filtering out invalid track IDs).
        """
        valid_detections: List[TrackedDetection] = []
        current_frame_ids = set()

        for det in tracked_detections:
            if det.track_id < 0:
                continue

            current_frame_ids.add(det.track_id)
            valid_detections.append(det)

            if det.track_id in self.tracks:
                self.tracks[det.track_id].update(
                    frame_number=frame_number,
                    timestamp=timestamp,
                    confidence=det.confidence,
                )
            else:
                self.tracks[det.track_id] = TrackState(
                    track_id=det.track_id,
                    class_name=det.class_name,
                    first_seen_frame=frame_number,
                    timestamp=timestamp,
                    confidence=det.confidence,
                )

        # Update lost status for tracks not seen in this frame
        for tid, state in self.tracks.items():
            if tid not in current_frame_ids:
                if frame_number - state.last_seen_frame > self.max_lost_frames:
                    state.status = "LOST"

        self.active_ids = current_frame_ids
        return valid_detections

    def get_track_summary(self) -> Dict[int, Dict[str, any]]:
        """Return dict summary of all observed tracks."""
        return {
            tid: {
                "track_id": s.track_id,
                "class_name": s.class_name,
                "first_seen_frame": s.first_seen_frame,
                "last_seen_frame": s.last_seen_frame,
                "first_seen_timestamp": s.first_seen_timestamp,
                "last_seen_timestamp": s.last_seen_timestamp,
                "max_confidence": s.max_confidence,
                "average_confidence": s.average_confidence,
                "status": s.status,
            }
            for tid, s in self.tracks.items()
        }

    def reset(self) -> None:
        """Clear tracker states."""
        self.tracks.clear()
        self.active_ids.clear()
