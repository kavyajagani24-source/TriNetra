"""
UrbanEye AI — Database Models
"""

from app.models.base import Base, TimestampMixin
from app.models.bus import Bus
from app.models.detection import Detection
from app.models.processing_job import ProcessingJob
from app.models.tracked_object import TrackedObject
from app.models.traffic_analytics import TrafficAnalytics
from app.models.trajectory import TrajectoryPoint
from app.models.urban_event import UrbanEvent
from app.models.video import Video

__all__ = [
    "Base",
    "TimestampMixin",
    "Bus",
    "Video",
    "ProcessingJob",
    "Detection",
    "TrackedObject",
    "TrajectoryPoint",
    "TrafficAnalytics",
    "UrbanEvent",
]
