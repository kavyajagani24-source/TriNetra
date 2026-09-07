# UrbanEye AI — Centralized Command & Intelligence Platform
## Stage 2 — Phase 1: Frontend Foundation, API Integration & Operations Dashboard

UrbanEye AI transforms public transport buses into intelligent mobile sensing units. This web application provides a high-density, real-time command dashboard for city engineers, traffic authorities, and municipal operations teams.

---

## 1. Features

- **Executive Urban Overview**: Live KPIs, corroborated road defect triage, and automated incident candidates.
- **Video Ingestion & AI Pipeline**: Upload transit camera recordings (`.mp4`, `.avi`, `.mov`), assign sensing buses, dispatch YOLO v11 detection pipelines, and observe live job progress.
- **Bus Fleet Registry**: Complete CRUD management for transit sensing buses, route assignments, and active sensor status.
- **Incident & Evidence Viewer**: Computer-vision inspection of detected events (potholes, waterlogging, near-miss pedestrian conflicts, road markings) with confidence meters, coordinates, and evidence frames.
- **Dual-Mode Operation (Live + Zero-Dependency Demo Mode)**:
  - **Live Mode**: Directly connects to FastAPI backend (`/api/v1/`) and PostgreSQL database.
  - **Demo Mode**: Instant offline fallback with realistic bus registries, urban events, and traffic telemetry without backend dependencies.
  - Interactive status pill and settings toggle to switch modes at runtime.

---

## 2. Technology Stack

- **Framework**: TanStack Start (Nitro + Vite SSR) & React 19
- **Language**: TypeScript 5.8 (Strict mode)
- **Styling**: Tailwind CSS & Radix UI Primitives
- **State Management**: Zustand & Custom React Service Hooks
- **Data Visualization**: Recharts
- **HTTP Client**: Axios with interceptors and error normalization
- **Testing**: Vitest unit and service test suites

---

## 3. Getting Started

### Prerequisites

- Node.js `>= 20.0.0`
- npm `>= 10.0.0`

### Installation

```bash
cd frontend
npm install
```

### Environment Configuration

Create a `.env` file from `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_BACKEND_URL=http://localhost:8000
VITE_DEMO_MODE=false
VITE_APP_NAME=UrbanEye AI
VITE_APP_VERSION=2.0.0
```

### Development Server

```bash
npm run dev
```

App starts at `http://localhost:3000` (or `http://localhost:5173`).

### Production Build

```bash
npm run build
npm run preview
```

### Running Tests

```bash
npm test
```

---

## 4. Docker Deployment

To build and run using Docker:

```bash
# Standalone frontend build
docker build -t urbaneye-frontend .
docker run -p 3000:3000 urbaneye-frontend

# Full stack (PostgreSQL + FastAPI + Frontend)
cd ..
docker compose up --build
```

---

## 5. Directory Structure

```text
src/
├── components/
│   ├── buses/          # Bus registry table, modals, and CRUD forms
│   ├── events/         # Event table, inspection modals, and evidence viewer
│   ├── videos/         # Video upload, processing trigger, and status monitor
│   ├── layout/         # AppShell, Sidebar, TopBar, and SystemStatus
│   └── common/         # Buttons, cards, badges, and primitives
├── config/             # Typed environment configuration
├── hooks/              # Custom React hooks with Demo Mode fallback
│   ├── useBuses.ts
│   ├── useVideos.ts
│   ├── useProcessing.ts
│   ├── useEvents.ts
│   ├── useAnalytics.ts
│   └── useDemoMode.ts
├── mocks/              # Zero-dependency mock datasets
├── pages/              # Screen components (Overview, Videos, Buses, Fleet, Settings, etc.)
├── routes/             # TanStack Start file-based routing
├── services/           # Axios API modules and storage media resolver
├── store/              # Client-side Zustand stores
├── types/              # Typed contracts matching FastAPI schemas
└── utils/              # Formatting and event styling helpers
```
