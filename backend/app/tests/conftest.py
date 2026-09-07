"""
UrbanEye AI — Test Configuration and Fixtures

Provides:
  • In-memory SQLite engine for isolated tests (no PostgreSQL required)
  • Database session override via FastAPI dependency injection
  • TestClient fixture with the full app
  • Mocked startup DB check so tests run without a live PostgreSQL instance

Key design decision — StaticPool:
    Plain ``sqlite://`` creates a brand-new, empty in-memory database for
    every new DBAPI connection.  When the app opens a second connection
    (e.g. on the first request) it would see an empty DB even though
    ``Base.metadata.create_all`` already ran on the fixture connection.
    ``StaticPool`` forces SQLAlchemy to reuse the *same* underlying
    DBAPI connection for every call, so all connections share one DB.
"""

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.main import app
from app.models.base import Base
# Import all models so SQLAlchemy knows about their tables
from app.models.bus import Bus  # noqa: F401
from app.models.video import Video  # noqa: F401
from app.models.processing_job import ProcessingJob  # noqa: F401
from app.models.detection import Detection  # noqa: F401
from app.models.tracked_object import TrackedObject  # noqa: F401
from app.models.traffic_analytics import TrafficAnalytics  # noqa: F401
from app.models.trajectory import TrajectoryPoint  # noqa: F401
from app.models.urban_event import UrbanEvent  # noqa: F401

# SQLite in-memory DB — no PostgreSQL required for tests.
# StaticPool ensures all connections reuse the same DBAPI connection so
# tables created in db_session are visible to every request handler.
SQLITE_URL = "sqlite://"

test_engine = create_engine(
    SQLITE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Enable foreign key enforcement in SQLite (mirrors PostgreSQL behaviour)
@event.listens_for(test_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

TestSessionLocal = sessionmaker(
    bind=test_engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh SQLite schema for each test function and return a session."""
    Base.metadata.create_all(bind=test_engine)
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session):
    """
    TestClient with:
    - DB dependency overridden to use the SQLite test session
    - PostgreSQL health check mocked to True (prevents startup hangs)
    """
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    # Mock DB health check and bind background tasks SessionLocal to SQLite
    with patch("app.main.check_database_connection", return_value=True), \
         patch("app.services.ai_processing_service.SessionLocal", TestSessionLocal):
        with TestClient(app, raise_server_exceptions=True) as test_client:
            yield test_client

    app.dependency_overrides.clear()
