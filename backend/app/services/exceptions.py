"""
UrbanEye AI — Custom Application Exceptions

Defined centrally so all services raise the same error types and
the global exception handlers in main.py can translate them to
consistent HTTP responses.
"""

from typing import Any, Optional


class UrbanEyeBaseError(Exception):
    """Base exception for all application-level errors."""

    def __init__(self, message: str, detail: Optional[Any] = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail


class NotFoundError(UrbanEyeBaseError):
    """Raised when a requested resource does not exist."""
    pass


class ConflictError(UrbanEyeBaseError):
    """Raised when a resource with the same unique key already exists."""
    pass


class ValidationError(UrbanEyeBaseError):
    """Raised when input validation fails inside a service."""
    pass


class StorageError(UrbanEyeBaseError):
    """Raised when a file-system operation fails."""
    pass


class ProcessingConflictError(ConflictError):
    """Raised when a duplicate active processing job is detected."""
    pass
