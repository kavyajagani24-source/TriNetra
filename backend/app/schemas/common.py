"""
UrbanEye AI — Common / Shared Pydantic Schemas

Provides generic response wrappers used consistently across all endpoints:
  • SuccessResponse[T]   — wraps successful payload
  • ErrorResponse        — wraps error detail
  • PaginatedResponse[T] — wraps paginated list results
"""

from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class SuccessResponse(BaseModel, Generic[T]):
    """Standard success response envelope."""

    success: bool = True
    message: str = "Success"
    data: Optional[T] = None

    model_config = {"arbitrary_types_allowed": True}


class ErrorResponse(BaseModel):
    """Standard error response envelope."""

    success: bool = False
    message: str
    detail: Optional[Any] = None


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated list response with metadata."""

    success: bool = True
    message: str = "Success"
    data: list[T] = Field(default_factory=list)
    page: int
    limit: int
    total: int
    total_pages: int

    @classmethod
    def build(
        cls,
        items: list[T],
        page: int,
        limit: int,
        total: int,
    ) -> "PaginatedResponse[T]":
        """Convenience constructor that calculates total_pages."""
        import math
        return cls(
            data=items,
            page=page,
            limit=limit,
            total=total,
            total_pages=max(1, math.ceil(total / limit)) if limit else 1,
        )
