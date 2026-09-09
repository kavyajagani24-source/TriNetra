"""
Privacy Anonymiser — The Sixth Sense
In-memory privacy masking before evidence frame writes.
Faces and plates are blurred before any frame is saved to disk.
Raw video frames are NOT saved.
"""
from __future__ import annotations
import cv2
import numpy as np
import logging
from typing import List, Optional

from sixth_sense.schemas.urban_event import Detection, EventType

logger = logging.getLogger(__name__)

# Classes requiring face-region blur
_FACE_BLUR_CLASSES = {"person"}
# Classes where full bbox is blurred (plate blurring applied separately if ANPR active)
_PLATE_BLUR_CLASSES = set()  # Populated if ANPR is added in Phase F


class Anonymiser:
    """
    In-memory privacy anonymiser.

    Operates on a frame copy in memory — does NOT write raw frames.
    All masking is done before any disk write.

    Face blurring: Blurs the top fraction of person bounding boxes
    (face region estimate).  This is a conservative visual approach —
    no face detection model required for Phase A.
    """

    def __init__(
        self,
        blur_faces: bool = True,
        blur_plates: bool = True,
        face_region_top_fraction: float = 0.45,
        blur_kernel_size: int = 35,
    ) -> None:
        self.blur_faces = blur_faces
        self.blur_plates = blur_plates
        self.face_fraction = face_region_top_fraction
        # Ensure kernel is odd
        k = blur_kernel_size if blur_kernel_size % 2 == 1 else blur_kernel_size + 1
        self.blur_k = (k, k)

    def anonymise(
        self,
        frame: np.ndarray,
        detections: List[Detection],
    ) -> np.ndarray:
        """
        Return a privacy-masked copy of the frame.
        Original frame is NOT modified.

        Args:
            frame: BGR image
            detections: list of Detection objects from this frame

        Returns:
            Masked BGR image (copy)
        """
        result = frame.copy()
        h, w = result.shape[:2]

        for det in detections:
            x1, y1, x2, y2 = det.bbox

            if self.blur_faces and det.class_name in _FACE_BLUR_CLASSES:
                # Blur top fraction of person bbox (face region estimate)
                face_y2 = int(y1 + (y2 - y1) * self.face_fraction)
                face_y2 = min(face_y2, h)
                rx1, ry1 = max(0, x1), max(0, y1)
                rx2, ry2 = min(w, x2), face_y2
                if rx2 > rx1 and ry2 > ry1:
                    roi = result[ry1:ry2, rx1:rx2]
                    blurred = cv2.GaussianBlur(roi, self.blur_k, 0)
                    result[ry1:ry2, rx1:rx2] = blurred

            elif self.blur_plates and det.class_name in _PLATE_BLUR_CLASSES:
                # Full bbox blur for plate regions (Phase F)
                rx1, ry1 = max(0, x1), max(0, y1)
                rx2, ry2 = min(w, x2), min(h, y2)
                if rx2 > rx1 and ry2 > ry1:
                    roi = result[ry1:ry2, rx1:rx2]
                    blurred = cv2.GaussianBlur(roi, self.blur_k, 0)
                    result[ry1:ry2, rx1:rx2] = blurred

        return result
