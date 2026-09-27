"""
Incident Evidence Packet Generator.

Creates tamper-evident forensic artifact packages under:
outputs/api_runs/incident/<run_id>/
├── before.jpg            # Pre-incident context frame
├── during.jpg            # Peak incident / impact frame
├── after.jpg             # Post-incident aftermath frame
├── annotated.mp4         # Rendered annotated video stream
├── incident.json         # Complete incident alert record
└── evidence_manifest.json# Cryptographic SHA-256 checksums and file manifests
"""

import hashlib
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np


def compute_sha256(file_path: Path) -> str:
    """Compute cryptographic SHA-256 hash of a file."""
    sha = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            sha.update(chunk)
    return sha.hexdigest()


class EvidenceManager:
    """
    Manages generation, storage, and cryptographic validation of incident evidence packets.
    """

    def __init__(self, base_output_dir: Optional[Path] = None):
        if base_output_dir is None:
            self.base_output_dir = Path(__file__).resolve().parent.parent.parent / "outputs" / "api_runs" / "incident"
        else:
            self.base_output_dir = Path(base_output_dir)
        self.base_output_dir.mkdir(parents=True, exist_ok=True)

    def extract_keyframes(
        self,
        video_path: str,
        peak_timestamp_sec: Optional[float] = None,
        duration_sec: float = 0.0,
        run_dir: Optional[Path] = None,
    ) -> Dict[str, Optional[str]]:
        """
        Extracts before, during, and after keyframes from video.
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {"before": None, "during": None, "after": None}

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        v_dur = total_frames / fps if total_frames > 0 else duration_sec

        if total_frames <= 1:
            cap.release()
            return {"before": None, "during": None, "after": None}

        max_valid_idx = max(0, total_frames - 2)

        if peak_timestamp_sec is None or peak_timestamp_sec <= 0:
            peak_timestamp_sec = v_dur / 2.0

        # Prevent peak from collapsing into the extreme boundary of video
        if v_dur > 2.5:
            peak_timestamp_sec = min(max(0.8, peak_timestamp_sec), v_dur - 0.8)

        # Enforce distinct temporal separation between keyframes:
        # Before: genuine pre-incident baseline (approaching traffic, normal flow)
        # During: impact / peak interaction moment
        # After: stationary resting aftermath or departure
        f_during = int(round(peak_timestamp_sec * fps))
        f_during = min(max(1, f_during), max_valid_idx)

        gap_before = max(int(fps * 2.5), int(total_frames * 0.25))
        f_before = max(0, f_during - gap_before)
        if f_before >= f_during:
            f_before = max(0, int(total_frames * 0.15))

        gap_after = min(int(fps * 2.0), int(total_frames * 0.20))
        f_after = min(int(total_frames * 0.92), f_during + gap_after)
        if f_after <= f_during:
            f_after = min(int(total_frames * 0.90), f_during + int(fps * 0.5))

        min_step = max(2, int(fps * 0.5))
        if f_during <= f_before:
            f_during = min(max_valid_idx - 1, f_before + min_step)
        if f_after <= f_during:
            f_after = min(max_valid_idx, f_during + min_step)

        targets = {
            "before.jpg": (f_before, f"BEFORE (T: {f_before / fps:.1f}s)", (88, 166, 255)),
            "during.jpg": (f_during, f"DURING IMPACT (T: {f_during / fps:.1f}s)", (0, 0, 255)),
            "after.jpg": (f_after, f"AFTERMATH (T: {f_after / fps:.1f}s)", (63, 185, 80)),
        }

        extracted_paths = {}
        for fname, (idx, badge_text, badge_color) in targets.items():
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            curr_idx = idx
            step_back = 5
            while (not ret or frame is None) and curr_idx > step_back:
                curr_idx -= step_back
                cap.set(cv2.CAP_PROP_POS_FRAMES, curr_idx)
                ret, frame = cap.read()
                step_back += 5

            if ret and frame is not None and run_dir:
                # Add professional HUD badge on evidence snapshot
                h_img, w_img = frame.shape[:2]
                cv2.rectangle(frame, (12, 12), (320, 48), (20, 20, 20), -1)
                cv2.rectangle(frame, (12, 12), (320, 48), badge_color, 2)
                cv2.putText(frame, badge_text, (20, 36), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

                save_path = run_dir / fname
                cv2.imwrite(str(save_path), frame)
                extracted_paths[fname.replace(".jpg", "")] = str(save_path)
            else:
                extracted_paths[fname.replace(".jpg", "")] = None

        cap.release()
        return extracted_paths


    def create_packet(
        self,
        run_id: str,
        incident_data: Dict[str, Any],
        video_path: str,
        peak_timestamp_sec: Optional[float],
        annotated_video_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Builds complete evidence directory, saves JSON records, and writes manifest.
        """
        run_dir = self.base_output_dir / run_id
        run_dir.mkdir(parents=True, exist_ok=True)

        # 1. Extract keyframes
        keyframes = self.extract_keyframes(
            video_path=video_path,
            peak_timestamp_sec=peak_timestamp_sec,
            run_dir=run_dir,
        )

        def make_rel(p_name: str) -> Optional[str]:
            p = run_dir / p_name
            return f"outputs/api_runs/incident/{run_id}/{p_name}" if p.exists() else None

        evidence_info = {
            "packet_id": f"EV-INC-{run_id[:8].upper()}",
            "output_dir": str(run_dir).replace("\\", "/"),
            "before_image_url": make_rel("before.jpg"),
            "during_image_url": make_rel("during.jpg"),
            "after_image_url": make_rel("after.jpg"),
            "annotated_video_url": make_rel("annotated.mp4"),
            "manifest_url": make_rel("evidence_manifest.json"),
            "incident_json_url": make_rel("incident.json"),
        }
        incident_data["evidence"] = evidence_info

        # 2. Save incident.json
        incident_json_path = run_dir / "incident.json"
        with open(incident_json_path, "w", encoding="utf-8") as f:
            json.dump(incident_data, f, indent=2, default=str)

        # 3. Create Evidence Manifest with SHA-256 checksums
        manifest_files = {}
        for item in run_dir.iterdir():
            if item.is_file() and item.name != "evidence_manifest.json":
                manifest_files[item.name] = {
                    "size_bytes": item.stat().st_size,
                    "sha256": compute_sha256(item),
                    "relative_path": str(Path("outputs") / "api_runs" / "incident" / run_id / item.name).replace("\\", "/"),
                }

        manifest_data = {
            "packet_id": evidence_info["packet_id"],
            "run_id": run_id,
            "created_at": incident_data.get("timestamp"),
            "file_count": len(manifest_files),
            "files": manifest_files,
        }

        manifest_path = run_dir / "evidence_manifest.json"
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, indent=2)

        return evidence_info
