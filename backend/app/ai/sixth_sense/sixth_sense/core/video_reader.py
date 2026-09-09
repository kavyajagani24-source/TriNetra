"""
Video Reader — The Sixth Sense
Adapted from Time Compression Engine VideoReader.
Key change: read_frames() is now a streaming GENERATOR (not load-all-to-RAM).
Large bus video files (>1 GB) must NOT be loaded entirely into memory.
"""
from __future__ import annotations
import cv2
import logging
from typing import Iterator, Optional, Dict, Any

logger = logging.getLogger(__name__)


class VideoReader:
    """
    Streaming video reader backed by OpenCV VideoCapture.
    Reused from TCE; adapted to yield frames rather than accumulate a list.
    """

    def __init__(self, video_path: str) -> None:
        self.video_path = video_path
        self.cap = cv2.VideoCapture(video_path)
        if not self.cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        self.fps: float = self.cap.get(cv2.CAP_PROP_FPS) or 30.0
        self.total_frames: int = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.width: int = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self.height: int = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self.duration_sec: float = self.total_frames / self.fps if self.fps > 0 else 0.0

        logger.info(
            "VideoReader opened: %s | %.0f fps | %dx%d | %.1fs | %d frames",
            video_path, self.fps, self.width, self.height,
            self.duration_sec, self.total_frames,
        )

    # ------------------------------------------------------------------ #
    # Streaming generator (ADAPTED from TCE — was load-all list)
    # ------------------------------------------------------------------ #

    def stream_frames(self, target_fps: Optional[float] = None) -> Iterator[Dict[str, Any]]:
        """
        Stream frames as a generator.  Never loads the whole video into RAM.

        Args:
            target_fps: If given, only yield frames that fall on the target
                        sampling grid.  None means yield every frame.

        Yields:
            dict with keys: frame, index, timestamp, time_str
        """
        skip = max(1, round(self.fps / target_fps)) if target_fps else 1
        self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        frame_idx = 0

        while True:
            ret, frame = self.cap.read()
            if not ret:
                break
            if frame_idx % skip == 0:
                timestamp = frame_idx / self.fps
                yield {
                    "frame": frame,
                    "index": frame_idx,
                    "timestamp": timestamp,
                    "time_str": self._fmt(timestamp),
                }
            frame_idx += 1

        logger.debug("stream_frames exhausted at frame %d", frame_idx)

    # ------------------------------------------------------------------ #
    # Random access (kept from TCE — used by annotated writer for evidence)
    # ------------------------------------------------------------------ #

    def get_frame_at(self, frame_idx: int) -> Optional[Any]:
        """Seek to a specific frame index and return it."""
        self.cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = self.cap.read()
        return frame if ret else None

    def get_frame_at_time(self, seconds: float) -> Optional[Any]:
        """Return the frame closest to the given timestamp (seconds)."""
        frame_num = int(seconds * self.fps)
        return self.get_frame_at(frame_num)

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _fmt(seconds: float) -> str:
        m = int(seconds // 60)
        s = int(seconds % 60)
        return f"{m:02d}:{s:02d}"

    def release(self) -> None:
        self.cap.release()

    def __repr__(self) -> str:
        return (
            f"VideoReader('{self.video_path}', "
            f"{self.width}x{self.height}, {self.fps:.0f}fps)"
        )
