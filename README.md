# UrbanEye AI — Autonomous Urban Sensing & Mobile Traffic Intelligence

UrbanEye AI transforms public transport buses into intelligent, mobile sensing units. By leveraging vehicle-mounted cameras, edge & cloud computer vision (YOLO v11, ByteTrack), and spatial telemetry, UrbanEye AI autonomously maps road surface defects, identifies pedestrian hazards, quantifies traffic congestion, and provides a centralized command center for modern municipal authorities.

---

## Architecture Overview

```text
       [ Public Transport Bus Fleet ]
           │ (Onboard Cameras & GPS)
           ▼
    [ Video Ingestion & Storage ]
           │
           ▼
    [ AI Processing Pipeline ]
    ├── YOLO v11 Multi-Class Object Detection
    ├── ByteTrack Multi-Object Tracking & Trajectory Estimation
    ├── Road Defect & Hazard Classification (Potholes, Waterlogging)
    ├── Pedestrian Conflict & Risk Analysis
    └── Traffic Density & Flow Metrics
           │
           ▼
    [ PostgreSQL & FastAPI REST Layer ]
           │
           ▼
    [ Command & Control Dashboard (React / TanStack Start) ]
    ├── Live Telemetry & GPS Corridor Inspection
    ├── Bus Fleet Registry & Video Processing Dispatch
    ├── Corroborated Road Defect Triage & Evidence Viewer
    └── Zero-Dependency Demo Mode for Demonstrations
```

---

## Project Structure

```text
urbaneye-ai/
├── backend/            # FastAPI REST backend, SQLAlchemy models & YOLO AI engine
│   ├── app/
│   │   ├── ai/         # YOLO detector, ByteTrack tracker, hazards & traffic analytics
│   │   ├── api/        # REST endpoints (buses, videos, jobs, events, analytics)
│   │   ├── models/     # SQLAlchemy ORM models
│   │   ├── repositories/
│   │   └── services/
│   └── tests/          # Pytest automated test suite (60 tests)
├── frontend/           # TanStack Start / Vite / React 19 command center
│   ├── src/
│   │   ├── components/ # BusManagement, VideoManagement, EventDetailModal, etc.
│   │   ├── hooks/      # React hooks with Demo Mode fallback
│   │   ├── pages/      # Overview, Fleet, Roads, Videos, Buses, Incidents, Settings
│   │   └── services/   # Axios API client & media resolver
│   └── tests/          # Vitest unit test suite (16 tests)
└── docker-compose.yml  # Unified orchestration for Postgres, Backend, and Frontend
```

---

## Quick Start with Docker Compose

To launch the complete platform (PostgreSQL database, FastAPI backend, and Command Dashboard):

```bash
docker compose up --build
```

- **Frontend Command Dashboard**: `http://localhost:3000`
- **FastAPI Documentation & Swagger UI**: `http://localhost:8000/docs`
- **Static Media & Evidence Server**: `http://localhost:8000/storage`

---

## Running Locally

### 1. Backend (Python 3.11+)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Or .venv\Scripts\activate on Windows
pip install -e .
pytest                     # Run all 60 tests
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend (Node.js 20+)

```bash
cd frontend
npm install
npm test                   # Run all 16 Vitest tests
npm run dev                # Start local development server
```
