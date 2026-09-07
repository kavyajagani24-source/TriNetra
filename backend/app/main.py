"""
UrbanEye AI — FastAPI Application Entry Point

Configures:
  • Application metadata (title, version, description)
  • API router (all v1 routes)
  • CORS middleware (configurable origins)
  • Global exception handlers
  • Startup / shutdown lifecycle events
  • Swagger (/docs) and Redoc (/redoc) documentation
"""

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import router as api_v1_router
from app.core.config import get_settings
from app.core.database import check_database_connection
from app.core.logging import configure_logging, get_logger
from app.schemas.common import ErrorResponse
from app.services.exceptions import (
    ConflictError,
    NotFoundError,
    ProcessingConflictError,
    StorageError,
    UrbanEyeBaseError,
    ValidationError,
)
from app.services.storage_service import StorageService

settings = get_settings()

# Configure logging before anything else
configure_logging(debug=settings.DEBUG)
logger = get_logger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    # ── Startup ───────────────────────────────────────────────────────────────
    logger.info(
        "Starting %s v%s [%s]",
        settings.APP_NAME,
        settings.APP_VERSION,
        settings.APP_ENV,
    )

    # Ensure all storage directories exist
    storage = StorageService()
    storage.ensure_storage_directories()

    # Log DB connectivity status and initialize tables
    if check_database_connection():
        logger.info("Database connection: OK")
        from app.models.base import Base
        import app.models  # noqa: F401
        from app.core.database import engine
        Base.metadata.create_all(bind=engine)
        logger.info("Database schema verified / initialized.")
    else:
        logger.warning(
            "Database connection: FAILED — ensure PostgreSQL is running "
            "and DATABASE_URL is correct."
        )

    logger.info(
        "UrbanEye AI is ready. Docs: http://%s:%d/docs",
        settings.HOST,
        settings.PORT,
    )

    yield  # Application runs here

    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("Shutting down %s …", settings.APP_NAME)


# ── Application Factory ───────────────────────────────────────────────────────
def create_application() -> FastAPI:
    """Create and configure the FastAPI application instance."""

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "**UrbanEye AI** — AI-Powered Mobile Urban Intelligence Platform.\n\n"
            "Transforms public transport buses into intelligent mobile sensing units "
            "capable of detecting vehicles, pedestrians, traffic density, potholes, "
            "road hazards, and more.\n\n"
            "**Phase 1 API** — Backend foundation: bus management, video ingestion, "
            "metadata extraction, and processing job scaffolding."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
        contact={
            "name": "UrbanEye AI Team",
            "email": "urbaneye@example.com",
        },
        license_info={"name": "MIT"},
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(api_v1_router)

    # ── Static Files (Evidence & Processed Video Storage) ─────────────────────
    import os
    if os.path.exists(settings.STORAGE_PATH):
        app.mount("/storage", StaticFiles(directory=settings.STORAGE_PATH), name="storage")

    # ── Exception Handlers ────────────────────────────────────────────────────
    _register_exception_handlers(app)

    return app


# ── Exception Handlers ────────────────────────────────────────────────────────
def _register_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers — never expose stack traces to clients."""

    @app.exception_handler(NotFoundError)
    async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=ErrorResponse(message=exc.message, detail=exc.detail).model_dump(),
        )

    @app.exception_handler(ConflictError)
    async def conflict_handler(request: Request, exc: ConflictError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=ErrorResponse(message=exc.message, detail=exc.detail).model_dump(),
        )

    @app.exception_handler(ProcessingConflictError)
    async def proc_conflict_handler(
        request: Request, exc: ProcessingConflictError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=ErrorResponse(message=exc.message, detail=exc.detail).model_dump(),
        )

    @app.exception_handler(ValidationError)
    async def validation_handler(
        request: Request, exc: ValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=ErrorResponse(message=exc.message, detail=exc.detail).model_dump(),
        )

    @app.exception_handler(StorageError)
    async def storage_handler(request: Request, exc: StorageError) -> JSONResponse:
        logger.error("Storage error: %s", exc.message)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponse(
                message="A storage error occurred.", detail=None
            ).model_dump(),
        )

    @app.exception_handler(UrbanEyeBaseError)
    async def base_error_handler(
        request: Request, exc: UrbanEyeBaseError
    ) -> JSONResponse:
        logger.error("Unhandled application error: %s", exc.message)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponse(
                message="An internal error occurred.", detail=None
            ).model_dump(),
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(
        request: Request, exc: HTTPException
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponse(
                message=str(exc.detail), detail=None
            ).model_dump(),
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        logger.exception("Unexpected error on %s %s", request.method, request.url)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponse(
                message="An unexpected error occurred. Please try again.",
                detail=None,
            ).model_dump(),
        )


# ── Application Instance ──────────────────────────────────────────────────────
app = create_application()
