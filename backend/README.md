# UrbanEye AI 🚌👁️

**AI-Powered Mobile Urban Intelligence Platform**

UrbanEye AI transforms public transport buses into intelligent mobile sensing units.
Cameras mounted on buses stream video that is processed by AI to detect:

- 🚗 Vehicles & pedestrian density
- 🚦 Traffic congestion
- 🕳️ Potholes & damaged roads
- 💧 Waterlogging & road hazards
- ⚠️ Unsafe driving behaviour

> **Current Implementation: Stage 1 — Phase 1 (Backend Foundation)**
>
> This repository contains the production-ready backend foundation.
> No AI inference runs yet — that is Phase 2.

---

## Phase 1 Features

| Component | Status |
|---|---|
| FastAPI REST Backend | ✅ Complete |
| PostgreSQL + SQLAlchemy 2.x | ✅ Complete |
| Alembic Database Migrations | ✅ Complete |
| Bus Registration & Management | ✅ Complete |
| Video Upload & Validation | ✅ Complete |
| OpenCV Metadata Extraction | ✅ Complete |
| Processing Job Scaffolding | ✅ Complete |
| Structured Logging | ✅ Complete |
| Global Exception Handling | ✅ Complete |
| Swagger / Redoc Docs | ✅ Complete |
| Docker & Docker Compose | ✅ Complete |
| Unit Tests (SQLite) | ✅ Complete |

---

## Architecture

```
API Request
    │
    ▼
FastAPI Router  (app/api/v1/)
    │
    ▼
Service Layer   (app/services/)   ← Business logic
    │
    ▼
Repository      (app/repositories/) ← Data access
    │
    ▼
SQLAlchemy ORM  (app/models/)
    │
    ▼
PostgreSQL
```

### Database Relationships

```
Bus (buses)
 └── Video (videos)               [many videos per bus]
      └── ProcessingJob            [many jobs per video]
           (processing_jobs)
```

---

## Technology Stack

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.11+ | Runtime |
| FastAPI | ≥0.115 | Web framework |
| Uvicorn | ≥0.30 | ASGI server |
| SQLAlchemy | ≥2.0 | ORM |
| psycopg | ≥3.1 | PostgreSQL driver |
| Alembic | ≥1.13 | Database migrations |
| Pydantic | ≥2.7 | Data validation |
| OpenCV | ≥4.10 | Video metadata extraction |
| uv | latest | Package manager |
| Docker | any | Containerisation |

---

## Quick Start

### Prerequisites

- [uv](https://github.com/astral-sh/uv) — Python package manager
- Python 3.11+
- PostgreSQL 14+ **OR** Docker

---

### 1. Clone & Enter the Backend Directory

```bash
git clone <repo-url>
cd urbaneye-ai/backend
```

---

### 2. Set Up Environment with uv

```bash
# Create virtual environment and install all dependencies
uv sync

# Install including dev/test dependencies
uv sync --dev
```

---

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` if needed (defaults work for Docker Compose):

```env
DATABASE_URL=postgresql+psycopg://urbaneye:urbaneye@localhost:5432/urbaneye
MAX_UPLOAD_SIZE_MB=500
```

---

### 4. Database Setup

**Option A: Docker PostgreSQL (recommended)**

```bash
# Start only the database
docker compose up postgres -d
```

**Option B: Local PostgreSQL**

```sql
CREATE USER urbaneye WITH PASSWORD 'urbaneye';
CREATE DATABASE urbaneye OWNER urbaneye;
```

---

### 5. Run Database Migrations

```bash
uv run alembic upgrade head
```

Verify tables were created:

```bash
uv run alembic current
```

---

### 6. Start the Development Server

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API is now available at:

| URL | Description |
|---|---|
| http://localhost:8000/docs | **Swagger UI** (interactive) |
| http://localhost:8000/redoc | Redoc documentation |
| http://localhost:8000/api/v1/health | Health check |

---

## Running with Docker

```bash
# Build and start all services (PostgreSQL + Backend)
docker compose up --build

# Run in background
docker compose up --build -d

# View logs
docker compose logs -f backend

# Stop
docker compose down
```

The backend waits for PostgreSQL to pass its health check before starting.
Alembic migrations run automatically on container start.

---

## Running Tests

Tests use an in-memory SQLite database — **no PostgreSQL required**.

```bash
# Run all tests
uv run pytest

# Run with verbose output
uv run pytest -v

# Run a specific test file
uv run pytest app/tests/test_buses.py -v

# Run with coverage
uv run pytest --cov=app
```

---

## API Endpoints

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/health` | Application health check |
| GET | `/api/v1/health/database` | Database connectivity check |

### Buses

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/buses` | Register a new bus |
| GET | `/api/v1/buses` | List all buses (paginated) |
| GET | `/api/v1/buses/{bus_id}` | Get a single bus |
| PUT | `/api/v1/buses/{bus_id}` | Update a bus |
| DELETE | `/api/v1/buses/{bus_id}` | Delete a bus |

**Query parameters for GET /buses:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `status` (ACTIVE | INACTIVE | OFFLINE)

### Videos

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/videos/upload` | Upload a video file (multipart) |
| GET | `/api/v1/videos` | List videos (paginated) |
| GET | `/api/v1/videos/{video_id}` | Get video metadata |
| DELETE | `/api/v1/videos/{video_id}` | Delete video + file |
| POST | `/api/v1/videos/{video_id}/process` | Create processing job |
| GET | `/api/v1/videos/{video_id}/status` | Get processing status |

**Upload form fields:**
- `file` — video file (required)
- `bus_id` — UUID (optional)
- `latitude` — float -90 to 90 (optional)
- `longitude` — float -180 to 180 (optional)

### Processing

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/processing/{job_id}` | Get processing job details |

---

## Example Workflow

```bash
# 1. Register a bus
curl -X POST http://localhost:8000/api/v1/buses \
  -H "Content-Type: application/json" \
  -d '{"bus_number": "BUS_001", "registration_number": "MH01AB1234", "route_number": "R101"}'

# 2. Upload a video
curl -X POST http://localhost:8000/api/v1/videos/upload \
  -F "file=@road_video.mp4" \
  -F "bus_id=<bus-uuid-from-step-1>" \
  -F "latitude=19.0760" \
  -F "longitude=72.8777"

# 3. Create a processing job (Phase 2 AI will execute it)
curl -X POST http://localhost:8000/api/v1/videos/<video-id>/process

# 4. Check processing status
curl http://localhost:8000/api/v1/videos/<video-id>/status
```

---

## Project Structure

```
urbaneye-ai/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app factory
│   │   ├── api/
│   │   │   ├── dependencies.py      # Database dependency
│   │   │   └── v1/
│   │   │       ├── router.py        # Route aggregator
│   │   │       ├── health.py        # Health endpoints
│   │   │       ├── buses.py         # Bus CRUD
│   │   │       ├── videos.py        # Video + job endpoints
│   │   │       └── processing.py    # Job retrieval
│   │   ├── core/
│   │   │   ├── config.py            # Pydantic settings
│   │   │   ├── database.py          # SQLAlchemy engine
│   │   │   ├── logging.py           # Logging setup
│   │   │   └── constants.py        # Enums & constants
│   │   ├── models/
│   │   │   ├── base.py              # Base + TimestampMixin
│   │   │   ├── bus.py               # Bus ORM model
│   │   │   ├── video.py             # Video ORM model
│   │   │   └── processing_job.py   # ProcessingJob model
│   │   ├── schemas/
│   │   │   ├── common.py            # SuccessResponse, PaginatedResponse
│   │   │   ├── bus.py               # Bus schemas
│   │   │   ├── video.py             # Video schemas
│   │   │   └── processing.py       # Processing schemas
│   │   ├── repositories/            # Data access layer
│   │   ├── services/                # Business logic layer
│   │   └── tests/                   # pytest tests
│   ├── alembic/                     # Database migrations
│   ├── storage/                     # File storage
│   ├── pyproject.toml               # uv / Python deps
│   ├── Dockerfile                   # Multi-stage Docker build
│   ├── docker-compose.yml           # Full stack compose
│   └── .env.example                 # Environment template
└── storage/                         # Shared storage mount
    ├── uploads/
    ├── processed/
    ├── evidence/
    └── thumbnails/
```

---

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://...` | PostgreSQL connection URL |
| `MAX_UPLOAD_SIZE_MB` | `500` | Maximum video upload size |
| `ALLOWED_VIDEO_EXTENSIONS` | `.mp4,.avi,.mov,.mkv` | Accepted video formats |
| `CORS_ORIGINS` | `localhost:3000,...` | Allowed frontend origins |
| `DEBUG` | `true` | Enable debug logging & SQL echo |
| `UPLOAD_PATH` | `storage/uploads` | Video file storage path |

---

## Response Format

All endpoints return a consistent JSON envelope:

**Success:**
```json
{
  "success": true,
  "message": "Bus registered successfully.",
  "data": { ... }
}
```

**Paginated:**
```json
{
  "success": true,
  "data": [ ... ],
  "page": 1,
  "limit": 20,
  "total": 45,
  "total_pages": 3
}
```

**Error:**
```json
{
  "success": false,
  "message": "Bus with number 'BUS_001' already exists.",
  "detail": null
}
```

---

---

## Phase 2 Features — AI Computer Vision & Traffic Intelligence 🚀

| Component | Status | Description |
|---|---|---|
| Object Detection | ✅ Complete | YOLO v11/v8 inference with COCO traffic class filtering |
| Multi-Object Tracking | ✅ Complete | Integrated ByteTrack tracking for persistent object IDs |
| Trajectory Tracking | ✅ Complete | Coordinate histories and instantaneous pixel speed calculation |
| Vehicle Counting | ✅ Complete | Unique vehicle counter avoiding duplicate counts |
| Density Analysis | ✅ Complete | Dynamic classification (LOW, MEDIUM, HIGH, SEVERE) |
| Congestion Detection | ✅ Complete | Correlates volume and fleet speed to detect gridlock |
| Video Annotation | ✅ Complete | OpenCV renderer with bounding boxes, trails, and HUD dashboard |
| Async Execution | ✅ Complete | FastAPI BackgroundTasks worker with SessionLocal isolation |
| AI Results APIs | ✅ Complete | Detections, tracked objects, trajectories, and traffic analytics |

### Phase 2 Architecture

```
Incoming Video
      │
      ▼
OpenCV Stream (VideoProcessor)
      │
      ▼
YOLO v11 / v8 (YOLODetector)
      │
      ▼
ByteTrack (ByteTrackerWrapper)
      │
      ├──► TrajectoryManager (Paths & Pixel Speed)
      ├──► VehicleCounter (Unique Entities by Class)
      ├──► TrafficDensityAnalyzer (Volume Level)
      └──► CongestionDetector (Density vs Speed)
      │
      ▼
Annotator (VideoAnnotator) ──► Annotated Video (.mp4) + HUD Telemetry
      │
      ▼
PostgreSQL Persistence (SessionLocal)
      ├── detections
      ├── tracked_objects
      ├── trajectory_points
      └── traffic_analytics
```

### Phase 2 AI Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/videos/{video_id}/process` | Start AI computer vision processing in background |
| `GET` | `/api/v1/processing/{job_id}/results` | Get aggregated AI metrics and vehicle summaries |
| `GET` | `/api/v1/videos/{video_id}/detections` | Get paginated bounding box detections |
| `GET` | `/api/v1/videos/{video_id}/tracked-objects` | Get unique tracked vehicles and road users |
| `GET` | `/api/v1/tracked-objects/{id}/trajectory` | Get coordinate trail and speed telemetry |
| `GET` | `/api/v1/videos/{video_id}/analytics` | Get temporal traffic density and congestion timeline |

---

## License

MIT License — UrbanEye AI Team
