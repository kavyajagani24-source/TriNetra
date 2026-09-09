"""
Frame Scheduler — The Sixth Sense
Configurable adaptive FPS: 1 / 2 / 3 / 5 / native.
Supports event-triggered burst sampling around candidate incidents.
"""
from __future__ import annotations
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Supported target FPS values
SUPPORTED_FPS = {1, 2, 3, 5, "native"}


class FrameScheduler:
    """
    Determines which frames to process given the video native FPS
    and a configured target FPS.

    Event-triggered burst: when an incident candidate is active,
    temporarily processes every frame for a configurable window.
    """

    def __init__(self, native_fps: float, target_fps: int | str = 3) -> None:
        if target_fps not in SUPPORTED_FPS:
            raise ValueError(
                f"target_fps must be one of {SUPPORTED_FPS}, got {target_fps!r}"
            )
        self.native_fps = native_fps
        self.target_fps: float = native_fps if target_fps == "native" else float(target_fps)

        # Skip factor: process every Nth frame
        self._skip = max(1, round(native_fps / self.target_fps))

        # Burst mode state
        self._burst_until_frame: int = -1
        self._burst_reason: Optional[str] = None

        logger.info(
            "FrameScheduler: native=%.1f fps, target=%.1f fps, skip=%d",
            native_fps, self.target_fps, self._skip,
        )

    # ------------------------------------------------------------------ #
    # Core decision
    # ------------------------------------------------------------------ #

    def should_process(self, frame_idx: int) -> bool:
        """Return True if this frame should be sent to inference."""
        if frame_idx <= self._burst_until_frame:
            return True  # burst mode: process every frame
        return frame_idx % self._skip == 0

    # ------------------------------------------------------------------ #
    # Burst mode
    # ------------------------------------------------------------------ #

    def trigger_burst(
        self,
        from_frame: int,
        duration_frames: int = 90,
        reason: str = "incident_candidate",
    ) -> None:
        """
        Temporarily increase processing rate to native FPS.
        Used when a candidate incident (sudden trajectory change, collision
        signature, etc.) is detected.
        """
        self._burst_until_frame = from_frame + duration_frames
        self._burst_reason = reason
        logger.info(
            "Burst mode activated at frame %d for %d frames: %s",
            from_frame, duration_frames, reason,
        )

    @property
    def in_burst(self) -> bool:
        return self._burst_until_frame >= 0

    # ------------------------------------------------------------------ #
    # Timing helpers
    # ------------------------------------------------------------------ #

    def effective_period_sec(self) -> float:
        """Seconds between processed frames at current target rate."""
        return 1.0 / self.target_fps

    def frame_to_timestamp(self, frame_idx: int) -> float:
        return frame_idx / self.native_fps
