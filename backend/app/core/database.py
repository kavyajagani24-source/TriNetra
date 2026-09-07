"""
UrbanEye AI — Database Engine and Session Management

Uses SQLAlchemy 2.x synchronous engine with psycopg driver.
All database interactions go through the `get_db` FastAPI dependency
which guarantees session cleanup even on exceptions.

Architecture:
    API Request → get_db dependency → Session → Repository → DB
"""

from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

settings = get_settings()

is_sqlite = "sqlite" in settings.DATABASE_URL
engine_kwargs = {
    "echo": settings.DEBUG,
    "pool_pre_ping": True,
}

if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20
    engine_kwargs["pool_recycle"] = 3600
    engine_kwargs["connect_args"] = {"connect_timeout": 3}

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)

# ── Session Factory ───────────────────────────────────────────────────────────
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,        # Avoids lazy-load errors after commit
)


# ── FastAPI Dependency ────────────────────────────────────────────────────────
def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a database session per request.

    Yields a SQLAlchemy Session and ensures it is closed after the
    request completes, even if an exception is raised.

    Usage::

        @router.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def check_database_connection() -> bool:
    """
    Verify that the database is reachable.

    Returns:
        True if the connection succeeds, False otherwise.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.error("Database connection check failed: %s", exc)
        return False
