"""
UrbanEye AI — Application Configuration

Single source of truth for all runtime configuration.  Values are read
from environment variables (or a .env file) via pydantic-settings.
Never import raw os.environ anywhere else — always use `get_settings()`.
"""

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralised application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ───────────────────────────────────────────────────────────
    APP_NAME: str = "UrbanEye AI"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # ── Server ────────────────────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = (
        "postgresql+psycopg://urbaneye:urbaneye@localhost:5432/urbaneye"
    )

    # ── Storage ───────────────────────────────────────────────────────────────
    STORAGE_PATH: str = "storage"
    UPLOAD_PATH: str = "storage/uploads"
    PROCESSED_PATH: str = "storage/processed"
    EVIDENCE_PATH: str = "storage/evidence"
    THUMBNAIL_PATH: str = "storage/thumbnails"

    # ── Upload Limits ─────────────────────────────────────────────────────────
    MAX_UPLOAD_SIZE_MB: int = 500

    # ── Allowed Video Extensions ──────────────────────────────────────────────
    ALLOWED_VIDEO_EXTENSIONS: str = ".mp4,.avi,.mov,.mkv"

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"

    # ── Phase 2: AI / YOLO ────────────────────────────────────────────────────
    YOLO_MODEL: str = "yolo11n.pt"
    YOLO_CONFIDENCE_THRESHOLD: float = 0.40
    YOLO_IOU_THRESHOLD: float = 0.50
    YOLO_DEVICE: str = "auto"
    ENABLE_TRACKING: bool = True
    TRACKER_TYPE: str = "bytetrack"

    # ── Phase 2: Video Processing ──────────────────────────────────────────────
    PROCESS_EVERY_N_FRAMES: int = 1
    PROGRESS_UPDATE_INTERVAL: int = 30

    # ── Phase 2: Trajectories ─────────────────────────────────────────────────
    MAX_TRAJECTORY_POINTS: int = 100
    TRAJECTORY_SAVE_INTERVAL: int = 5

    # ── Phase 2: Detection Persistence ────────────────────────────────────────
    SAVE_ALL_DETECTIONS: bool = False
    DETECTION_SAVE_INTERVAL: int = 10

    # ── Phase 2: Analytics ────────────────────────────────────────────────────
    ANALYTICS_INTERVAL_FRAMES: int = 30
    TRAFFIC_LOW_THRESHOLD: int = 5
    TRAFFIC_MEDIUM_THRESHOLD: int = 10
    TRAFFIC_HIGH_THRESHOLD: int = 20

    # ── Phase 2: Congestion ───────────────────────────────────────────────────
    CONGESTION_VEHICLE_THRESHOLD: int = 15
    CONGESTION_SPEED_THRESHOLD: float = 10.0

    # ── Phase 2: Visualization ────────────────────────────────────────────────
    SAVE_ANNOTATED_VIDEO: bool = True
    DRAW_TRAJECTORIES: bool = True
    SAVE_DETECTION_EVIDENCE: bool = True
    EVIDENCE_SAVE_INTERVAL: int = 150

    # ── Phase 3: Road Intelligence & Hazard Detection ─────────────────────────
    ENABLE_HAZARD_DETECTION: bool = True
    ENABLE_INFRASTRUCTURE_ANALYSIS: bool = True
    ENABLE_SAFETY_ANALYSIS: bool = True
    ENABLE_BEHAVIOR_ANALYSIS: bool = True
    EVENT_DEDUP_FRAME_WINDOW: int = 300
    NEAR_MISS_DISTANCE_PX: float = 85.0
    RASH_DRIVING_ANGLE_DEG: float = 40.0


    # ── Derived helpers ───────────────────────────────────────────────────────
    @property
    def max_upload_size_bytes(self) -> int:
        """Maximum allowed upload size in bytes."""
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    @property
    def allowed_extensions_list(self) -> List[str]:
        """Parsed list of allowed video file extensions."""
        return [
            ext.strip().lower()
            for ext in self.ALLOWED_VIDEO_EXTENSIONS.split(",")
            if ext.strip()
        ]

    @property
    def cors_origins_list(self) -> List[str]:
        """Parsed list of allowed CORS origins."""
        return [
            origin.strip()
            for origin in self.CORS_ORIGINS.split(",")
            if origin.strip()
        ]

    @property
    def upload_path_obj(self) -> Path:
        return Path(self.UPLOAD_PATH)

    @property
    def processed_path_obj(self) -> Path:
        return Path(self.PROCESSED_PATH)

    @property
    def evidence_path_obj(self) -> Path:
        return Path(self.EVIDENCE_PATH)

    @property
    def thumbnail_path_obj(self) -> Path:
        return Path(self.THUMBNAIL_PATH)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    return Settings()
