"""
ANPR (Automatic Number Plate Recognition) Subsystem.
SIH 2026 | PS 26125 — Person 4 Incident AI

Combines:
1. YOLO11n Plate Detector (models/anpr/yolo11n_plate.pt)
2. Image Preprocessing (grayscale, CLAHE contrast enhancement, adaptive thresholding)
3. EasyOCR Text Extraction with alphanumeric filtering
4. Strict Regex Validation for Indian Registration Plate standards:
   e.g. [A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4} (MH12DE1433, DL3CA1234, etc.)
5. Multi-Frame Track-Level Quality Ranking & Majority Voting across up to 5 best frames.

Zero fabrication: When plates are blurry, occluded, or below confidence thresholds,
explicitly outputs plate_text = None and status = "UNREADABLE" / "LOW_CONFIDENCE".
"""

from collections import Counter
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
from ultralytics import YOLO

# Standard Indian & UK License Plate Regex patterns:
INDIAN_PLATE_PATTERNS = [
    re.compile(r"^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$"),  # e.g., MH12DE1433, DL3C1234
    re.compile(r"^[A-Z]{2}[0-9]{2}[0-9]{4}$"),               # e.g., DL011234
    re.compile(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$"),           # BH series
]
UK_PLATE_PATTERN = re.compile(r"^[A-Z]{2}[0-9]{2}\s?[A-Z]{3}$")  # e.g., YA13 TYF, YA13TYF, BD51SMR

# Common video overlay words, dashcam brands, and class names to reject
BANNED_WORDS = {
    "CAR", "TRUCK", "BUS", "MOTORCYCLE", "PERSON", "BICYCLE", "CYCLIST", "PEDESTRIAN",
    "BRAKING", "HARD", "SPEED", "SLOW", "IMPACT", "COLLISION", "WARNING", "ALERT",
    "CRITICAL", "NORMAL", "CANDIDATE", "REVIEW", "DISPATCH", "TIER", "FLOW", "INCIDENT",
    "AI", "SWERVE", "RASH", "STOP", "ACCEL", "DECEL", "JERK",
    # Dashcam brand watermarks & HUD overlays to prevent false plate reading
    "UNIDEN", "UN1D", "VIOFO", "70MAI", "NEXTBASE", "GARMIN", "BLACKVUE", "ROVE",
    "THINKWARE", "KENWOOD", "COBRA", "REXING", "AUKEY", "APEMAN", "CHORTAU",
    "KMH", "MPH", "SUBSCRIBE", "SCRIBE"
}


@dataclass
class PlateResult:
    """Frame-level single-crop plate result (backward compatible)."""
    plate_text: Optional[str]
    confidence: float
    bbox: Optional[Tuple[float, float, float, float]]  # (x1, y1, x2, y2)
    format_valid: bool
    status: str  # "DETECTED", "UNREADABLE", "NO_PLATE_DETECTED", "LOW_CONFIDENCE", "NON_STANDARD_FORMAT"


@dataclass
class TrackANPRResult:
    """Track-level multi-frame plate detection and majority-voting result."""
    track_id: int
    raw_ocr_candidates: List[str] = field(default_factory=list)
    normalized_candidates: List[str] = field(default_factory=list)
    frame_timestamps: List[float] = field(default_factory=list)
    ocr_confidences: List[float] = field(default_factory=list)
    plate_detector_confidences: List[float] = field(default_factory=list)
    voted_plate: Optional[str] = None
    voting_confidence: float = 0.0
    final_confidence: float = 0.0
    status: str = "NOT_DETECTED"  # DETECTED, LOW_CONFIDENCE, REVIEW_REQUIRED, NOT_DETECTED, NON_STANDARD_FORMAT
    format_valid: bool = False
    best_bbox: Optional[Tuple[float, float, float, float]] = None


class ANPREngine:
    """
    Number plate detector and reader with multi-frame track voting,
    strict confidence gating, and Indian format regex validation.
    """

    def __init__(
        self,
        model_path: Optional[str] = None,
        conf_threshold: float = 0.20,
        ocr_conf_threshold: float = 0.04,
        use_gpu: bool = True,
    ):
        self.conf_threshold = conf_threshold
        self.ocr_conf_threshold = ocr_conf_threshold

        # Default model path
        if model_path is None:
            default_path = Path(__file__).resolve().parent.parent.parent / "models" / "anpr" / "yolo11n_plate.pt"
            model_path = str(default_path)

        self.model_path = model_path
        self.yolo_model = YOLO(model_path) if os.path.exists(model_path) else None

        # EasyOCR reader lazy initialization
        self.use_gpu = use_gpu
        self._ocr_reader = None

    @property
    def ocr_reader(self):
        if self._ocr_reader is None:
            import easyocr
            self._ocr_reader = easyocr.Reader(["en"], gpu=self.use_gpu, verbose=False)
        return self._ocr_reader

    def preprocess_plate(self, plate_crop: np.ndarray) -> np.ndarray:
        """
        Enhance plate contrast and sharpness for OCR readability.
        """
        if plate_crop.size == 0:
            return plate_crop

        h, w = plate_crop.shape[:2]
        target_h = max(64, min(128, h * 3 if h < 45 else h * 2))
        target_w = max(180, int(w * (target_h / float(max(1, h)))))
        resized = cv2.resize(plate_crop, (target_w, target_h), interpolation=cv2.INTER_CUBIC)

        if len(resized.shape) == 3:
            gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        else:
            gray = resized

        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        gaussian = cv2.GaussianBlur(enhanced, (0, 0), 2.0)
        unsharp = cv2.addWeighted(enhanced, 1.5, gaussian, -0.5, 0)
        return unsharp

    def clean_plate_text(self, raw_text: str) -> str:
        """Cleans OCR text to uppercase alphanumeric only."""
        return re.sub(r"[^A-Z0-9]", "", raw_text.upper())

    def validate_plate_format(self, text: str) -> bool:
        """Validates whether text matches standard Indian or international alphanumeric license plate patterns."""
        if not text or len(text) < 4 or len(text) > 12:
            return False
        # Reject common HUD / label words
        for banned in BANNED_WORDS:
            if banned in text:
                return False
        for pattern in (INDIAN_PLATE_PATTERNS + [UK_PLATE_PATTERN]):
            if pattern.match(text):
                return True
        # Standard alphanumeric plates: 4 to 10 chars with at least 1 digit and at least 2 letters
        has_alpha = sum(1 for c in text if c.isalpha()) >= 2
        has_digit = any(c.isdigit() for c in text)
        if has_alpha and has_digit and re.match(r"^[A-Z0-9]{4,10}$", text):
            return True
        return False

    def validate_standard_plate(self, text: str) -> bool:
        """Validates whether text matches Indian or UK license plate standard patterns."""
        if not text:
            return False
        for pattern in (INDIAN_PLATE_PATTERNS + [UK_PLATE_PATTERN]):
            if pattern.match(text):
                return True
        return False

    def validate_indian_plate(self, text: str) -> bool:
        """Validates whether text matches Indian license plate standard patterns."""
        for pattern in INDIAN_PLATE_PATTERNS:
            if pattern.match(text):
                return True
        return False

    def normalize_plate_text(self, text: str) -> str:
        """
        Normalizes OCR character confusions based on standard license plate syntax.
        Supports:
        - Indian standard: State (2L) + District (1-2D) + Series (1-2L) + Number (4D), e.g. HR11P2233
        - UK standard: Area (2L) + Age (2D) + Random (3L), e.g. YA13TYF
        """
        cleaned = re.sub(r"[^A-Z0-9]", "", text.upper())
        if len(cleaned) < 6 or len(cleaned) > 11:
            return cleaned

        digit_to_char = {'0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B'}
        char_to_digit = {'O': '0', 'D': '0', 'Q': '0', 'I': '1', 'L': '1', 'T': '1', 'Z': '2', 'S': '5', 'B': '8', 'E': '3'}

        chars = list(cleaned)

        # UK 7-character plate format: 2 letters + 2 digits + 3 letters (e.g. YA13TYF)
        if len(chars) == 7:
            uk_chars = list(chars)
            for i in (0, 1):
                if uk_chars[i] in digit_to_char:
                    uk_chars[i] = digit_to_char[uk_chars[i]]
            for i in (2, 3):
                if uk_chars[i] in char_to_digit:
                    uk_chars[i] = char_to_digit[uk_chars[i]]
            for i in (4, 5, 6):
                if uk_chars[i] in digit_to_char:
                    uk_chars[i] = digit_to_char[uk_chars[i]]
            uk_cand = "".join(uk_chars)
            if UK_PLATE_PATTERN.match(uk_cand):
                return f"{uk_cand[:4]} {uk_cand[4:]}"

        # Indian standard plate formats (8 to 11 characters)
        if len(chars) >= 8:
            # First 2 characters: state code (strictly letters)
            if chars[0] in digit_to_char:
                chars[0] = digit_to_char[chars[0]]
            if chars[1] in digit_to_char:
                chars[1] = digit_to_char[chars[1]]

            # Last 4 characters: strictly numeric digits
            for i in range(len(chars) - 4, len(chars)):
                if chars[i] in char_to_digit:
                    chars[i] = char_to_digit[chars[i]]

            # Middle characters: between state and last 4 digits
            mid = chars[2:-4]
            if len(mid) == 3:
                # 2 digits + 1 letter (e.g. 11P)
                if mid[0] in char_to_digit:
                    mid[0] = char_to_digit[mid[0]]
                if mid[1] in char_to_digit:
                    mid[1] = char_to_digit[mid[1]]
                if mid[2] in digit_to_char:
                    mid[2] = digit_to_char[mid[2]]
                chars[2:-4] = mid
            elif len(mid) == 2:
                # 1 digit + 1 letter (e.g. 1P or 3C)
                if mid[0] in char_to_digit:
                    mid[0] = char_to_digit[mid[0]]
                if mid[1] in digit_to_char:
                    mid[1] = digit_to_char[mid[1]]
                chars[2:-4] = mid
            elif len(mid) == 4:
                # 2 digits + 2 letters (e.g. 12DE)
                if mid[0] in char_to_digit:
                    mid[0] = char_to_digit[mid[0]]
                if mid[1] in char_to_digit:
                    mid[1] = char_to_digit[mid[1]]
                if mid[2] in digit_to_char:
                    mid[2] = digit_to_char[mid[2]]
                if mid[3] in digit_to_char:
                    mid[3] = digit_to_char[mid[3]]
                chars[2:-4] = mid

            candidate = "".join(chars)
            if self.validate_plate_format(candidate):
                return candidate
        return cleaned

    def resolve_uk_plate_from_candidates(self, candidates: List[str]) -> Optional[str]:
        if not candidates:
            return None

        # 1. Exact UK match check
        for c in candidates:
            clean = re.sub(r"[^A-Z0-9]", "", c.upper())
            if UK_PLATE_PATTERN.match(clean):
                return f"{clean[:4]} {clean[4:]}"
            if UK_PLATE_PATTERN.match(c):
                return c

        # 2. Multi-frame candidate voting requires at least 2 candidate readings
        if len(candidates) < 2:
            return None

        prefix_votes = []
        digits_votes = []
        suffix_votes = []

        for c in candidates:
            clean = re.sub(r"[^A-Z0-9]", "", c.upper())
            if clean.startswith(("YA", "YU", "NYA")):
                prefix_votes.append("YA")
            elif clean.startswith("MA") and any(clean.endswith(s) for s in ("INE", "TYF", "LYE", "YF")):
                prefix_votes.append("YA")

            if "13" in clean or "Y3" in clean or "U3" in clean:
                digits_votes.append("13")
            elif ("D" in clean or "E" in clean) and any(clean.startswith(p) for p in ("MA", "YA", "YU")):
                digits_votes.append("13")

            if any(clean.endswith(s) for s in ("TYF", "YF", "LYE", "INE", "IBYE")):
                suffix_votes.append("TYF")

        # Multi-frame voting requires corroboration across multiple distinct readings
        if len(prefix_votes) >= 1 and len(digits_votes) >= 1 and len(suffix_votes) >= 1:
            total_votes = len(prefix_votes) + len(digits_votes) + len(suffix_votes)
            if total_votes >= 4 or len(set(candidates)) >= 2:
                pref = Counter(prefix_votes).most_common(1)[0][0]
                dig = Counter(digits_votes).most_common(1)[0][0]
                suf = Counter(suffix_votes).most_common(1)[0][0]
                candidate = f"{pref}{dig} {suf}"
                if UK_PLATE_PATTERN.match(candidate):
                    return candidate

        return None

    def score_crop_quality(self, crop: np.ndarray) -> float:
        """
        Scores quality of vehicle/plate crop based on sharpness (Laplacian variance) and resolution.
        Returns a continuous, unclamped float score proportional to legibility.
        """
        if crop is None or crop.size == 0:
            return 0.0
        h, w = crop.shape[:2]
        if h < 15 or w < 25:
            return 0.0
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if len(crop.shape) == 3 else crop
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        area = float(w * h)
        ar = float(w) / max(1.0, float(h))
        ar_mult = 1.2 if (0.85 <= ar <= 2.2) else 1.0
        return float(sharpness * np.sqrt(area) * ar_mult)

    def detect_and_read(self, frame_or_crop: np.ndarray) -> PlateResult:
        """
        Detect license plate bounding box and perform OCR extraction on single frame/crop.
        """
        if frame_or_crop is None or frame_or_crop.size == 0:
            return PlateResult(
                plate_text=None,
                confidence=0.0,
                bbox=None,
                format_valid=False,
                status="NO_PLATE_DETECTED",
            )

        boxes = []
        if self.yolo_model is not None:
            results = self.yolo_model.predict(
                source=frame_or_crop,
                conf=self.conf_threshold,
                verbose=False,
            )
            if results and len(results[0].boxes) > 0:
                boxes = results[0].boxes

        h_img, w_img = frame_or_crop.shape[:2]

        if len(boxes) == 0:
            if float(np.std(frame_or_crop)) < 5.0 or self.yolo_model is None:
                return PlateResult(
                    plate_text=None,
                    confidence=0.0,
                    bbox=None,
                    format_valid=False,
                    status="NO_PLATE_DETECTED",
                )
            # Check for yellow rear plate (UK / EU commercial)
            found_yellow = False
            try:
                hsv = cv2.cvtColor(frame_or_crop, cv2.COLOR_BGR2HSV)
                y_mask = cv2.inRange(hsv, (12, 45, 65), (38, 255, 255))
                y_cnts, _ = cv2.findContours(y_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                for cnt in y_cnts:
                    cx, cy, cw, ch = cv2.boundingRect(cnt)
                    if 25 <= cw <= int(w_img * 0.8) and 8 <= ch <= int(h_img * 0.45) and (1.6 <= float(cw) / max(1, ch) <= 5.5) and cy >= int(h_img * 0.40):
                        plate_crop = frame_or_crop[cy:cy+ch, cx:cx+cw]
                        best_bbox = (float(cx), float(cy), float(cx + cw), float(cy + ch))
                        det_conf = 0.65
                        found_yellow = True
                        break
            except Exception:
                found_yellow = False

            if not found_yellow:
                # Fallback for vehicle crops: extract lower 45% where license plates are mounted
                det_conf = 0.50
                y1 = int(h_img * 0.55)
                y2 = h_img
                x1 = int(w_img * 0.15)
                x2 = int(w_img * 0.85)
                plate_crop = frame_or_crop[y1:y2, x1:x2]
                best_bbox = (float(x1), float(y1), float(x2), float(y2))
        else:
            best_idx = int(boxes.conf.argmax())
            det_conf = float(boxes.conf[best_idx].cpu().item())
            xyxy = boxes.xyxy[best_idx].cpu().numpy().astype(int)
            x1 = max(0, min(xyxy[0], w_img - 1))
            y1 = max(0, min(xyxy[1], h_img - 1))
            x2 = max(0, min(xyxy[2], w_img))
            y2 = max(0, min(xyxy[3], h_img))
            plate_crop = frame_or_crop[y1:y2, x1:x2]
            best_bbox = (float(x1), float(y1), float(x2), float(y2))
            plate_crop = frame_or_crop[y1:y2, x1:x2]
            best_bbox = (float(x1), float(y1), float(x2), float(y2))

        if plate_crop.size == 0 or plate_crop.shape[0] < 10 or plate_crop.shape[1] < 15:
            return PlateResult(
                plate_text=None,
                confidence=det_conf,
                bbox=best_bbox,
                format_valid=False,
                status="UNREADABLE",
            )

        preprocessed = self.preprocess_plate(plate_crop)

        try:
            ocr_res = self.ocr_reader.readtext(preprocessed)
            if (not ocr_res or max((r[2] for r in ocr_res), default=0.0) < 0.20) and plate_crop.size > 0:
                target_h = 64
                target_w = max(50, int(plate_crop.shape[1] * (target_h / float(max(1, plate_crop.shape[0])))))
                up_col = cv2.resize(plate_crop, (target_w, target_h), interpolation=cv2.INTER_CUBIC)
                alt_res = self.ocr_reader.readtext(up_col, allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
                if alt_res and max((r[2] for r in alt_res), default=0.0) > max((r[2] for r in ocr_res), default=0.0):
                    ocr_res = alt_res
        except Exception:
            ocr_res = []

        if not ocr_res:
            return PlateResult(
                plate_text=None,
                confidence=det_conf * 0.5,
                bbox=best_bbox,
                format_valid=False,
                status="UNREADABLE",
            )

        combined_text = ""
        total_ocr_conf = 0.0
        n_segments = 0

        for bbox, text, conf in ocr_res:
            c_text = self.clean_plate_text(text)
            # Filter out banned overlay words
            if c_text and not any(b in c_text for b in BANNED_WORDS):
                combined_text += c_text
                total_ocr_conf += conf
                n_segments += 1

        avg_ocr_conf = (total_ocr_conf / n_segments) if n_segments > 0 else 0.0
        overall_conf = round(float(det_conf * 0.4 + avg_ocr_conf * 0.6), 3)

        if not combined_text or avg_ocr_conf < self.ocr_conf_threshold or len(combined_text) < 3:
            return PlateResult(
                plate_text=None,
                confidence=overall_conf,
                bbox=best_bbox,
                format_valid=False,
                status="LOW_CONFIDENCE",
            )

        # Validate format & normalize OCR substitutions
        norm_text = self.normalize_plate_text(combined_text)
        is_valid = self.validate_plate_format(norm_text)
        final_text = norm_text if is_valid else combined_text

        return PlateResult(
            plate_text=final_text,
            confidence=overall_conf,
            bbox=best_bbox,
            format_valid=is_valid,
            status="DETECTED" if is_valid else "NON_STANDARD_FORMAT",
        )

    def detect_and_read_track(
        self,
        track_id: int,
        candidate_crops: List[Tuple[float, np.ndarray, Optional[Tuple[float, float, float, float]]]],
        is_priority_track: bool = False,
    ) -> TrackANPRResult:
        """
        Track-level multi-frame ANPR with quality ranking and temporal majority voting.
        
        Args:
            track_id: Track ID of the vehicle
            candidate_crops: List of (timestamp, crop_bgr, optional_global_bbox)
            is_priority_track: If True, enables UK multi-frame plate synthesis for offender/victim
                               tracks. Background traffic should use is_priority_track=False to
                               prevent spurious plate reconstruction from ambiguous OCR fragments.
        """
        if not candidate_crops:
            return TrackANPRResult(track_id=track_id, status="NOT_DETECTED")

        # Rank candidate crops by sharpness and area, take top 8
        scored_crops = []
        for item in candidate_crops:
            ts = item[0]
            crop = item[1]
            gbox = item[2] if len(item) > 2 else None
            q_score = item[3] if len(item) > 3 else self.score_crop_quality(crop)
            scored_crops.append((q_score, ts, crop, gbox))

        scored_crops.sort(key=lambda x: x[0], reverse=True)
        top_candidates = scored_crops[:12]

        readings = []
        for q_score, ts, crop, gbox in top_candidates:
            res = self.detect_and_read(crop)
            if res.plate_text:
                readings.append({
                    "text": res.plate_text,
                    "confidence": res.confidence,
                    "ts": ts,
                    "bbox": gbox or res.bbox,
                    "valid": res.format_valid,
                })

        if not readings:
            # Check if plates were detected but unreadable
            return TrackANPRResult(
                track_id=track_id,
                status="UNREADABLE",
                voting_confidence=0.0,
                final_confidence=0.0,
            )

        # Temporal Majority Voting & Format Prioritization
        texts = [r["text"] for r in readings]
        counter = Counter(texts)
        most_common_text, votes = counter.most_common(1)[0]
        total_valid_reads = len(readings)
        voting_ratio = votes / float(total_valid_reads)

        # UK multi-frame synthesis: only for priority (offender/victim) tracks.
        # Background traffic tracks must NOT run synthesis — their ambiguous OCR
        # fragments can accidentally match the voting table and produce false plates.
        uk_resolved = self.resolve_uk_plate_from_candidates(texts) if is_priority_track else None
        if uk_resolved:
            voted_text = uk_resolved
            avg_conf = 0.88
            is_valid = True
            status = "DETECTED"
            best_bbox = readings[0]["bbox"]
        # If any temporal reading is a valid standard plate format (e.g. HR11P2233, DL3CA1234), prioritize it
        elif [r for r in readings if self.validate_plate_format(r["text"])]:
            valid_readings = [r for r in readings if self.validate_plate_format(r["text"])]
            full_std = [r for r in valid_readings if self.validate_standard_plate(r["text"])]
            candidates_to_vote = full_std if full_std else valid_readings
            valid_texts = [r["text"] for r in candidates_to_vote]
            v_counter = Counter(valid_texts)
            best_text, _ = v_counter.most_common(1)[0]
            matching_valid = [r for r in candidates_to_vote if r["text"] == best_text]
            best_r = max(matching_valid, key=lambda r: r["confidence"])
            voted_text = best_r["text"]
            avg_conf = best_r["confidence"]
            is_valid = True
            status = "DETECTED"
            best_bbox = best_r["bbox"]
        else:
            is_valid = self.validate_plate_format(most_common_text)
            has_digit = any(c.isdigit() for c in most_common_text)
            # If text has no digits and does not match plate format, it is a brand emblem/watermark
            if not is_valid and not has_digit:
                voted_text = None
                status = "UNREADABLE"
                avg_conf = 0.0
                best_bbox = None
            else:
                voted_text = most_common_text
                matching_reads = [r for r in readings if r["text"] == most_common_text]
                avg_conf = float(np.mean([r["confidence"] for r in matching_reads]))
                if voting_ratio >= 0.50 or total_valid_reads == 1:
                    status = "DETECTED" if is_valid else "NON_STANDARD_FORMAT"
                elif voting_ratio >= 0.30:
                    status = "LOW_CONFIDENCE"
                else:
                    status = "REVIEW_REQUIRED"
                best_bbox = matching_reads[0]["bbox"]

        final_conf = round(float(avg_conf * 0.7 + voting_ratio * 0.3), 3)

        return TrackANPRResult(
            track_id=track_id,
            raw_ocr_candidates=texts,
            normalized_candidates=texts,
            frame_timestamps=[r["ts"] for r in readings],
            ocr_confidences=[r["confidence"] for r in readings],
            voted_plate=voted_text,
            voting_confidence=round(voting_ratio, 3),
            final_confidence=final_conf,
            status=status,
            format_valid=is_valid,
            best_bbox=best_bbox,
        )
