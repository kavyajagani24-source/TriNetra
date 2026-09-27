# Person 4 Subsystem Evaluation Matrix
**The Sixth Sense | Smart India Hackathon 2026 | PS 26125**

---

## 1. System-Level Evaluation Overview

Person 4 is evaluated not merely as a single classifier, but across **8 interconnected intelligence subsystems**:

```
Subsystem A: Vehicle Tracking (UrbianTracker)
Subsystem B: Collision Candidate Detection (Pairwise Model + Neural + Kinematics)
Subsystem C: Rash / Abnormal Driving (BehaviorEngine with Jerk & Curvature)
Subsystem D: Hit-and-Run FSM (5 Distinguishable States)
Subsystem E: ANPR & OCR (Quality Ranking + 5-Frame Temporal Voting)
Subsystem F: Evidence Generation (SHA-256 Manifest + Before/During/After Keyframes)
Subsystem G: End-to-End Incident Verification (`v4.mov` & Test Split)
Subsystem H: Real-Time Performance & GPU Resource Efficiency
```

---

## 2. Detailed Subsystem Evaluations

### A. Vehicle Tracking (`UrbianTracker`)
- **Algorithm**: Hybrid IoU + Normalized Centroid Distance matching (`iou * 0.5 + max(0.0, 1.3 - dist) * 0.5`).
- **Terminology Confirmation**: Strictly verified as `UrbianTracker`, NOT ByteTrack (no Kalman filter, no appearance embeddings).
- **Track Confirmation**: 2 consecutive frames required.
- **Max Lost Frames**: 25 frames.
- **Observed Persistence**: Successfully tracks vehicles across high occlusion and sudden impact stops without ID switching during collision windows.

### B. Collision Candidate Detection (16-Video Test Set)
- **Baseline Neural Model (System A)**:
  - Accuracy: 43.75% | Precision: 40.0% | Recall: 25.0% | F1: 0.3077 | ROC-AUC: 0.2500
- **Pairwise Interaction Model (System C)**:
  - Accuracy: 56.25% | Precision: 53.33% | Recall: **100.0%** | F1: **0.6957** | ROC-AUC: **1.0000** | PR-AUC: **1.0000**
- **Collision Recall**: Improved from **25.0% (2/8) to 100.0% (8/8)**.
- **Hard-Negative Near Miss Handling**: Near-collision pairs explicitly isolated from false alarms.

### C. Rash Driving Candidate Detection (`BehaviorEngine`)
- **Kinematic Signals Computed**:
  - Velocity proxy (px/s)
  - Peak acceleration proxy (px/s²)
  - Peak deceleration proxy (px/s²)
  - Heading change angular rate (deg/s)
  - Lateral swerving deviation (px)
  - Jerk proxy ($da/dt$, px/s³)
  - Stop/go transition count
  - Trajectory curvature
- **Status Classification**:
  - `NORMAL`: No anomalies.
  - `REVIEW_REQUIRED`: Single anomaly detected.
  - `ABNORMAL_DRIVING_CANDIDATE`: $\ge 2$ concurrent anomalies.
- **Explainability**: Every alert includes `evidence_breakdown` dict and `verdict_explanation`.

### D. Hit-and-Run Candidate Detection (`HitAndRunStateMachine`)
- **Five Explicit Outcomes**:
  1. `HIT_AND_RUN_CANDIDATE`: Offending vehicle fled scene (>80 px/s) and exited camera FOV while victim stayed.
  2. `VEHICLE_DEPARTURE_AFTER_COLLISION`: Vehicle departed but remained within frame (lower confidence).
  3. `COLLISION_WITHOUT_DEPARTURE`: Both vehicles remained at scene (NO HIT-AND-RUN).
  4. `BOTH_VEHICLES_DEPARTED`: Both vehicles continued driving.
  5. `INSUFFICIENT_TRACK_EVIDENCE`: Single track, occlusion, or missing track continuity.
- **Verification on `v4.mov`**: Correctly produces `COLLISION_WITHOUT_DEPARTURE`.

### E. ANPR & License Plate Recognition (`ANPREngine`)
- **Quality Ranking**: Evaluates crop sharpness via Laplacian variance and pixel resolution.
- **Multi-Frame Temporal Voting**: Collects top 5 quality crops per track, extracts OCR candidates, and conducts majority voting.
- **Standard Regex**: Matches standard Indian plates (`[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}`) and BH series.
- **No Hallucination**: Unreadable plates output `plate_text = None` and `status = "UNREADABLE"`. Zero fabricated plates.

### F. Evidence Generation (`EvidenceManager`)
- **Keyframe Extraction**: Adaptive window extraction (`before.jpg`, `during.jpg`, `after.jpg`).
- **Cryptographic Security**: Every evidence packet generates `evidence_manifest.json` with SHA-256 hashes of all artifacts.
- **Annotated MP4**: Color-coded bounding boxes and dynamic HUD banner rendered using OpenCV `mp4v`.

### G. End-to-End Correctness (`v4.mov` Benchmark)
- **Input**: `v4.mov` (8.82s, 60 FPS, 2386×1332).
- **Collision Verdict**: `COLLISION_CANDIDATE` (Confidence 83.2%).
- **Impact Timestamp**: 7.23s (exact ground truth).
- **Involved Tracks**: Vehicles #8 and #10.
- **Hit-and-Run Verdict**: `COLLISION_WITHOUT_DEPARTURE` (Driver remained at scene).
- **ANPR**: 11 tracks analyzed, all correctly marked UNREADABLE (zero hallucination).

### H. Performance & Latency
- **Total Pipeline Execution**: 26.72s on 8.82s video.
- **Tracking & Detection**: 12.37s.
- **Pairwise Classifier**: 0.11s.
- **Motion Corroborator**: 0.26s.
- **Neural Model**: 3.42s.
- **ANPR Temporal Voting**: 6.77s.
- **Video Rendering**: 2.76s.
