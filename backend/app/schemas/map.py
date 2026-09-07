"""
UrbanEye AI — GeoJSON & Map Pydantic Schemas

Standard GeoJSON data contracts compliant with RFC 7946.
Coordinates are strictly [longitude, latitude].
"""

from __future__ import annotations

from typing import Any, Dict, Generic, List, Literal, Optional, TypeVar
from pydantic import BaseModel, Field


# ── GeoJSON Geometry Types ───────────────────────────────────────────────────

class PointGeometry(BaseModel):
    type: Literal["Point"] = "Point"
    # [longitude, latitude]
    coordinates: List[float] = Field(
        ...,
        min_length=2,
        max_length=3,
        description="GeoJSON coordinates: [longitude, latitude]",
    )


class LineStringGeometry(BaseModel):
    type: Literal["LineString"] = "LineString"
    # [[longitude, latitude], ...]
    coordinates: List[List[float]] = Field(
        ...,
        description="List of [longitude, latitude] coordinates",
    )


# ── Feature Properties ───────────────────────────────────────────────────────

class BusMapProperties(BaseModel):
    bus_id: str
    bus_number: str
    registration_number: Optional[str] = None
    route_number: Optional[str] = None
    status: str
    speed: float = 0.0
    heading: float = 0.0
    latitude: float
    longitude: float
    last_updated_at: Optional[str] = None
    active_event_count: int = 0


class EventMapProperties(BaseModel):
    event_id: str
    event_type: str
    category: str
    severity: str
    confidence: float
    bus_id: Optional[str] = None
    video_id: str
    job_id: str
    frame_number: int
    timestamp: float
    description: str
    evidence_url: Optional[str] = None
    extra_metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: str


class RouteMapProperties(BaseModel):
    route_id: str
    route_name: str
    active_bus_count: int = 0
    average_speed: float = 0.0
    event_count: int = 0


class RoadSegmentProperties(BaseModel):
    segment_id: str
    road_name: str
    condition_score: float = 100.0
    pothole_count: int = 0
    road_damage_count: int = 0
    waterlogging_count: int = 0
    event_count: int = 0
    last_observed_at: Optional[str] = None


class HeatmapProperties(BaseModel):
    weight: float = Field(..., ge=0.0, le=1.0, description="Congestion score (0.0 to 1.0)")
    vehicle_count: int = 0
    average_speed: float = 0.0
    congestion_level: str = "LOW"


# ── Generic GeoJSON Feature & Collection ─────────────────────────────────────

GeometryT = TypeVar("GeometryT", PointGeometry, LineStringGeometry)
PropertiesT = TypeVar("PropertiesT", bound=BaseModel)


class GeoJSONFeature(BaseModel, Generic[GeometryT, PropertiesT]):
    type: Literal["Feature"] = "Feature"
    geometry: GeometryT
    properties: PropertiesT


class GeoJSONFeatureCollection(BaseModel, Generic[GeometryT, PropertiesT]):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: List[GeoJSONFeature[GeometryT, PropertiesT]] = Field(default_factory=list)


# Concrete Type Aliases
BusFeature = GeoJSONFeature[PointGeometry, BusMapProperties]
BusFeatureCollection = GeoJSONFeatureCollection[PointGeometry, BusMapProperties]

EventFeature = GeoJSONFeature[PointGeometry, EventMapProperties]
EventFeatureCollection = GeoJSONFeatureCollection[PointGeometry, EventMapProperties]

RouteFeature = GeoJSONFeature[LineStringGeometry, RouteMapProperties]
RouteFeatureCollection = GeoJSONFeatureCollection[LineStringGeometry, RouteMapProperties]

RoadSegmentFeature = GeoJSONFeature[LineStringGeometry, RoadSegmentProperties]
RoadSegmentFeatureCollection = GeoJSONFeatureCollection[LineStringGeometry, RoadSegmentProperties]

HeatmapFeature = GeoJSONFeature[PointGeometry, HeatmapProperties]
HeatmapFeatureCollection = GeoJSONFeatureCollection[PointGeometry, HeatmapProperties]


# ── Realtime WebSocket Messages ──────────────────────────────────────────────

class RealtimeMessage(BaseModel):
    type: str  # "BUS_LOCATION_UPDATED" | "EVENT_CREATED" | "HEARTBEAT"
    payload: Dict[str, Any]
