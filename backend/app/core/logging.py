"""
UrbanEye AI — Structured Application Logging

Configures the root Python logger once at startup.
All other modules should call `get_logger(__name__)` to obtain
a module-scoped logger that inherits this configuration.
"""

import logging
import sys
from typing import Optional


LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%dT%H:%M:%S"


def configure_logging(debug: bool = False) -> None:
    """
    Configure root logger with a consistent structured format.

    Call this once during application startup (main.py lifespan).

    Args:
        debug: When True, set log level to DEBUG; otherwise INFO.
    """
    level = logging.DEBUG if debug else logging.INFO

    # Remove any existing handlers to avoid duplicate output
    root_logger = logging.getLogger()
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    handler.setFormatter(logging.Formatter(fmt=LOG_FORMAT, datefmt=DATE_FORMAT))

    root_logger.setLevel(level)
    root_logger.addHandler(handler)

    # Quiet noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.DEBUG if debug else logging.WARNING
    )


def get_logger(name: str) -> logging.Logger:
    """
    Return a module-scoped logger.

    Usage:
        logger = get_logger(__name__)
        logger.info("Video uploaded: %s", video_id)

    Args:
        name: Typically ``__name__`` of the calling module.

    Returns:
        A :class:`logging.Logger` instance.
    """
    return logging.getLogger(name)
