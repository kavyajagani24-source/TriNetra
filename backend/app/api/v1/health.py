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
