"""
UrbanEye AI — Health Check Endpoints

GET /api/v1/health          — basic application health
GET /api/v1/health/database — database connectivity check
"""

from fastapi import APIRouter

from app.core.config import get_settings
from app.core.database import check_database_connection
from app.schemas.common import SuccessResponse

router = APIRouter(prefix="/health", tags=["Health"])

settings = get_settings()


@router.get(
    "",
    response_model=SuccessResponse[dict],
    summary="Application Health Check",
    description="Returns the current health status of the UrbanEye AI backend service.",
)
def health_check() -> SuccessResponse[dict]:
    """Basic health check endpoint."""
    return SuccessResponse(
        success=True,
        message="Service is healthy",
        data={
            "status": "healthy",
            "service": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.APP_ENV,
        },
    )


@router.get(
    "/database",
    response_model=SuccessResponse[dict],
    summary="Database Connectivity Check",
    description="Verifies that the backend can reach the PostgreSQL database.",
)
def database_health_check() -> SuccessResponse[dict]:
    """Database connectivity health check."""
    connected = check_database_connection()
    status = "healthy" if connected else "unhealthy"
    return SuccessResponse(
        success=connected,
        message="Database is reachable" if connected else "Database is unreachable",
        data={
            "status": status,
            "database": "postgresql",
        },
    )


@router.get(
    "/ai",
    response_model=SuccessResponse[dict],
    summary="AI Engine Health Check",
    description="Probes The-Sixth-Sense-AI status, model weights availability, and accelerator hardware.",
)
def ai_health_check() -> SuccessResponse[dict]:
    """AI engine readiness and hardware health check."""
    from pathlib import Path
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else None

    # Check Sixth Sense directory and models
    try:
        from app.api.sixth_sense_router import SIXTH_SENSE_ROOT
        ss_available = True
        ss_root_str = str(SIXTH_SENSE_ROOT)

        road_model_path = SIXTH_SENSE_ROOT / "models" / "yolo12s_RDD2022_best.pt"
        traffic_model_path = SIXTH_SENSE_ROOT / "models" / "yolo11x.pt"

        road_model_exists = road_model_path.exists()
        traffic_model_exists = traffic_model_path.exists()
    except Exception as exc:
        ss_available = False
        ss_root_str = None
        road_model_exists = False
        traffic_model_exists = False

    all_ready = ss_available and road_model_exists

    return SuccessResponse(
        success=all_ready,
        message="AI Engine ready" if all_ready else "AI Engine partially configured",
        data={
            "status": "ready" if all_ready else "degraded",
            "engine": "The-Sixth-Sense-AI",
            "sixth_sense_root": ss_root_str,
            "device": device,
            "gpu_name": gpu_name,
            "models": {
                "road_model_yolo12s": {
                    "available": road_model_exists,
                    "model_file": "yolo12s_RDD2022_best.pt",
                },
                "traffic_model_yolo11x": {
                    "available": traffic_model_exists,
                    "note": "Pre-bundled or auto-downloaded on first call",
                },
            },
        },
    )

