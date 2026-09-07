"""
UrbanEye AI — Video Processor

Context manager wrapping OpenCV VideoCapture for robust frame streaming,
metadata extraction, and resource cleanup.
"""

from __future__ import annotations

import logging
from typing import Generator, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)


class VideoProcessor:
    """
    Safely opens, streams, and inspects video files using OpenCV.
    """

    def __init__(self, video_path: str):
        self.video_path = video_path
        self._cap: Optional[cv2.VideoCapture] = None
        self._fps: float = 0.0
        self._width: int = 0
        self._height: int = 0
        self._total_frames: int = 0

    def open(self) -> None:
        """Open video stream and read properties."""
        self._cap = cv2.VideoCapture(self.video_path)
        if not self._cap.isOpened():
            raise ValueError(f"Could not open video file at '{self.video_path}'")

        self._fps = float(self._cap.get(cv2.CAP_PROP_FPS)) or 30.0
        self._width = int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self._height = int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self._total_frames = int(self._cap.get(cv2.CAP_PROP_FRAME_COUNT))

    def close(self) -> None:
        """Release video resources."""
        if self._cap is not None:
            self._cap.release()
            self._cap = None

    def __enter__(self) -> VideoProcessor:
        self.open()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()

    @property
    def fps(self) -> float:
        return self._fps

    @property
    def width(self) -> int:
        return self._width

    @property
    def height(self) -> int:
        return self._height

    @property
    def total_frames(self) -> int:
        return self._total_frames

    @property
    def duration_seconds(self) -> float:
        return self._total_frames / self._fps if self._fps > 0 else 0.0

    def read_frames(self, step_n: int = 1) -> Generator[Tuple[int, float, np.ndarray], None, None]:
        """
        Yield (frame_number, timestamp_seconds, frame_bgr) skipping frames if step_n > 1.
        """
        if self._cap is None or not self._cap.isOpened():
            raise RuntimeError("VideoCapture is not opened. Use context manager or call open().")

        frame_num = 0
        while True:
            ret, frame = self._cap.read()
            if not ret or frame is None:
                break

            frame_num += 1

            if step_n > 1 and (frame_num - 1) % step_n != 0:
                continue

            timestamp = (frame_num - 1) / self._fps if self._fps > 0 else 0.0
            yield (frame_num, timestamp, frame)
