"""
UrbanEye AI — Processing Job Endpoints

GET /api/v1/processing/{job_id} — Retrieve a specific processing job
"""

import uuid

from fastapi import APIRouter, HTTPException, status

from app.api.dependencies import DatabaseDep
from app.schemas.common import SuccessResponse
from app.schemas.processing import ProcessingJobResponse
from app.services.exceptions import NotFoundError
from app.services.processing_service import ProcessingService

router = APIRouter(prefix="/processing", tags=["Processing"])


@router.get(
    "/{job_id}",
    response_model=SuccessResponse[ProcessingJobResponse],
    summary="Get Processing Job",
    description="Returns the full details of a processing job by its UUID.",
)
def get_processing_job(
    job_id: uuid.UUID,
    db: DatabaseDep,
) -> SuccessResponse[ProcessingJobResponse]:
    service = ProcessingService(db)
    try:
        job = service.get_job(job_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)

    return SuccessResponse(
        message="Processing job retrieved successfully.",
        data=ProcessingJobResponse.model_validate(job),
    )
