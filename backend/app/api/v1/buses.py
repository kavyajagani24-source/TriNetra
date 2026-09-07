"""
UrbanEye AI — Bus CRUD Endpoints

POST   /api/v1/buses           — Create a bus
GET    /api/v1/buses           — List buses (paginated, filterable)
GET    /api/v1/buses/{bus_id}  — Get a single bus
PUT    /api/v1/buses/{bus_id}  — Update a bus
DELETE /api/v1/buses/{bus_id}  — Delete a bus
"""

import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.api.dependencies import DatabaseDep
from app.schemas.bus import BusCreate, BusListResponse, BusResponse, BusUpdate
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.services.bus_service import BusService
from app.services.exceptions import ConflictError, NotFoundError, ValidationError

router = APIRouter(prefix="/buses", tags=["Buses"])


def _get_service(db: DatabaseDep) -> BusService:
    return BusService(db)


# ── Create ────────────────────────────────────────────────────────────────────
@router.post(
    "",
    response_model=SuccessResponse[BusResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Register a New Bus",
    description="Creates a new bus record in the system.",
)
def create_bus(
    payload: BusCreate,
    db: DatabaseDep,
) -> SuccessResponse[BusResponse]:
    service = _get_service(db)
    try:
        bus = service.create_bus(payload)
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.message)

    return SuccessResponse(
        message="Bus registered successfully.",
        data=BusResponse.model_validate(bus),
    )


# ── List ──────────────────────────────────────────────────────────────────────
@router.get(
    "",
    response_model=PaginatedResponse[BusListResponse],
    summary="List All Buses",
    description="Returns a paginated list of buses, optionally filtered by status.",
)
def list_buses(
    db: DatabaseDep,
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=20, ge=1, le=100, description="Records per page"),
    status_filter: Optional[str] = Query(
        default=None, alias="status", description="Filter by bus status"
    ),
) -> PaginatedResponse[BusListResponse]:
    service = _get_service(db)
    try:
        buses, total = service.list_buses(
            page=page, limit=limit, status=status_filter
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.message)

    return PaginatedResponse.build(
        items=[BusListResponse.model_validate(b) for b in buses],
        page=page,
        limit=limit,
        total=total,
    )


# ── Get Single ────────────────────────────────────────────────────────────────
@router.get(
    "/{bus_id}",
    response_model=SuccessResponse[BusResponse],
    summary="Get a Bus",
    description="Returns the full details for a single bus by UUID.",
)
def get_bus(
    bus_id: uuid.UUID,
    db: DatabaseDep,
) -> SuccessResponse[BusResponse]:
    service = _get_service(db)
    try:
        bus = service.get_bus(bus_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)

    return SuccessResponse(
        message="Bus retrieved successfully.",
        data=BusResponse.model_validate(bus),
    )


# ── Update ────────────────────────────────────────────────────────────────────
@router.put(
    "/{bus_id}",
    response_model=SuccessResponse[BusResponse],
    summary="Update a Bus",
    description="Partially updates a bus record. Only provided fields are changed.",
)
def update_bus(
    bus_id: uuid.UUID,
    payload: BusUpdate,
    db: DatabaseDep,
) -> SuccessResponse[BusResponse]:
    service = _get_service(db)
    try:
        bus = service.update_bus(bus_id, payload)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message)

    return SuccessResponse(
        message="Bus updated successfully.",
        data=BusResponse.model_validate(bus),
    )


# ── Delete ────────────────────────────────────────────────────────────────────
@router.delete(
    "/{bus_id}",
    status_code=status.HTTP_200_OK,
    response_model=SuccessResponse[None],
    summary="Delete a Bus",
    description="Permanently removes a bus and all its associated videos.",
)
def delete_bus(
    bus_id: uuid.UUID,
    db: DatabaseDep,
) -> SuccessResponse[None]:
    service = _get_service(db)
    try:
        service.delete_bus(bus_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)

    return SuccessResponse(message="Bus deleted successfully.", data=None)
