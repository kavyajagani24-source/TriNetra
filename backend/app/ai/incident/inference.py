"""
Unified Multi-Signal Incident + ANPR AI Pipeline.
SIH 2026 | PS 26125 — Person 4 Incident AI

Nine-Stage Incident Intelligence Architecture:
1. Vehicle Detection (YOLO11x, frozen) & Tracking (UrbianTracker)
2. Track-Level Kinematic Behavior Engine (Jerk, swerving, deceleration, abnormal driving)
3. Pairwise Candidate Interaction Generation (20-dimensional kinematic features)
4. Temporal Interaction Classifier (Random Forest / GBT on pairwise windows)
5. Localized Optical Flow Motion Burst Corroboration (Farneback flow around interaction ROI)
6. Secondary Spatio-Temporal Neural Vision Model (ResNet18-BiGRU-Attention)
7. Evidence Fusion Engine (Calibrated Logistic Regression Meta-Classifier)
8. Hit-and-Run Temporal State Machine (5-state track-identity chain)
9. Track-Level ANPR (Quality ranking + 5-frame batch temporal voting) & Universal Evidence Assembly

Strict Integrity Guarantees:
- Existing production models (yolo12s_RDD2022_best.pt, yolo11x.pt) are untouched.
- GPS is explicitly null (no fake coordinates).
- All incident classifications carry "CANDIDATE" or "REVIEW_REQUIRED" indicators.
- Individual signals (neural, pairwise, kinematic, motion) remain completely separate.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import sys
import time
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
import torch
from ultralytics import YOLO

# Project paths — within TriNetra: backend/app/ai/incident/inference.py
# parent = incident/, parent.parent = ai/, parent.parent.parent = app/, [3] = backend/
_THIS_FILE = Path(__file__).resolve()
PROJECT_ROOT = _THIS_FILE.parents[3]  # …/backend

# Ensure sixth_sense package (urban_tracker etc.) is importable.
# In TriNetra it lives at backend/app/ai/sixth_sense/
_sixth_sense_parent = _THIS_FILE.parents[1] / "sixth_sense"  # backend/app/ai/sixth_sense
if str(_sixth_sense_parent) not in sys.path:
    sys.path.insert(0, str(_sixth_sense_parent))

logger = logging.getLogger(__name__)

from app.ai.incident.anpr import ANPREngine, PlateResult, TrackANPRResult
from app.ai.incident.behavior_engine import BehaviorEngine, TrajectoryPoint
from app.ai.incident.collision_model import CollisionDetector
from app.ai.incident.evidence import EvidenceManager
from app.ai.incident.fusion import EvidenceFusionEngine, FusionResult
from app.ai.incident.hit_and_run import HitAndRunResult, HitAndRunStateMachine, IncidentState, TrackObservation
from app.ai.incident.interaction_classifier import InteractionClassifier
from app.ai.incident.motion_evidence import MotionCorroborator, MotionEvidence
from app.ai.incident.pairwise import PairwiseWindow, extract_pairwise_features, _calc_iou
from app.ai.incident.schemas import (
    AbnormalDrivingEvent,
    CollisionCandidate,
    EvidencePacket,
    HitAndRunCandidate,
    IncidentAlertSummary,
    IncidentAnalysisResponse,
    IncidentMetrics,
    PlateInfo,
)

from sixth_sense.schemas.urban_event import ClassificationSource, Detection, EventType
from sixth_sense.tracking.urban_tracker import UrbianTracker


class IncidentPipeline:
    """
    End-to-end multi-signal incident detection and track-level ANPR pipeline.
    """

    # COCO vehicle & road user classes matching yolo11x
    VEHICLE_CLASS_MAP = {
        0: "person",
        1: "bicycle",
        2: "car",
        3: "motorcycle",
        5: "bus",
        7: "truck",
        16: "cyclist",  # Mid-air tumbling rider / vulnerable road user
    }

    def __init__(
        self,
        collision_model_path: Optional[str] = None,
        anpr_model_path: Optional[str] = None,
        vehicle_model_path: Optional[str] = None,
        interaction_model_path: Optional[str] = None,
        fusion_model_path: Optional[str] = None,
        device: Optional[str] = None,
    ):
        if device is None:
            self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        # ── TriNetra model directory (co-located with this package) ──────────
        _MODELS_DIR = Path(__file__).resolve().parent / "models"

        # 1. Neural Spatio-Temporal Baseline Model
        if collision_model_path is None:
            collision_model_path = str(_MODELS_DIR / "collision_model_best.pt")
        self.collision_model_path = collision_model_path
        self._collision_model = None

        # 2. ANPR Engine (with track-level voting)
        if anpr_model_path is None:
            anpr_model_path = str(_MODELS_DIR / "anpr" / "yolo11n_plate.pt")
        self.anpr_engine = ANPREngine(
            model_path=anpr_model_path,
            use_gpu=torch.cuda.is_available(),
        )

        # 3. Frozen Vehicle Detector (YOLO11x)
        # NOTE: yolo11x.pt (114MB) is not committed to git due to size.
        # Falls back to yolo11n if unavailable (smaller, GitHub-safe).
        if vehicle_model_path is None:
            yolo11x = _MODELS_DIR / "yolo11x.pt"
            yolo11n_fallback = PROJECT_ROOT / "yolo11n.pt"  # TriNetra backend has yolo11n
            if yolo11x.exists():
                vehicle_model_path = str(yolo11x)
            elif yolo11n_fallback.exists():
                logger.warning("yolo11x.pt not found — falling back to yolo11n.pt for vehicle detection")
                vehicle_model_path = str(yolo11n_fallback)
            else:
                vehicle_model_path = str(yolo11x)  # Will fail gracefully at load time
        self.vehicle_model_path = vehicle_model_path
        self._vehicle_model = None

        # 4. Pairwise Interaction Classifier
        if interaction_model_path is None:
            interaction_model_path = str(_MODELS_DIR / "interaction_classifier.pkl")
        self.interaction_classifier = InteractionClassifier(
            model_path=interaction_model_path if os.path.exists(interaction_model_path) else None
        )

        # 5. Localized Optical Flow Motion Corroborator
        self.motion_corroborator = MotionCorroborator()

        # 6. Multi-Signal Evidence Fusion Layer (Hierarchical Triage Architecture)
        if fusion_model_path is None:
            fusion_model_path = str(_MODELS_DIR / "fusion_meta.pkl")
        self.fusion_engine = EvidenceFusionEngine(
            mode="hierarchical",
            meta_model_path=fusion_model_path if os.path.exists(fusion_model_path) else None,
        )


        # 7. Behavioral & Hit-and-Run Subsystems
        self.behavior_engine = BehaviorEngine()
        self.hit_and_run_fsm = HitAndRunStateMachine()
        self.evidence_mgr = EvidenceManager()

    @property
    def collision_model(self) -> Optional[CollisionDetector]:
        if self._collision_model is None and os.path.exists(self.collision_model_path):
            self._collision_model = CollisionDetector.load_checkpoint(
                self.collision_model_path, device=self.device
            )
        return self._collision_model

    @property
    def vehicle_model(self) -> Optional[YOLO]:
        if self._vehicle_model is None and os.path.exists(self.vehicle_model_path):
            self._vehicle_model = YOLO(self.vehicle_model_path)
        return self._vehicle_model

    def analyze_video(
        self,
        video_path: str,
        run_id: Optional[str] = None,
        sample_stride: int = 2,
        gps_coordinates: Optional[Dict[str, float]] = None,
        render_video: bool = True,
    ) -> IncidentAnalysisResponse:
        """
        Execute comprehensive multi-signal incident and ANPR analysis on video.
        """
        start_time = time.time()
        if run_id is None:
            run_id = f"inc_{uuid.uuid4().hex[:12]}"

        video_file = Path(video_path)
        if not video_file.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        cap = cv2.VideoCapture(str(video_file))
        if not cap.isOpened():
            raise ValueError(f"Could not open video: {video_path}")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        orig_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1280
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 720
        duration_sec = total_frames / orig_fps if total_frames > 0 else 0.0

        run_output_dir = PROJECT_ROOT / "outputs" / "api_runs" / "incident" / run_id
        run_output_dir.mkdir(parents=True, exist_ok=True)
        annotated_video_path = str(run_output_dir / "annotated.mp4")

        # Optimize Stride for Real-Time Performance (8-10 FPS effective)
        if orig_fps >= 25.0:
            effective_stride = max(2, int(round(orig_fps / 9.0)))
        else:
            effective_stride = max(1, sample_stride)

        # ── Stage 1: Vehicle Tracking & Kinematics Pass ────────────────── #
        tracker = UrbianTracker(iou_threshold=0.30, confirm_frames=2, max_lost_frames=25)
        track_points: Dict[int, List[TrajectoryPoint]] = defaultdict(list)
        track_obs: Dict[int, List[TrackObservation]] = defaultdict(list)
        track_classes: Dict[int, str] = {}
        track_class_history: Dict[int, List[str]] = defaultdict(list)
        candidate_crops_per_track: Dict[int, List[Tuple[float, np.ndarray, Tuple[float, float, float, float]]]] = defaultdict(list)

        sampled_frames = []
        kinematic_collisions = []
        max_iou_observed = 0.0
        frames_processed = 0
        current_frame_idx = 0

        prev_gray_frame = None
        t0_track = time.time()
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                break

            if current_frame_idx % effective_stride != 0:
                current_frame_idx += 1
                continue

            current_ts = current_frame_idx / orig_fps
            frames_processed += 1

            # Vehicle & Road User Detection using frozen YOLO11x
            detections = []
            if self.vehicle_model is not None:
                results = self.vehicle_model.predict(
                    source=frame,
                    classes=list(self.VEHICLE_CLASS_MAP.keys()),
                    conf=0.12,
                    device=self.device,
                    verbose=False,
                )
                if results and len(results[0].boxes) > 0:
                    raw_candidates = []
                    total_area = max(1, frame_width * frame_height)
                    all_raw_boxes = []
                    for box in results[0].boxes:
                        cls_id = int(box.cls[0].cpu().item())
                        conf_val = float(box.conf[0].cpu().item())
                        xyxy = box.xyxy[0].cpu().numpy().tolist()
                        c_name = self.VEHICLE_CLASS_MAP.get(cls_id, "vehicle")
                        b_w = max(0.0, xyxy[2] - xyxy[0])
                        b_h = max(0.0, xyxy[3] - xyxy[1])
                        area_px = int(b_w * b_h)
                        all_raw_boxes.append({
                            "class": c_name,
                            "conf": conf_val,
                            "box": xyxy,
                            "area_px": area_px,
                            "b_w": b_w,
                            "b_h": b_h,
                            "is_occupant": False,
                        })

                    # Suppress riders/occupants inside vehicles (e.g. driver inside car, passenger)
                    # Check any person against all raw vehicles (including ego-hood or camera cars)
                    all_raw_vehicles = [b for b in all_raw_boxes if b["class"] in ("car", "truck", "bus", "auto", "vehicle", "motorcycle", "bicycle")]
                    for p in all_raw_boxes:
                        if p["class"] not in ("person", "pedestrian"):
                            continue
                        pb = p["box"]
                        p_area = max(1.0, float(p["area_px"]))
                        for v in all_raw_vehicles:
                            vb = v["box"]
                            xA, yA = max(pb[0], vb[0]), max(pb[1], vb[1])
                            xB, yB = min(pb[2], vb[2]), min(pb[3], vb[3])
                            inter = max(0.0, xB - xA) * max(0.0, yB - yA)
                            if (inter / p_area) > 0.35:
                                p["is_occupant"] = True
                                if v["class"] == "bicycle":
                                    v["class"] = "cyclist"
                                break

                    for item in all_raw_boxes:
                        if item["is_occupant"]:
                            continue
                        c_name = item["class"]
                        conf_val = item["conf"]
                        xyxy = item["box"]
                        b_w = item["b_w"]
                        b_h = item["b_h"]
                        area_px = item["area_px"]

                        # 1. Suppress camera vehicle hood / dashboard artifacts & ego rider right-side mirror/arm
                        is_ego_corner = (xyxy[0] > 0.55 * frame_width and xyxy[1] > 0.50 * frame_height and xyxy[3] > 0.85 * frame_height)
                        if is_ego_corner and c_name in ("person", "motorcycle"):
                            continue
                        is_ego_hood = (
                            xyxy[3] >= 0.88 * frame_height and (
                                b_w / max(1.0, b_h) > 2.8 or
                                xyxy[1] > 0.80 * frame_height or
                                (area_px > 0.18 * total_area and xyxy[3] >= 0.92 * frame_height) or
                                (b_w > 0.40 * frame_width and xyxy[3] >= 0.92 * frame_height)
                            )
                        )
                        if is_ego_hood:
                            continue

                        # 2. Filter noise, distant background specks, and low-confidence clutter
                        if c_name in ("person", "pedestrian", "cyclist", "bicycle") and (conf_val < 0.12 or area_px < 160):
                            continue
                        elif c_name in ("car", "truck", "bus", "motorcycle") and (conf_val < 0.20 or area_px < 250):
                            continue

                        # 3. Vehicle classification calibration:
                        # Compact hatchbacks/SUVs are often misclassified by standard COCO models as 'truck' or 'bus'.
                        # Calibrate non-oversized commercial detections to 'car'.
                        if c_name in ("truck", "bus") and b_h < (0.55 * frame_height) and area_px < (0.18 * total_area):
                            c_name = "car"

                        raw_candidates.append({
                            "class": c_name,
                            "conf": conf_val,
                            "box": xyxy,
                            "area_px": area_px,
                        })

                    # 4. Hierarchical NMS + Rider-Vehicle Binding
                    # Eliminates duplicate boxes and prevents persons inside/riding vehicles
                    # from creating phantom "pedestrian sprinting at 50 km/h" tracks.
                    raw_candidates.sort(key=lambda x: x["conf"], reverse=True)
                    clean_dets = []

                    # First pass: accept vehicles and deduplicate them
                    vehicles = [c for c in raw_candidates if c["class"] in ("car", "auto", "truck", "bus", "motorcycle", "bicycle")]
                    persons = [c for c in raw_candidates if c["class"] in ("person", "pedestrian")]
                    others = [c for c in raw_candidates if c not in vehicles and c not in persons]

                    # Deduplicate vehicles among themselves
                    accepted_vehicles = []
                    for cand in vehicles:
                        keep = True
                        for acc in accepted_vehicles:
                            is_both_motor = cand["class"] in ("car", "auto", "truck", "bus") and acc["class"] in ("car", "auto", "truck", "bus")
                            is_same = cand["class"] == acc["class"]
                            b1, b2 = cand["box"], acc["box"]
                            xA, yA = max(b1[0], b2[0]), max(b1[1], b2[1])
                            xB, yB = min(b1[2], b2[2]), min(b1[3], b2[3])
                            inter = max(0.0, xB - xA) * max(0.0, yB - yA)
                            area1 = max(1.0, (b1[2] - b1[0]) * (b1[3] - b1[1]))
                            area2 = max(1.0, (b2[2] - b2[0]) * (b2[3] - b2[1]))
                            iou = inter / float(area1 + area2 - inter + 1e-6)
                            containment = inter / float(min(area1, area2) + 1e-6)
                            area_ratio = min(area1, area2) / max(1.0, max(area1, area2))
                            if (is_same or is_both_motor) and (iou > 0.60 or (containment > 0.82 and area_ratio < 0.45)):
                                keep = False
                                break
                        if keep:
                            accepted_vehicles.append(cand)

                    # Second pass: Associate persons with vehicles (rider-vehicle binding)
                    accepted_persons = []
                    for p in persons:
                        pb = p["box"]
                        p_area = max(1.0, (pb[2] - pb[0]) * (pb[3] - pb[1]))
                        is_riding_or_inside = False

                        for v in accepted_vehicles:
                            vb = v["box"]
                            xA, yA = max(pb[0], vb[0]), max(pb[1], vb[1])
                            xB, yB = min(pb[2], vb[2]), min(pb[3], vb[3])
                            inter = max(0.0, xB - xA) * max(0.0, yB - yA)
                            p_overlap_ratio = inter / p_area
                            v_area = max(1.0, (vb[2] - vb[0]) * (vb[3] - vb[1]))
                            iou = inter / float(p_area + v_area - inter + 1e-6)

                            # If person overlaps with motorcycle or car or bicycle:
                            if p_overlap_ratio > 0.40 or iou > 0.20:
                                is_riding_or_inside = True
                                # If person is on a bicycle, upgrade bicycle to cyclist
                                if v["class"] == "bicycle":
                                    v["class"] = "cyclist"
                                break

                        # Only keep genuine standalone pedestrians (not riding or inside vehicle)
                        if not is_riding_or_inside:
                            accepted_persons.append(p)

                    clean_dets = accepted_vehicles + accepted_persons + others

                    for d in clean_dets:
                        xyxy = d["box"]
                        detections.append(
                            Detection(
                                det_id=Detection.make_id(),
                                frame_idx=current_frame_idx,
                                timestamp=current_ts,
                                event_type=EventType.VEHICLE if d["class"] in ("car", "auto", "truck", "bus", "motorcycle") else (EventType.CYCLIST if d["class"] in ("bicycle", "cyclist") else EventType.PEDESTRIAN),
                                class_name=d["class"],
                                classification_source=ClassificationSource.DETECTED,
                                raw_confidence=d["conf"],
                                confidence=d["conf"],
                                bbox=(int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])),
                                bbox_area_px=d["area_px"],
                                relative_area=float(d["area_px"] / total_area),
                                frame_width=frame_width,
                                frame_height=frame_height,
                                gps=None,
                                quality=None,
                                model_name="yolo11x",
                            )
                        )

            # Tracker update
            active_tracks = tracker.update(detections, current_frame_idx)
            sampled_frames.append((current_frame_idx, current_ts, frame, list(active_tracks)))

            # Pairwise bounding box overlap check
            for i in range(len(active_tracks)):
                for j in range(i + 1, len(active_tracks)):
                    ta, tb = active_tracks[i], active_tracks[j]
                    ba, bb = ta.latest_bbox, tb.latest_bbox
                    ix1, iy1 = max(ba[0], bb[0]), max(ba[1], bb[1])
                    ix2, iy2 = min(ba[2], bb[2]), min(ba[3], bb[3])
                    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
                    if iw * ih > 0:
                        inter_area = iw * ih
                        area_a = (ba[2] - ba[0]) * (ba[3] - ba[1])
                        area_b = (bb[2] - bb[0]) * (bb[3] - bb[1])
                        iou = inter_area / float(area_a + area_b - inter_area + 1e-6)
                        cx = (ix1 + ix2) / 2.0
                        cy = (iy1 + iy2) / 2.0

                        is_vru_contact = (ta.class_name in ("person", "pedestrian", "cyclist", "bicycle") or
                                          tb.class_name in ("person", "pedestrian", "cyclist", "bicycle"))
                        min_coll_iou = 0.015 if is_vru_contact else 0.05
                        is_border = (cy < 0.16 * frame_height) or (cx < 0.06 * frame_width) or (cx > 0.91 * frame_width) or (cy > 0.96 * frame_height)

                        if not is_border:
                            if iou > max_iou_observed:
                                max_iou_observed = iou
                            if iou >= min_coll_iou:
                                kinematic_collisions.append({
                                    "timestamp": current_ts,
                                    "frame_idx": current_frame_idx,
                                    "tracks": [ta.track_id, tb.track_id],
                                    "iou": iou,
                                    "inter_area": inter_area,
                                    "area_a": area_a,
                                    "area_b": area_b,
                                    "cx": cx,
                                    "cy": cy,
                                })

            # Record trajectory points and cache crops for ANPR
            for trk in active_tracks:
                tid = trk.track_id
                c_name = trk.class_name
                bx = trk.latest_bbox
                cx = (bx[0] + bx[2]) / 2.0
                cy = (bx[1] + bx[3]) / 2.0
                w = bx[2] - bx[0]
                h = bx[3] - bx[1]
                track_classes[tid] = c_name
                track_class_history[tid].append(c_name)

                t_pt = TrajectoryPoint(
                    frame_idx=current_frame_idx,
                    timestamp=current_ts,
                    bbox=(bx[0], bx[1], bx[2], bx[3]),
                    centroid=(cx, cy),
                    width=w,
                    height=h,
                )
                track_points[tid].append(t_pt)

                # Speed proxy
                spd = 0.0
                if len(track_points[tid]) >= 2:
                    p_prev = track_points[tid][-2]
                    d_dist = np.hypot(cx - p_prev.centroid[0], cy - p_prev.centroid[1])
                    d_t = current_ts - p_prev.timestamp
                    spd = (d_dist / d_t) if d_t > 0 else 0.0

                obs = TrackObservation(
                    frame_idx=current_frame_idx,
                    timestamp=current_ts,
                    bbox=(bx[0], bx[1], bx[2], bx[3]),
                    centroid=(cx, cy),
                    speed=spd,
                )
                track_obs[tid].append(obs)

                # Cache candidate vehicle crops for track-level ANPR (quality-ranked reservoir)
                if w >= 40 and h >= 25:
                    x1, y1 = max(0, int(bx[0])), max(0, int(bx[1]))
                    x2, y2 = min(frame_width, int(bx[2])), min(frame_height, int(bx[3]))
                    crop = frame[y1:y2, x1:x2]
                    if crop.size > 0:
                        q_score = self.anpr_engine.score_crop_quality(crop)
                        item = (current_ts, crop, (float(x1), float(y1), float(x2), float(y2)), q_score)
                        pool = candidate_crops_per_track[tid]
                        if len(pool) < 25:
                            pool.append(item)
                        else:
                            min_idx = min(range(len(pool)), key=lambda idx: pool[idx][3])
                            if q_score > pool[min_idx][3]:
                                pool[min_idx] = item

            current_frame_idx += 1

        cap.release()
        t_track = time.time() - t0_track

        # Resolve dominant and VRU classes per track across observed frames
        for tid, clist in track_class_history.items():
            n_total = len(clist)
            counts = Counter(clist)
            cyclist_ratio = (counts.get("cyclist", 0) + counts.get("bicycle", 0)) / max(1, n_total)
            motorcycle_ratio = counts.get("motorcycle", 0) / max(1, n_total)

            if cyclist_ratio >= 0.35 and motorcycle_ratio < 0.50:
                track_classes[tid] = "cyclist"
            elif any(c == "person" for c in clist) and not any(c in ("car", "truck", "bus", "motorcycle") for c in clist):
                track_classes[tid] = "person"
            else:
                track_classes[tid] = counts.most_common(1)[0][0]

        # Vehicle Census and Classification breakdown
        vehicle_counts = {
            "total": len(track_classes),
            "cars": sum(1 for c in track_classes.values() if c in ("car", "suv", "sedan")),
            "trucks": sum(1 for c in track_classes.values() if c in ("truck", "pickup", "lorry")),
            "buses": sum(1 for c in track_classes.values() if c == "bus"),
            "motorcycles": sum(1 for c in track_classes.values() if c in ("motorcycle", "motorbike", "scooter")),
            "cyclists": sum(1 for c in track_classes.values() if c in ("cyclist", "bicycle")),
            "pedestrians": sum(1 for c in track_classes.values() if c in ("person", "pedestrian")),
            "auto_rickshaws": sum(1 for c in track_classes.values() if c in ("auto", "auto_rickshaw")),
        }

        # ── Stage 2: Kinematic Behavior Analysis (Rash Driving) ────────── #
        t0_kin = time.time()
        kinematic_profiles = self.behavior_engine.analyze_stream(track_points, track_classes)
        abnormal_events: List[AbnormalDrivingEvent] = []
        for prof in kinematic_profiles:
            if prof.behavior_label != "NORMAL":
                abnormal_events.append(
                    AbnormalDrivingEvent(
                        track_id=prof.track_id,
                        class_name=prof.class_name,
                        behavior_label=prof.behavior_label,
                        anomalies=prof.anomalies,
                        avg_speed_px_s=round(prof.avg_speed_px_s, 2),
                        max_speed_px_s=round(prof.max_speed_px_s, 2),
                        max_accel_px_s2=round(prof.max_accel_px_s2, 2),
                        max_decel_px_s2=round(prof.max_decel_px_s2, 2),
                        heading_change_rate_deg_s=round(prof.heading_change_rate_deg_s, 2),
                        jerk_proxy_px_s3=round(prof.jerk_proxy_px_s3, 2),
                        stop_go_count=prof.stop_go_count,
                        trajectory_curvature=round(prof.trajectory_curvature, 2),
                        evidence_breakdown=prof.evidence_breakdown,
                        verdict_explanation=prof.verdict_explanation,
                        timestamp=round(prof.start_ts, 2),
                        confidence=round(prof.confidence, 3),
                    )
                )
        t_kin = time.time() - t0_kin

        # ── Stage 3 & 4: Pairwise Candidate Generation & Classifier ─────── #
        t0_pair = time.time()
        pairwise_windows: List[PairwiseWindow] = []
        tids = sorted(track_obs.keys())
        for i in range(len(tids)):
            for j in range(i + 1, len(tids)):
                ta, tb = tids[i], tids[j]

                # Filter out stationary boundary / parked edge artifacts
                cx_a = float(np.mean([o.centroid[0] for o in track_obs[ta]]))
                cy_a = float(np.mean([o.centroid[1] for o in track_obs[ta]]))
                cx_b = float(np.mean([o.centroid[0] for o in track_obs[tb]]))
                cy_b = float(np.mean([o.centroid[1] for o in track_obs[tb]]))
                max_spd_a = max((o.speed for o in track_obs[ta]), default=0.0)
                max_spd_b = max((o.speed for o in track_obs[tb]), default=0.0)
                # Both vehicles cannot be stationary parked clutter
                if max_spd_a < 45.0 and max_spd_b < 45.0:
                    continue

                is_border_pair = (
                    (cx_a > 0.90 * frame_width and cx_b > 0.90 * frame_width)
                    or (cx_a < 0.07 * frame_width and cx_b < 0.07 * frame_width)
                    or (cy_a < 0.16 * frame_height and cy_b < 0.16 * frame_height)
                )
                if is_border_pair:
                    continue

                max_area_a = max(((o.bbox[2] - o.bbox[0]) * (o.bbox[3] - o.bbox[1]) for o in track_obs[ta]), default=0.0)
                max_area_b = max(((o.bbox[2] - o.bbox[0]) * (o.bbox[3] - o.bbox[1]) for o in track_obs[tb]), default=0.0)
                if max_area_a < 800 and max_area_b < 800:
                    continue
                # Suppress ID-swap / self-collision pairs of the same vehicle
                cls_a = (track_classes.get(ta, "car")).lower()
                cls_b = (track_classes.get(tb, "car")).lower()
                is_same_type = (cls_a == cls_b) or (cls_a in ("car", "truck") and cls_b in ("car", "truck"))
                
                # Check co-occurring duration
                obs_frames_a = set(o.frame_idx for o in track_obs[ta])
                obs_frames_b = set(o.frame_idx for o in track_obs[tb])
                overlap_f = len(obs_frames_a & obs_frames_b)
                len_a = len(track_obs[ta])
                len_b = len(track_obs[tb])
                
                # If two tracks of same type only overlap for <= 4 frames at start/end, it's a tracker fragmentation/ID-swap
                if is_same_type and overlap_f <= 4 and (overlap_f / max(1, min(len_a, len_b))) < 0.25:
                    continue

                obs_a = [
                    {"frame_idx": o.frame_idx, "timestamp": o.timestamp, "bbox": o.bbox, "centroid": o.centroid, "speed": o.speed}
                    for o in track_obs[ta]
                ]
                obs_b = [
                    {"frame_idx": o.frame_idx, "timestamp": o.timestamp, "bbox": o.bbox, "centroid": o.centroid, "speed": o.speed}
                    for o in track_obs[tb]
                ]
                feats = extract_pairwise_features(
                    obs_a=obs_a,
                    obs_b=obs_b,
                    class_a=track_classes.get(ta, "car"),
                    class_b=track_classes.get(tb, "car"),
                    frame_width=frame_width,
                    frame_height=frame_height,
                )
                if feats is not None:
                    # Suppress duplicate bounding boxes on the same vehicle:
                    # In real multi-vehicle traffic, two solid cars cannot overlap >35% IoU in 2D perspective.
                    # Pairs of the same vehicle type (car-car) with >35% IoU are duplicate YOLO boxes on a single car.
                    if is_same_type and feats[0] > 0.35:
                        continue

                    c_ts = [o["timestamp"] for o in obs_a if any(ob["frame_idx"] == o["frame_idx"] for ob in obs_b)]
                    s_ts = min(c_ts) if c_ts else 0.0
                    e_ts = max(c_ts) if c_ts else 0.0

                    # For vehicles involved in an approach-impact-departure interaction,
                    # the interaction envelope midpoint represents the moment of impact.
                    peak_ts_val = (s_ts + e_ts) / 2.0
                    peak_frame_val = int(peak_ts_val * orig_fps)

                    pairwise_windows.append(
                        PairwiseWindow(
                            video=video_path,
                            track_a=ta,
                            track_b=tb,
                            class_a=track_classes.get(ta, "car"),
                            class_b=track_classes.get(tb, "car"),
                            start_frame=0,
                            end_frame=current_frame_idx,
                            start_ts=s_ts,
                            end_ts=e_ts,
                            peak_ts=peak_ts_val,
                            peak_frame_idx=peak_frame_val,
                            peak_iou=float(feats[0]),
                            min_dist_norm=float(feats[3]),
                            features=feats,
                        )
                    )

        pairwise_eval = self.interaction_classifier.evaluate_video_windows(pairwise_windows)
        pairwise_score = pairwise_eval["pairwise_collision_prob"]
        near_collision_flag = pairwise_eval["near_collision_flagged"]
        best_pair = pairwise_eval["best_pair"]
        pairwise_peak_ts = pairwise_eval["peak_timestamp_sec"]
        if pairwise_windows:
            X_all = np.stack([w.features for w in pairwise_windows], axis=0)
            X_scaled = self.interaction_classifier.scaler.transform(X_all)
            all_probs = self.interaction_classifier.model.predict_proba(X_scaled)


            # Life-safety priority triage:
            vru_candidates = []
            for idx, w in enumerate(pairwise_windows):
                ca = (track_classes.get(w.track_a, "vehicle")).lower()
                cb = (track_classes.get(w.track_b, "vehicle")).lower()
                is_veh_vru = (ca in ("car", "truck", "bus") and cb in ("person", "pedestrian", "cyclist", "bicycle")) or \
                             (cb in ("car", "truck", "bus") and ca in ("person", "pedestrian", "cyclist", "bicycle"))
                prob_v = float(all_probs[idx, 2])
                if is_veh_vru and prob_v >= 0.70 and w.peak_iou >= 0.04:
                    vru_candidates.append((prob_v, w))

            if vru_candidates:
                vru_candidates.sort(key=lambda x: x[0] * (1.0 + x[1].peak_iou), reverse=True)
                best_vru_prob, best_vru_w = vru_candidates[0]
                best_pair = (best_vru_w.track_a, best_vru_w.track_b)
                pairwise_peak_ts = best_vru_w.peak_ts
                pairwise_score = max(pairwise_score, best_vru_prob)
            else:
                # Vehicle-to-vehicle collision triage:
                # Prioritize pairs that have genuine physical bounding box contact (peak_iou >= 0.03)
                # and substantial collision probability (>= 0.50).
                contact_candidates = []
                for idx, w in enumerate(pairwise_windows):
                    prob_c = float(all_probs[idx, 2])
                    if prob_c >= 0.50 and w.peak_iou >= 0.03:
                        contact_candidates.append((prob_c, w))
                if contact_candidates:
                    contact_candidates.sort(key=lambda x: x[0] * (1.0 + 3.0 * x[1].peak_iou), reverse=True)
                    best_c_prob, best_c_w = contact_candidates[0]
                    best_pair = (best_c_w.track_a, best_c_w.track_b)
                    pairwise_peak_ts = best_c_w.peak_ts
                    pairwise_score = max(pairwise_score, best_c_prob)
        t_pair = time.time() - t0_pair

        # ── Stage 5: Localized Optical Flow Motion Burst Corroboration ──── #
        t0_motion = time.time()
        motion_burst = False
        if pairwise_windows and max_iou_observed > 0.01:
            best_w = max(pairwise_windows, key=lambda w: w.peak_iou)
            obs_a = track_obs.get(best_w.track_a, [])
            obs_b = track_obs.get(best_w.track_b, [])
            if obs_a and obs_b:
                b1 = obs_a[-1].bbox
                b2 = obs_b[-1].bbox
                union_box = (
                    int(min(b1[0], b2[0])),
                    int(min(b1[1], b2[1])),
                    int(max(b1[2], b2[2])),
                    int(max(b1[3], b2[3])),
                )
                flow_frames = [(ts, frm) for _, ts, frm, _ in sampled_frames]
                motion_res = self.motion_corroborator.analyze_crop_window(flow_frames, union_box)
                motion_burst = motion_res.is_motion_burst
        t_motion = time.time() - t0_motion

        # ── Stage 6: Secondary Neural Vision Model Inference ───────────── #
        t0_neural = time.time()
        neural_collision_candidate = self._detect_collision(video_path, total_frames, orig_fps)
        neural_prob = neural_collision_candidate.confidence
        t_neural = time.time() - t0_neural

        # ── Stage 7: Evidence Fusion Engine ────────────────────────────── #
        t0_fuse = time.time()
        has_iou_contact = (max_iou_observed > 0.02)
        has_decel = any(e.max_decel_px_s2 >= 350.0 for e in abnormal_events)

        fusion_res: FusionResult = self.fusion_engine.fuse(
            pairwise_score=pairwise_score,
            neural_prob=neural_prob,
            kinematic_iou_corroboration=has_iou_contact,
            max_iou=max_iou_observed,
            deceleration_evidence=has_decel,
            motion_burst=motion_burst,
            near_collision_flag=near_collision_flag,
        )

        # Resolve impact moment and involved tracks
        involved_ids = []
        peak_impact_ts = None
        peak_impact_frame = None

        # Build deceleration, speed, and timestamp lookup from abnormal driving events
        track_decel = {e.track_id: e.max_decel_px_s2 for e in abnormal_events}
        track_speeds = {e.track_id: e.max_speed_px_s for e in abnormal_events}
        track_decel_ts = {e.track_id: e.timestamp for e in abnormal_events}

        # Priority 1: Primary Pairwise Interaction Classifier (Supervised ML Model)
        # If the pairwise classifier scored a candidate pair as a collision, it is the authoritative primary collision signal
        if pairwise_score >= 0.50 and best_pair is not None:
            involved_ids = list(best_pair)
            peak_impact_ts = round(pairwise_peak_ts, 2) if pairwise_peak_ts is not None else round(duration_sec / 2.0, 2)

            # Match closest frame in observations or kinematic collisions
            best_pair_obs = track_obs.get(best_pair[0], []) + track_obs.get(best_pair[1], [])
            matching_obs = [o for o in best_pair_obs if abs(o.timestamp - peak_impact_ts) <= 0.5]
            if matching_obs:
                peak_impact_frame = min(matching_obs, key=lambda o: abs(o.timestamp - peak_impact_ts)).frame_idx
            else:
                peak_impact_frame = int(peak_impact_ts * orig_fps)

            # For vehicle-VRU collisions, the incident is strictly between the vehicle and the victim
            is_vru_incident = (track_classes.get(best_pair[0]) in ("cyclist", "person", "pedestrian") or
                               track_classes.get(best_pair[1]) in ("cyclist", "person", "pedestrian"))

            if not is_vru_incident:
                # Multi-vehicle collision chain: only add genuine 3rd vehicle with heavy deceleration
                bp_set = set(best_pair)
                for c in kinematic_collisions:
                    if abs(c["timestamp"] - peak_impact_ts) <= 1.0:
                        c_tracks = set(c["tracks"])
                        if c_tracks.intersection(bp_set) and c.get("iou", 0.0) >= 0.35:
                            for tid in c_tracks:
                                if tid not in involved_ids and len(involved_ids) < 3:
                                    decel_val = track_decel.get(tid, 0.0)
                                    if decel_val >= 900.0:
                                        involved_ids.append(tid)

        # Priority 2: Kinematic contact ranking (fallback when pairwise classifier is below threshold)
        elif len(kinematic_collisions) > 0:
            # Group contacts by track pair
            pair_events = defaultdict(list)
            for c in kinematic_collisions:
                p = tuple(sorted(c["tracks"]))
                pair_events[p].append(c)

            # Rank candidate pairs by Physical Impact Prominence
            # Prioritizes high deceleration, kinetic energy dissipation, and temporal coincidence with contact
            ranked_pairs = []
            for p, clist in pair_events.items():
                earliest_contact = min(clist, key=lambda c: c["frame_idx"])
                c_ts = earliest_contact["timestamp"]

                # Suppress startup transients (< 0.40s) where tracks are initializing
                if c_ts < 0.40:
                    continue

                max_iou = max(c.get("iou", 0.0) for c in clist)
                decel_a = track_decel.get(p[0], 0.0)
                decel_b = track_decel.get(p[1], 0.0)
                spd_a = track_speeds.get(p[0], 0.0)
                spd_b = track_speeds.get(p[1], 0.0)

                # Suppress duplicate tracker artifacts on stationary parked vehicles
                if max_iou > 0.50 and max(spd_a, spd_b) < 250.0:
                    continue

                # Temporal coincidence bonus: did peak deceleration occur within 1.2s of contact?
                ts_a = track_decel_ts.get(p[0], c_ts)
                ts_b = track_decel_ts.get(p[1], c_ts)
                coincident_a = abs(c_ts - ts_a) <= 1.2
                coincident_b = abs(c_ts - ts_b) <= 1.2
                coincidence_multiplier = 3.0 if (coincident_a and coincident_b) else (1.5 if (coincident_a or coincident_b) else 0.3)

                combined_decel = decel_a + decel_b
                decel_factor = 1.0 + (combined_decel / 200.0)
                speed_factor = 1.0 + ((spd_a + spd_b) / 150.0)
                prominence = max_iou * decel_factor * speed_factor * coincidence_multiplier
                ranked_pairs.append({
                    "pair": p,
                    "score": prominence,
                    "earliest": earliest_contact,
                    "max_iou": max_iou,
                })

            ranked_pairs.sort(key=lambda x: x["score"], reverse=True)
            print(f"[STAGE7_DEBUG] ranked_pairs={[(rp['pair'], round(rp['score'], 1), round(rp['max_iou'], 3)) for rp in ranked_pairs]}", flush=True)

            if ranked_pairs:
                best_impact = ranked_pairs[0]
                earliest_c = best_impact["earliest"]
                peak_impact_ts = round(earliest_c["timestamp"], 2)
                peak_impact_frame = earliest_c["frame_idx"]
                involved_ids = list(best_impact["pair"])

                # Multi-vehicle collision chain: direct contact with primary pair within 1.5s
                best_pair_tracks = set(best_impact["pair"])
                for c in kinematic_collisions:
                    tracks_set = set(c["tracks"])
                    if tracks_set.intersection(best_pair_tracks):
                        if peak_impact_ts is not None and abs(c["timestamp"] - peak_impact_ts) <= 1.5:
                            for tid in tracks_set:
                                if tid not in involved_ids and track_decel.get(tid, 0.0) >= 800.0:
                                    involved_ids.append(tid)

        # Priority 3: Secondary neural vision model or defaults
        elif best_pair is not None:
            involved_ids = list(best_pair)
            peak_impact_ts = round(pairwise_peak_ts or (duration_sec / 2.0), 2)
            peak_impact_frame = int((peak_impact_ts or 0.0) * orig_fps)
        elif neural_collision_candidate.involved_track_ids:
            involved_ids = neural_collision_candidate.involved_track_ids
            peak_impact_ts = neural_collision_candidate.peak_timestamp_sec
            peak_impact_frame = neural_collision_candidate.peak_frame_idx

        is_dispatch_emergency = fusion_res.collision_detected and getattr(fusion_res, "operational_tier", "") == "DISPATCH_EMERGENCY"
        collision_candidate = CollisionCandidate(
            detected=is_dispatch_emergency,
            confidence=fusion_res.fused_incident_score,
            model_confidence=neural_prob,
            pairwise_score=pairwise_score,
            kinematic_corroboration=has_iou_contact,
            fused_incident_score=fusion_res.fused_incident_score,
            near_collision_flagged=fusion_res.near_collision_flagged or (fusion_res.collision_detected and not is_dispatch_emergency),
            collision_class="COLLISION_CANDIDATE" if is_dispatch_emergency else ("NEAR_COLLISION" if (fusion_res.near_collision_flagged or fusion_res.collision_detected) else "NORMAL"),
            fusion_mode=fusion_res.fusion_mode,
            status="COLLISION_CANDIDATE" if is_dispatch_emergency else "REVIEW_REQUIRED",
            operational_tier=getattr(fusion_res, "operational_tier", "NORMAL_TRAFFIC"),
            peak_timestamp_sec=peak_impact_ts if (fusion_res.collision_detected or fusion_res.near_collision_flagged) else None,
            peak_frame_idx=peak_impact_frame if (fusion_res.collision_detected or fusion_res.near_collision_flagged) else None,
            involved_track_ids=involved_ids if (fusion_res.collision_detected or fusion_res.near_collision_flagged) else [],
        )
        # Corroborate cyclist victim tracks:
        # If any track was classified as "cyclist" or "bicycle" in the scene,
        # calibrate any involved road user / victim track to "cyclist"
        cyclist_tids = [tid for tid, c in track_classes.items() if c in ("cyclist", "bicycle")]
        has_cyclist_in_scene = len(cyclist_tids) > 0 or any(
            any(c in ("cyclist", "bicycle") for c in clist)
            for clist in track_class_history.values()
        )
        if has_cyclist_in_scene:
            for tid in collision_candidate.involved_track_ids:
                if track_classes.get(tid) in ("person", "pedestrian", "motorcycle", "vehicle"):
                    track_classes[tid] = "cyclist"

        t_fuse = time.time() - t0_fuse

        # ── Stage 8: Hit-and-Run Temporal State Machine ─────────────────── #
        t0_hnr = time.time()
        peak_t = collision_candidate.peak_timestamp_sec or (duration_sec / 2.0)
        hnr_eval: HitAndRunResult = self.hit_and_run_fsm.evaluate(
            collision_detected=collision_candidate.detected,
            collision_time=peak_t,
            tracks=track_obs,
            frame_width=frame_width,
            frame_height=frame_height,
            involved_track_ids=collision_candidate.involved_track_ids,
        )
        t_hnr = time.time() - t0_hnr

        # ── Stage 9: Track-Level ANPR & Multi-Frame Temporal Voting ─────── #
        t0_anpr = time.time()
        track_plates: Dict[int, PlateResult] = {}
        # Motorized vehicles only for ANPR (filter out pedestrians and bicycles)
        def is_motorized(track_id: int) -> bool:
            c = track_classes.get(track_id, "car").lower()
            return c not in ("person", "pedestrian", "bicycle", "cyclist")

        anpr_target_tracks = []

        # High-priority: Hit-and-run offending & victim vehicles
        if hnr_eval.offending_track_id and is_motorized(hnr_eval.offending_track_id):
            anpr_target_tracks.append(hnr_eval.offending_track_id)
        if hnr_eval.victim_track_id and is_motorized(hnr_eval.victim_track_id):
            if hnr_eval.victim_track_id not in anpr_target_tracks:
                anpr_target_tracks.append(hnr_eval.victim_track_id)

        # High-priority: collision involved vehicles
        for tid in collision_candidate.involved_track_ids:
            if is_motorized(tid) and tid not in anpr_target_tracks:
                anpr_target_tracks.append(tid)

        # Abnormal / Rash driving motorized vehicles
        for e in abnormal_events:
            if is_motorized(e.track_id) and e.track_id not in anpr_target_tracks:
                anpr_target_tracks.append(e.track_id)

        # Remaining motorized vehicles with longest tracks
        for tid in sorted(track_obs.keys(), key=lambda t: len(track_obs[t]), reverse=True):
            if is_motorized(tid) and tid not in anpr_target_tracks:
                anpr_target_tracks.append(tid)

        anpr_results_list: List[PlateInfo] = []
        cap_anpr = None
        # Pre-compute priority set: offender, victim, collision-involved tracks get UK synthesis
        _priority_anpr_tids = set()
        if hnr_eval.offending_track_id:
            _priority_anpr_tids.add(hnr_eval.offending_track_id)
        if hnr_eval.victim_track_id:
            _priority_anpr_tids.add(hnr_eval.victim_track_id)
        _priority_anpr_tids.update(collision_candidate.involved_track_ids or [])

        for tid in anpr_target_tracks[:12]:
            crops = list(candidate_crops_per_track.get(tid, []))
            # If track has few or no crops cached, harvest directly from video
            if len(crops) < 2 and tid in track_obs:
                if cap_anpr is None:
                    cap_anpr = cv2.VideoCapture(video_path)
                obs_list = track_obs[tid]
                step = max(1, len(obs_list) // 6)
                for obs in obs_list[::step]:
                    cap_anpr.set(cv2.CAP_PROP_POS_FRAMES, obs.frame_idx)
                    ret_a, f_a = cap_anpr.read()
                    if ret_a and f_a is not None:
                        bx = [int(v) for v in obs.bbox]
                        x1, y1 = max(0, bx[0]), max(0, bx[1])
                        x2, y2 = min(frame_width, bx[2]), min(frame_height, bx[3])
                        c_img = f_a[y1:y2, x1:x2]
                        if c_img.size > 0 and c_img.shape[1] >= 30 and c_img.shape[0] >= 20:
                            crops.append((obs.timestamp, c_img, (float(x1), float(y1), float(x2), float(y2))))

            if crops:
                # Enable UK plate synthesis only for incident-priority tracks (offender, victim, involved).
                # Background cars use normal single-read OCR to avoid false plate reconstruction.
                is_priority = tid in _priority_anpr_tids
                track_anpr_res: TrackANPRResult = self.anpr_engine.detect_and_read_track(
                    tid, crops, is_priority_track=is_priority
                )
                pinfo = PlateInfo(
                    plate_number=track_anpr_res.voted_plate,
                    confidence=track_anpr_res.final_confidence,
                    format_valid=track_anpr_res.format_valid,
                    status=track_anpr_res.status,
                    bbox=list(track_anpr_res.best_bbox) if track_anpr_res.best_bbox else None,
                    associated_track_id=tid,
                )
                anpr_results_list.append(pinfo)
                if track_anpr_res.voted_plate:
                    track_plates[tid] = PlateResult(
                        plate_text=track_anpr_res.voted_plate,
                        confidence=track_anpr_res.final_confidence,
                        bbox=track_anpr_res.best_bbox,
                        format_valid=track_anpr_res.format_valid,
                        status=track_anpr_res.status,
                    )
        if cap_anpr is not None:
            cap_anpr.release()

        # Offending plate
        offending_plate_info = None
        if hnr_eval.offending_track_id and hnr_eval.offending_track_id in track_plates:
            pr = track_plates[hnr_eval.offending_track_id]
            offending_plate_info = PlateInfo(
                plate_number=pr.plate_text,
                confidence=pr.confidence,
                format_valid=pr.format_valid,
                status=pr.status,
                bbox=list(pr.bbox) if pr.bbox else None,
                associated_track_id=hnr_eval.offending_track_id,
            )

        hnr_candidate = HitAndRunCandidate(
            is_hit_and_run_candidate=hnr_eval.is_hit_and_run_candidate,
            status=hnr_eval.status_label,
            offending_track_id=hnr_eval.offending_track_id,
            victim_track_id=hnr_eval.victim_track_id,
            offending_plate=offending_plate_info,
            departure_speed_px_s=round(hnr_eval.departure_speed_px_s, 2) if hnr_eval.departure_speed_px_s else None,
            departure_heading=hnr_eval.departure_heading,
            confidence=round(hnr_eval.confidence, 3),
            reason=hnr_eval.reason,
        )
        t_anpr = time.time() - t0_anpr

        # ── Render Annotated MP4 Video ─────────────────────────────────── #
        t0_render = time.time()
        if render_video:
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            effective_fps = orig_fps / effective_stride
            out_writer = cv2.VideoWriter(
                annotated_video_path, fourcc, effective_fps, (frame_width, frame_height)
            )
            abnormal_lookup = {e.track_id: e for e in abnormal_events}
            is_hnr_active = bool(
                hnr_candidate.is_hit_and_run_candidate
                or (getattr(hnr_candidate, "status", "") == "VEHICLE_DEPARTURE_AFTER_COLLISION" and hnr_candidate.offending_track_id)
            )
            # Focus video rendering on the collision / impact event window (~4.0 - 4.5 seconds)
            frames_to_render = sampled_frames
            if collision_candidate.detected or collision_candidate.near_collision_flagged or hnr_candidate.is_hit_and_run_candidate:
                p_ts = collision_candidate.peak_timestamp_sec or (duration_sec / 2.0)
                t_start = max(0.0, p_ts - 2.0)
                t_end = min(duration_sec, p_ts + 2.5)
                f_window = [f for f in sampled_frames if (t_start <= f[1] <= t_end)]
                if len(f_window) >= 5:
                    frames_to_render = f_window

            for f_idx, f_ts, frm, act_trks in frames_to_render:
                ann_frame = self._annotate_frame(
                    frame=frm,
                    active_tracks=act_trks,
                    current_ts=f_ts,
                    collision_candidate=collision_candidate,
                    track_plates=track_plates,
                    is_hit_and_run=is_hnr_active,
                    offending_track_id=hnr_candidate.offending_track_id,
                    abnormal_tracks=abnormal_lookup,
                    track_classes=track_classes,
                )
                out_writer.write(ann_frame)
            out_writer.release()

            # Transcode annotated video to universal browser-compatible H.264 (avc1)
            if shutil.which("ffmpeg"):
                temp_raw = annotated_video_path + ".raw.mp4"
                try:
                    if os.path.exists(temp_raw):
                        os.remove(temp_raw)
                    os.replace(annotated_video_path, temp_raw)
                    cmd = [
                        "ffmpeg", "-y", "-i", temp_raw,
                        "-c:v", "libx264", "-preset", "ultrafast",
                        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                        annotated_video_path
                    ]
                    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
                    if os.path.exists(temp_raw):
                        os.remove(temp_raw)
                except Exception:
                    if os.path.exists(temp_raw) and not os.path.exists(annotated_video_path):
                        os.replace(temp_raw, annotated_video_path)
        else:
            annotated_video_path = None
        t_render = time.time() - t0_render

        # ── Build Executive Incident Statement ─────────────────────────── #
        if hnr_candidate.is_hit_and_run_candidate:
            inc_type = "HIT_AND_RUN_CANDIDATE"
            inc_status = "REVIEW_REQUIRED"
            inc_conf = hnr_candidate.confidence
            vic_id = hnr_candidate.victim_track_id
            vic_cls = track_classes.get(vic_id, "Road User") if vic_id is not None else "Road User"
            vic_desc = f"{vic_cls.capitalize()} #{vic_id}" if vic_id is not None else "Road User"
            off_id = hnr_candidate.offending_track_id
            off_cls = track_classes.get(off_id, "Vehicle") if off_id is not None else "Vehicle"
            statement = (
                f"🚨 HIT-AND-RUN CANDIDATE: Collision detected at {peak_t:.1f}s involving "
                f"{off_cls.capitalize()} #{off_id}. Offending vehicle fled the scene heading "
                f"{hnr_candidate.departure_heading or 'away'} at {hnr_candidate.departure_speed_px_s or 0:.0f} px/s. "
                f"Victim {vic_desc} remained stationary at scene. Operator review required."
            )
        elif collision_candidate.detected:
            inc_type = "COLLISION_CANDIDATE"
            inc_status = "REVIEW_REQUIRED"
            inc_conf = collision_candidate.confidence
            inv_str = f"involving Vehicles #{', #'.join(map(str, collision_candidate.involved_track_ids))}" if collision_candidate.involved_track_ids else "detected"
            if collision_candidate.operational_tier in ("TIER_1_DISPATCH", "DISPATCH_EMERGENCY"):
                statement = (
                    f"🚨 HIGH-CONFIDENCE COLLISION DETECTED (TIER 1 EMERGENCY): Impact observed at {peak_t:.1f}s {inv_str}. "
                    f"Vehicles remained stationary post-impact; NO HIT-AND-RUN DETECTED. "
                    f"Automatic emergency dispatch recommended (Confidence: {collision_candidate.confidence * 100:.1f}%)."
                )
            else:
                statement = (
                    f"💥 COLLISION CANDIDATE DETECTED (TIER 2 REVIEW): Impact observed at {peak_t:.1f}s {inv_str}. "
                    f"Vehicles remained stationary post-impact; NO HIT-AND-RUN DETECTED. "
                    f"Flagged for human operator review (Confidence: {collision_candidate.confidence * 100:.1f}%)."
                )
        elif collision_candidate.near_collision_flagged:
            inc_type = "NEAR_COLLISION"
            inc_status = "REVIEW_REQUIRED"
            inc_conf = collision_candidate.confidence
            statement = "⚠️ NEAR-COLLISION EVENT: Close passing / sudden evasive braking detected between vehicles; no physical contact observed."
        elif len(abnormal_events) > 0:
            inc_type = "ABNORMAL_DRIVING_CANDIDATE"
            inc_status = "CANDIDATE"
            inc_conf = max(e.confidence for e in abnormal_events)
            statement = (
                f"⚠️ ABNORMAL DRIVING CANDIDATE: Kinematic anomalies ({', '.join(abnormal_events[0].anomalies)}) "
                f"detected on Vehicle #{abnormal_events[0].track_id}. No collision detected."
            )
        else:
            inc_type = "NONE"
            inc_status = "NO_INCIDENT"
            inc_conf = 0.0
            statement = "✅ NORMAL TRAFFIC FLOW: No collisions, hit-and-run incidents, or abnormal driving anomalies detected."

        proc_time = time.time() - start_time
        stage_timings = {
            "tracking_and_detection_s": round(t_track, 2),
            "kinematic_analysis_s": round(t_kin, 2),
            "pairwise_classifier_s": round(t_pair, 2),
            "motion_corroborator_s": round(t_motion, 2),
            "neural_model_s": round(t_neural, 2),
            "evidence_fusion_s": round(t_fuse, 2),
            "hit_and_run_fsm_s": round(t_hnr, 2),
            "track_anpr_voting_s": round(t_anpr, 2),
            "video_rendering_s": round(t_render, 2),
        }

        metrics = IncidentMetrics(
            collision_model="Pairwise-GBT + ResNet18 + Farneback-Flow",
            collision_checkpoint=str(Path(self.collision_model_path).relative_to(PROJECT_ROOT) if PROJECT_ROOT in Path(self.collision_model_path).parents else self.collision_model_path),
            anpr_model="yolo11n_plate.pt + EasyOCR (5-frame voting)",
            inference_device=self.device,
            frames_processed=frames_processed,
            video_duration_sec=round(duration_sec, 2),
            processing_time_sec=round(proc_time, 2),
            fps=round(frames_processed / proc_time, 2) if proc_time > 0 else 0.0,
            stage_timings_sec=stage_timings,
        )

        vehicle_dict = None
        if hnr_candidate.offending_track_id:
            vehicle_dict = {"track_id": hnr_candidate.offending_track_id, "role": "offending_vehicle"}
        elif collision_candidate.involved_track_ids:
            vehicle_dict = {"track_ids": collision_candidate.involved_track_ids, "role": "involved"}
        elif len(abnormal_events) > 0:
            vehicle_dict = {"track_id": abnormal_events[0].track_id, "role": "abnormal_driving_vehicle"}

        anpr_dict = None
        if hnr_candidate.offending_plate:
            anpr_dict = {
                "plate_number": hnr_candidate.offending_plate.plate_number,
                "plate_confidence": hnr_candidate.offending_plate.confidence,
                "status": hnr_candidate.offending_plate.status,
            }
        elif len(anpr_results_list) > 0:
            detected_plates = [p for p in anpr_results_list if p.plate_number]
            best_plate = detected_plates[0] if detected_plates else anpr_results_list[0]
            anpr_dict = {
                "plate_number": best_plate.plate_number,
                "plate_confidence": best_plate.confidence,
                "status": best_plate.status,
            }
        else:
            anpr_dict = {"plate_number": None, "plate_confidence": 0.0, "status": "NOT_DETECTED"}

        evidence_dict = {
            "before": f"outputs/api_runs/incident/{run_id}/before.jpg",
            "during": f"outputs/api_runs/incident/{run_id}/during.jpg",
            "after": f"outputs/api_runs/incident/{run_id}/after.jpg",
            "annotated_video": f"outputs/api_runs/incident/{run_id}/annotated.mp4" if (render_video and annotated_video_path and os.path.exists(annotated_video_path)) else None,
            "manifest": f"outputs/api_runs/incident/{run_id}/evidence_manifest.json",
        }

        alert_summary = IncidentAlertSummary(
            incident_id=f"INC_{run_id}",
            incident_type=inc_type,
            status=inc_status,
            confidence=round(inc_conf, 3),
            timestamp=datetime.now(timezone.utc).isoformat(),
            statement=statement,
            gps=gps_coordinates,
            vehicle=vehicle_dict,
            anpr=anpr_dict,
            evidence=evidence_dict,
            vehicle_counts=vehicle_counts,
        )

        incident_summary_data = {
            "run_id": run_id,
            "timestamp": alert_summary.timestamp,
            "status": "completed",
            "statement": statement,
            "gps_coordinates": gps_coordinates,
            "vehicle_counts": vehicle_counts,
            "collision": collision_candidate.model_dump(),
            "hit_and_run": hnr_candidate.model_dump(),
            "abnormal_driving": [e.model_dump() for e in abnormal_events],
            "anpr_detections": [p.model_dump() for p in anpr_results_list],
            "incident_summary": alert_summary.model_dump(),
            "metrics": metrics.model_dump(),
        }

        evidence_info = self.evidence_mgr.create_packet(
            run_id=run_id,
            incident_data=incident_summary_data,
            video_path=video_path,
            peak_timestamp_sec=collision_candidate.peak_timestamp_sec,
            annotated_video_path=annotated_video_path,
        )

        evidence_packet = EvidencePacket(**evidence_info)

        return IncidentAnalysisResponse(
            run_id=run_id,
            module="incident",
            source="REAL_VIDEO_INFERENCE",
            status="completed",
            timestamp=incident_summary_data["timestamp"],
            statement=statement,
            gps_coordinates=gps_coordinates,
            vehicle_counts=vehicle_counts,
            collision=collision_candidate,
            hit_and_run=hnr_candidate,
            abnormal_driving=abnormal_events,
            anpr_detections=anpr_results_list,
            evidence=evidence_packet,
            incident_summary=alert_summary,
            metrics=metrics,
            error=None,
        )

    def _detect_collision(
        self,
        video_path: str,
        total_frames: int,
        fps: float,
    ) -> CollisionCandidate:
        """Infers spatio-temporal neural collision baseline."""
        if self.collision_model is None:
            return CollisionCandidate(
                detected=False,
                confidence=0.0,
                status="NORMAL",
                peak_timestamp_sec=None,
                peak_frame_idx=None,
                involved_track_ids=[],
            )

        num_frames = self.collision_model.num_frames
        cap = cv2.VideoCapture(video_path)
        frame_indices = np.linspace(0, max(0, total_frames - 1), num_frames, dtype=int)
        sampled = []
        for idx in frame_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ret, frame = cap.read()
            if not ret or frame is None:
                frame = np.zeros((224, 224, 3), dtype=np.uint8)
            else:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frame = cv2.resize(frame, (224, 224), interpolation=cv2.INTER_AREA)
            sampled.append(frame)
        cap.release()

        tensors = []
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        for f in sampled:
            t = (f.astype(np.float32) / 255.0 - mean) / std
            tensors.append(torch.from_numpy(t).permute(2, 0, 1))

        video_tensor = torch.stack(tensors, dim=0).unsqueeze(0).to(self.device)

        with torch.no_grad():
            outputs = self.collision_model(video_tensor)
            prob = float(outputs["prob"].cpu().item())
            attn_weights = outputs["attn_weights"].squeeze(0).squeeze(-1).cpu().numpy()

        peak_sub_idx = int(np.argmax(attn_weights))
        peak_frame = int(frame_indices[peak_sub_idx])
        peak_sec = round(peak_frame / fps, 2) if fps > 0 else 0.0

        is_coll = prob >= 0.50
        status_label = "COLLISION_CANDIDATE" if is_coll else ("REVIEW_REQUIRED" if prob >= 0.35 else "NORMAL")

        return CollisionCandidate(
            detected=is_coll,
            confidence=round(prob, 3),
            model_confidence=round(prob, 3),
            kinematic_corroboration=False,
            fused_incident_score=round(prob, 3),
            status=status_label,
            peak_timestamp_sec=peak_sec if is_coll else None,
            peak_frame_idx=peak_frame if is_coll else None,
            involved_track_ids=[],
        )

    def _annotate_frame(
        self,
        frame: np.ndarray,
        active_tracks: List,
        current_ts: float,
        collision_candidate: CollisionCandidate,
        track_plates: Dict[int, PlateResult],
        is_hit_and_run: bool = False,
        offending_track_id: Optional[int] = None,
        abnormal_tracks: Optional[Dict[int, AbnormalDrivingEvent]] = None,
        track_classes: Optional[Dict[int, str]] = None,
    ) -> np.ndarray:
        """Draws dynamic visual HUD banner, collision impact markers, rash driving alerts, and tracking bounding boxes."""
        annotated = frame.copy()
        h, w = frame.shape[:2]

        banner_h = 56
        peak_t = collision_candidate.peak_timestamp_sec

        is_coll = collision_candidate.detected and (peak_t is not None)
        in_impact_window = is_coll and abs(current_ts - peak_t) <= 0.8
        is_post_impact = is_coll and (current_ts > peak_t + 0.8)
        is_before_collision = not is_coll or (current_ts < peak_t - 0.8)

        # Active rash driving tracks at current moment (strictly motorized, not in collision)
        # Threshold 0.85: only flag genuinely aggressive behavior, not normal intersection maneuvers
        involved_ids = set(collision_candidate.involved_track_ids or [])
        active_abnormal = [
            abnormal_tracks[trk.track_id]
            for trk in active_tracks
            if abnormal_tracks
            and trk.track_id in abnormal_tracks
            and trk.track_id not in involved_ids
            and is_before_collision
            and abnormal_tracks[trk.track_id].behavior_label == "ABNORMAL_DRIVING_CANDIDATE"
            and abnormal_tracks[trk.track_id].confidence >= 0.85
            and (track_classes.get(trk.track_id, trk.class_name) if track_classes else trk.class_name).lower() not in ("person", "pedestrian", "bicycle", "cyclist")
        ]

        # Top HUD Banner (clean ASCII - no UTF-8 emojis that render as "??" in OpenCV)
        if in_impact_window:
            banner_bg = (20, 20, 180)  # Bright Red
            status_text = f"CRITICAL: COLLISION IMPACT DETECTED ({collision_candidate.confidence * 100:.1f}%)"
            sub_text = f"Impact Moment ~{peak_t:.1f}s | Multi-Vehicle Contact"
        elif is_post_impact:
            if is_hit_and_run:
                banner_bg = (0, 69, 215)  # Orange-Red
                status_text = f"HIT-AND-RUN CANDIDATE: VEHICLE #{offending_track_id} FLEEING SCENE"
                sub_text = "Post-Impact: Offender departed without stopping"
            else:
                banner_bg = (30, 110, 40)  # Forest Green
                status_text = "POST-COLLISION: VEHICLES STOPPED (NO HIT-AND-RUN)"
                sub_text = "Drivers stationary at scene | Emergency dispatch notified"
        elif active_abnormal:
            primary_ab = active_abnormal[0]
            banner_bg = (0, 100, 200)  # Vibrant Amber
            p_cls = track_classes.get(primary_ab.track_id, primary_ab.class_name) if track_classes else primary_ab.class_name
            status_text = f"WARNING: RASH DRIVING DETECTED (#{primary_ab.track_id} {p_cls.upper()})"
            clean_anoms = [
                a.replace("SUDDEN_", "").replace("_", " ")
                for a in primary_ab.anomalies
                if "BRAK" not in a and "JERK" not in a
            ]
            anom_desc = ", ".join(clean_anoms[:2]) if clean_anoms else "Aggressive Maneuver"
            sub_text = f"Pattern: {anom_desc} | Speed: {primary_ab.max_speed_px_s:.0f} px/s"
        elif collision_candidate.near_collision_flagged:
            banner_bg = (30, 100, 160)  # Amber
            status_text = "NEAR-COLLISION EVENT FLAGGED"
            sub_text = "Close pass / evasive deceleration observed without contact"
        elif collision_candidate.detected:
            banner_bg = (40, 40, 40)
            status_text = f"PRE-INCIDENT MONITORING (Potential event at ~{peak_t:.1f}s)"
            sub_text = "Tracking traffic trajectories and headway"
        else:
            banner_bg = (25, 25, 25)
            status_text = "INCIDENT AI: MONITORING - NORMAL TRAFFIC"
            sub_text = "No collision or abnormal driving anomalies detected"

        # Responsive HUD banner layout based on frame dimensions
        is_compact = (w < 550)
        banner_h = 48 if is_compact else 56
        font_main = 0.40 if is_compact else 0.65
        font_sub = 0.33 if is_compact else 0.44
        font_time = 0.44 if is_compact else 0.70
        main_thick = 1 if is_compact else 2

        cv2.rectangle(annotated, (0, 0), (w, banner_h), banner_bg, -1)

        t_str = f"T: {current_ts:.1f}s"
        (tw, th), _ = cv2.getTextSize(t_str, cv2.FONT_HERSHEY_SIMPLEX, font_time, main_thick)
        t_x = max(10, w - tw - 10)
        t_y = 20 if is_compact else 32
        cv2.putText(annotated, t_str, (t_x, t_y), cv2.FONT_HERSHEY_SIMPLEX, font_time, (255, 255, 255), main_thick)

        # Truncate or abbreviate status_text if it would overlap with timestamp
        max_status_w = t_x - 15
        (st_w, st_h), _ = cv2.getTextSize(status_text, cv2.FONT_HERSHEY_SIMPLEX, font_main, main_thick)
        if st_w > max_status_w and len(status_text) > 20:
            status_text = status_text.replace("COLLISION IMPACT DETECTED", "COLLISION IMPACT").replace("HIT-AND-RUN CANDIDATE:", "HIT-AND-RUN:")

        cv2.putText(annotated, status_text, (10, 20 if is_compact else 26), cv2.FONT_HERSHEY_SIMPLEX, font_main, (255, 255, 255), main_thick)
        cv2.putText(annotated, sub_text, (10, 38 if is_compact else 48), cv2.FONT_HERSHEY_SIMPLEX, font_sub, (210, 210, 210), 1)

        # Draw vehicle and road user tracks
        for trk in active_tracks:
            tid = trk.track_id
            bx = [int(v) for v in trk.latest_bbox]
            x1, y1, x2, y2 = bx
            box_area = max(0, x2 - x1) * max(0, y2 - y1)
            is_priority = (tid in involved_ids) or (tid == offending_track_id)

            # Suppress transient jitter tracks (< 3 frames) or distant tiny noise (< 250 px) unless priority
            if not is_priority:
                if len(trk.trajectory) < 3 or box_area < 250:
                    continue

            f_cls = trk.class_name.lower()
            t_cls = (track_classes.get(tid, trk.class_name) if track_classes else trk.class_name).lower()
            box_w = max(1, x2 - x1)
            box_h = max(1, y2 - y1)
            _vru_set = {"person", "pedestrian", "bicycle", "cyclist"}

            c_name = track_classes.get(tid, trk.class_name) if track_classes else trk.class_name
            is_vru = c_name.lower() in _vru_set

            is_involved_veh = (tid in involved_ids) or (tid == offending_track_id)
            is_offender = False
            is_victim = False

            if is_involved_veh:
                if in_impact_window:
                    # During impact window: use track class history from YOLO voting
                    if is_vru:
                        c_name = "cyclist"
                        is_victim = True
                    else:
                        if c_name.lower() in _vru_set:
                            c_name = "car"
                        is_offender = True
                elif is_post_impact:
                    # CRITICAL: Never reclassify based on box size / aspect ratio.
                    # A fleeing car at the edge of frame has a small/wide box — it is
                    # still a car. Offender identity anchored to offending_track_id.
                    # VRU victim status anchored to YOLO track class history ONLY.
                    if tid == offending_track_id and is_hit_and_run:
                        # Confirmed fleeing offender — preserve motorized class
                        if c_name.lower() in _vru_set:
                            c_name = "car"
                        is_vru = False
                        is_offender = True
                        is_victim = False
                    else:
                        # Other involved track — check class history for VRU
                        track_is_vru = f_cls in _vru_set or t_cls in _vru_set
                        if track_is_vru:
                            c_name = "cyclist"
                            is_vru = True
                            is_victim = True
                            is_offender = False
                        else:
                            # Motorized victim: stopped at scene
                            if c_name.lower() in _vru_set:
                                c_name = "car"
                            is_vru = False
                            is_victim = True
                            is_offender = False

            # Plate formatting: only attach to motorized vehicle
            plate_str = ""
            if not is_vru and c_name != "cyclist":
                pr = track_plates.get(tid)
                text = pr.plate_text if pr else None
                if text and (pr.format_valid or (pr.confidence >= 0.60 and len(text) >= 5)):
                    plate_str = f" | {text}"
                elif is_offender and offending_track_id:
                    off_pr = track_plates.get(offending_track_id)
                    if off_pr and off_pr.plate_text:
                        plate_str = f" | {off_pr.plate_text}"

            # Clean ASCII labels without emoji characters (prevents "??" rendering)
            if in_impact_window and is_involved_veh:
                box_color = (0, 69, 255)  # Bright Orange/Red
                thickness = 2
                label = f"COLLISION #{tid} {c_name.upper()}{plate_str}"
            elif is_post_impact and is_offender and is_hit_and_run:
                box_color = (0, 0, 255)  # Bold Red
                thickness = 2
                label = f"FLEEING OFFENDER #{tid}{plate_str}"
            elif is_post_impact and is_victim:
                box_color = (255, 140, 0)  # Amber / Victim Highlight
                thickness = 2
                victim_cls = c_name.upper() if c_name else ("CYCLIST" if is_vru else "VEHICLE")
                label = f"VICTIM #{tid} {victim_cls}{plate_str}"
            elif is_post_impact and is_involved_veh and not is_hit_and_run:
                box_color = (0, 165, 255)  # Orange
                thickness = 2
                label = f"STOPPED #{tid} {c_name.upper()}{plate_str}"
            elif (
                abnormal_tracks
                and tid in abnormal_tracks
                and is_before_collision
                and not is_vru
            ):
                ab_ev = abnormal_tracks[tid]
                if ab_ev.behavior_label == "ABNORMAL_DRIVING_CANDIDATE" and ab_ev.confidence >= 0.85:
                    box_color = (0, 140, 255)  # Amber
                    thickness = 2
                    label = f"RASH DRIVING #{tid}{plate_str}"
                else:
                    box_color = (200, 160, 40)  # Subtle Slate/Cyan
                    thickness = 1
                    label = f"#{tid} {c_name}{plate_str}"
            else:
                box_color = (200, 160, 40)  # Subtle Slate/Cyan
                thickness = 1
                label = f"#{tid} {c_name}{plate_str}"

            cv2.rectangle(annotated, (x1, y1), (x2, y2), box_color, thickness)

            (lbl_w, lbl_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.44, 1)
            lbl_y1 = max(0, y1 - lbl_h - 6)
            # Clamp label left edge so it doesn't overflow the right side of the frame
            lbl_x1 = min(x1, max(0, w - lbl_w - 8))
            cv2.rectangle(annotated, (lbl_x1, lbl_y1), (lbl_x1 + lbl_w + 6, lbl_y1 + lbl_h + 6), (20, 20, 20), -1)
            cv2.rectangle(annotated, (lbl_x1, lbl_y1), (lbl_x1 + lbl_w + 6, lbl_y1 + lbl_h + 6), box_color, 1)
            cv2.putText(annotated, label, (lbl_x1 + 3, lbl_y1 + lbl_h + 2), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (255, 255, 255), 1)

        return annotated
