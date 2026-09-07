"""
UrbanEye AI — API Dependencies

Central FastAPI dependency definitions.
Structured so authentication middleware can be injected here in Phase 3
without changing any route signatures.
"""

from collections.abc import Generator

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db

# Re-export the database session dependency so all routers
# import from one place: `from app.api.dependencies import DatabaseDep`
from typing import Annotated

DatabaseDep = Annotated[Session, Depends(get_db)]
