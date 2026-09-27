# Person 4 — Incident + ANPR AI Module

**TriNetra | SIH 2026 | PS 26125**  
**Author:** Dhruvin Shah (Person 4 — Incident & ANPR AI)

---

## Overview

This module implements **Person 4's contribution** to the TriNetra AI platform:
a 9-stage multi-signal incident detection and license-plate recognition pipeline.

### Capabilities
| Feature | Description |
|---|---|
| **Collision Detection** | Pairwise + neural + optical-flow fusion (hierarchical triage) |
| **Hit-and-Run Detection** | 5-state FSM with post-impact track association (handles ID swaps) |
| **Rash Driving Detection** | Kinematic jerk/swerve/deceleration threshold engine |
| **ANPR** | YOLO11n plate detector + EasyOCR with 5-frame temporal voting |
| **Evidence Assembly** | Before/During/After keyframes + annotated MP4 + SHA-256 manifest |

---

## Location in TriNetra

```
backend/
├── app/
│   ├── ai/
│   │   └── incident/          ← Person 4 AI modules (all stages)
│   │       ├── inference.py   ← Main 9-stage pipeline
│   │       ├── anpr.py        ← ANPR engine
│   │       ├── hit_and_run.py ← HnR state machine
│   │       ├── fusion.py      ← Hierarchical evidence fusion
│   │       ├── behavior_engine.py ← Rash driving kinematics
│   │       ├── collision_model.py ← ResNet18-BiGRU-Attention neural model
│   │       ├── schemas.py     ← Pydantic response models
│   │       ├── models/        ← Trained checkpoints
│   │       │   ├── collision_model_best.pt   (45.8 MB)
│   │       │   ├── interaction_classifier.pkl (1.4 MB)
│   │       │   ├── fusion_meta.pkl
│   │       │   └── anpr/yolo11n_plate.pt    (5.2 MB)
│   │       └── docs/          ← Training reports & defense materials
│   └── api/
│       └── v1/
│           └── incident.py    ← REST API router (Person 4 endpoints)
└── app/tests/ai/
    ├── test_incident_pipeline.py
    └── test_person4_multisignal.py
```

---

## API Endpoints

All endpoints are mounted at **`/api/v1/incident/`**:

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/analyze` | Upload video → full incident analysis |
| `GET` | `/runs/{run_id}` | Retrieve `incident.json` result |
| `GET` | `/runs/{run_id}/video` | Stream annotated MP4 (collision clip) |
| `GET` | `/runs/{run_id}/evidence` | Evidence manifest + SHA-256 hashes |
| `GET` | `/runs/{run_id}/evidence/{filename}` | Download individual artifact |
| `GET` | `/alerts` | All incident alerts for Command Center |
| `GET` | `/alerts/{run_id}` | Single alert |

---

## Architecture: 9-Stage Pipeline

```
Video Input
    │
    ▼
Stage 1: YOLO11x Vehicle Tracking (UrbianTracker)
    │
    ▼
Stage 2: Kinematic Behavior Engine (rash driving)
    │
    ▼
Stage 3: Pairwise Interaction Candidate Generation
    │
    ▼
Stage 4: GBT Interaction Classifier (20-dim features)
    │
    ▼
Stage 5: Optical Flow Motion Corroboration
    │
    ▼
Stage 6: ResNet18-BiGRU-Attention Neural Model
    │
    ▼
Stage 7: Evidence Fusion (Hierarchical Triage)
    │
    ▼
Stage 8: Hit-and-Run FSM (5-state, post-assoc.)
    │
    ▼
Stage 9: ANPR + Evidence Assembly
    │
    ▼
incident.json + annotated.mp4 + keyframes
```

---

## Integration for Kavya (Frontend Team)

The existing TriNetra frontend can call Person 4 endpoints directly:

```typescript
// Upload video for analysis
const formData = new FormData();
formData.append('video', videoFile);
formData.append('render_video', 'true');
const res = await fetch('/api/v1/incident/analyze', { method: 'POST', body: formData });
const result = await res.json();

// result.incident_summary contains: incident_type, status, confidence, 
// anpr (plate numbers), evidence (keyframe URLs, video URL)
```

---

## Dependencies Added

Person 4 requires the following packages (add to TriNetra's `pyproject.toml`):

```toml
"easyocr>=1.7.0",          # OCR for license plates
"scikit-learn>=1.4.0",     # GBT classifier + calibration
"scipy>=1.12.0",           # Kalman motion evidence
"joblib>=1.3.0",           # Pickle model loading
```

> **Note:** `torch`, `ultralytics`, `opencv-python-headless`, and `numpy` are already in TriNetra's `pyproject.toml`.

---

## Model Notes

| File | Size | Purpose |
|---|---|---|
| `collision_model_best.pt` | 45.8 MB | ResNet18-BiGRU-Attention collision classifier |
| `interaction_classifier.pkl` | 1.4 MB | GBT pairwise interaction classifier |
| `fusion_meta.pkl` | 0.8 KB | Calibrated logistic fusion meta-model |
| `anpr/yolo11n_plate.pt` | 5.2 MB | YOLO11n fine-tuned for license plate detection |

> `yolo11x.pt` (114 MB, primary vehicle detector) exceeds GitHub's file size limit and is **not committed**. TriNetra's existing `yolo11n.pt` is used as fallback. For production, place `yolo11x.pt` at `backend/app/ai/incident/models/yolo11x.pt`.

---

*Person 4 contribution — Dhruvin Shah | September 2026*
