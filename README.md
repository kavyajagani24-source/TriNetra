# TriNetra (UrbanEye AI) — Urban Intelligence Command Center

**TriNetra** transforms public transit bus fleets into intelligent, mobile sensing units for municipal monitoring, road health diagnostics, traffic optimization, and incident investigation. By processing forward-facing dashcam streams through a modular multi-engine computer vision architecture, TriNetra turns raw road transit footage into structured, actionable urban telemetry.

---

## 🏛️ Platform Architecture

TriNetra employs a unified, multi-engine intelligence pipeline: **One Video Asset → Multiple AI Engines → One Unified Intelligence Report**.

```text
                     [ Public Transit Bus Dashcams & Video Ingestion ]
                                             │
                                             ▼
                 ┌────────────────────────────────────────────────────────┐
                 │       TriNetra Multi-Engine Orchestration Engine       │
                 └───────────────────────────┬────────────────────────────┘
                                             │
      ┌──────────────────┬───────────────────┼───────────────────┬──────────────────┐
      ▼                  ▼                   ▼                   ▼                  ▼
[ Road & Surface ]  [ Traffic Flow ]   [ Module 3 VRU ]   [ Incident & ANPR ]  [ Evidence Vault ]
 Sixth Sense RDD2022  YOLO11x Detection  Pedestrian Traj.   Collision Neural Net Forensic Frames
 Pothole (D40) &      UrbianTracker      Crossings & Risks  Rash-Driving FSM     Before / During /
 Surface Cracks (D00) Distance-IoU Gate  (Local Host Check) Plate Voting (ANPR)  After Frames & MP4
      │                  │                   │                   │                  │
      └──────────────────┴───────────────────┼───────────────────┴──────────────────┘
                                             ▼
                               [ Unified Domain Aggregator ]
                                             │
                                             ▼
                             [ SQLite / PostgreSQL Database ]
                                             │
                                             ▼
                         [ FastAPI High-Throughput REST APIs ]
                                             │
                                             ▼
                   [ TriNetra Urban Command Center (React 19 / Vite) ]
                    ├── Interactive Timeline Scrubber & AI Stream Switcher
                    ├── Real-Time Multi-Stage Execution Telemetry Stepper
                    ├── Live GPS Corridor Map & Fleet Management
                    └── Dual-Mode Verification (Live Telemetry & Demo Mode)
```

---

## 🧠 AI Engines & Telemetry

| Engine / Module | Neural Backbone & Methodology | Outputs & Artifacts | Host Status |
| :--- | :--- | :--- | :--- |
| **Road & Infrastructure AI** | RDD2022 Checkpoint (`models/best.pt`) | Longitudinal cracks (`D00`), Transverse cracks (`D10`), Potholes (`D40`), Alligator cracks (`D20`) | Available (`sixth_sense`) |
| **Traffic Flow Intelligence** | YOLO11x + **UrbianTracker** (Distance-IoU matching + spatial velocity gate) | Tracked vehicle counts by class (car, bus, truck, motorcycle), peak density, congestion rating | Available (`sixth_sense`) |
| **VRU Safety AI** | SIH2026 Module 3 Pedestrian Trajectory & Risk Scoring Engine | Pedestrian risk zones, school-crossing alerts, proximity warnings | Verified on host (`UNAVAILABLE` gracefully when missing) |
| **Incident & ANPR AI** | Multi-signal Fusion (Kinematics + Optical Flow + Interaction Classifier + OCR Voting) | Collision candidates, hit-and-run assessments, rash-driving trajectories, license plate recognition | Available (`app/ai/incident`) |

> **Zero-Fabrication Standard**: TriNetra operates under strict data honesty. When an engine or hardware dependency is not present on the host environment (such as `SIH2026--Module3`), the system transparently surfaces `Module Unavailable` rather than fabricating simulated telemetry.

---

## 📁 Repository Structure

```text
TriNetra/
├── backend/
│   ├── app/
│   │   ├── ai/                      # AI Engines & Multi-Engine Processing Pipeline
│   │   │   ├── incident/            # Incident detection, collision model, hit-and-run & ANPR
│   │   │   ├── integrations/        # Adapters for Sixth Sense & Safety Module 3
│   │   │   ├── processors/          # UrbanAIPipeline multi-engine coordinator
│   │   │   └── tracker/             # UrbianTracker (Distance-IoU + class constraint)
│   │   ├── api/                     # REST API Routers (videos, buses, events, incidents, safety)
│   │   ├── core/                    # Settings, dynamic SQLite resolution, logging, DB session
│   │   ├── models/                  # SQLAlchemy ORM entity definitions
│   │   ├── repositories/            # Storage abstractions & query handlers
│   │   ├── schemas/                 # Pydantic validation schemas
│   │   └── services/                # Business logic & background processing orchestration
│   ├── storage/                     # Uploaded transit footage & processed annotated media
│   └── tests/                       # Automated Pytest suite (110 tests)
├── frontend/
│   ├── src/
│   │   ├── components/              # Command center cards, map layers, modals, video player
│   │   ├── config/                  # Centralized client runtime environment configuration
│   │   ├── pages/                   # Videos Workspace, Fleet, Roads, Overview, Settings
│   │   ├── services/                # Axios API services (videos, buses, events, incidents)
│   │   ├── state/                   # AppStoreProvider (Live database hydration & demo mode)
│   │   └── types/                   # TypeScript interfaces matching backend schemas
│   └── src/__tests__/               # Automated Vitest test suite (24 tests)
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.11+** (Python 3.14 compatible)
- **Node.js 20+** and **npm**
- **FFmpeg** (installed and available on system PATH for video transcoding)

### 1. Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # On Windows: .venv\Scripts\activate
pip install -e .

# Run the 110-test automated verification suite
pytest app/tests/ -q

# Launch the FastAPI server (Port 8000)
python -c "import uvicorn; uvicorn.run('app.main:create_application', factory=True, host='127.0.0.1', port=8000, reload=True)"
```

- **Interactive API Documentation (Swagger)**: `http://127.0.0.1:8000/docs`
- **Health Check Endpoint**: `http://127.0.0.1:8000/api/v1/health`

### 2. Frontend Command Center Setup

```bash
cd frontend
npm install

# Run the 24-test Vitest verification suite
npm test

# Launch the Vite development server (Port 8080)
npm run dev -- --port 8080
```

- **Web Dashboard**: `http://localhost:8080`
- **Video Workspace**: `http://localhost:8080/videos`

---

## 🧪 Automated Test Verification

TriNetra maintains rigorous test coverage across both frontend and backend layers:

- **Backend Pytest**: **110 / 110 passed (100%)**
  - Bus fleet lifecycle and status transitions
  - Video upload, validation, and metadata extraction
  - AI processing job dispatch, progress polling, and results retrieval
  - UrbianTracker vehicle tracking and Distance-IoU association
  - Incident, collision candidate, and ANPR inference pipelines
- **Frontend Vitest**: **24 / 24 passed (100%)**
  - Formatting helpers, timestamps, and durations
  - Map spatial coordinates and route projections
  - API client error normalization and response handling
