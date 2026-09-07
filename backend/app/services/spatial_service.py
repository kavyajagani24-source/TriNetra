"""
UrbanEye AI — Spatial Service Layer

Translates spatial queries into RFC 7946 compliant GeoJSON FeatureCollections.
Handles coordinate validation, bounding box parsing, and corridor telemetry.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.bus import Bus
from app.models.urban_event import UrbanEvent
from app.repositories.spatial_repository import SpatialRepository
from app.schemas.map import (
    BusFeature,
    BusFeatureCollection,
    BusMapProperties,
    EventFeature,
    EventFeatureCollection,
    EventMapProperties,
    HeatmapFeature,
    HeatmapFeatureCollection,
    HeatmapProperties,
    LineStringGeometry,
    PointGeometry,
    RoadSegmentFeature,
    RoadSegmentFeatureCollection,
    RoadSegmentProperties,
    RouteFeature,
    RouteFeatureCollection,
    RouteMapProperties,
)


class SpatialService:
    """Service layer for geospatial transformations and GeoJSON generation."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = SpatialRepository(db)

    def parse_bbox(self, bbox_str: Optional[str]) -> Optional[Tuple[float, float, float, float]]:
        """
        Parse and validate a bounding box string: 'minLng,minLat,maxLng,maxLat'.
        """
        if not bbox_str:
            return None

        parts = bbox_str.strip().split(",")
        if len(parts) != 4:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid bbox format. Expected 'minLng,minLat,maxLng,maxLat'.",
            )

        try:
            min_lng, min_lat, max_lng, max_lat = map(float, parts)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bbox coordinates must be valid floating-point numbers.",
            )

        # Validate range
        if not (-180.0 <= min_lng <= 180.0 and -180.0 <= max_lng <= 180.0):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Longitude must be between -180.0 and 180.0 degrees.",
            )
        if not (-90.0 <= min_lat <= 90.0 and -90.0 <= max_lat <= 90.0):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Latitude must be between -90.0 and 90.0 degrees.",
            )

        if min_lng > max_lng:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="minLng cannot be greater than maxLng.",
            )
        if min_lat > max_lat:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="minLat cannot be greater than maxLat.",
            )

        return (min_lng, min_lat, max_lng, max_lat)

    def get_events_geojson(
        self,
        bbox_str: Optional[str] = None,
        category: Optional[str] = None,
        event_type: Optional[str] = None,
        severity: Optional[str] = None,
        bus_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 500,
    ) -> EventFeatureCollection:
        """Fetch urban events and return standard GeoJSON Point FeatureCollection."""
        bbox = self.parse_bbox(bbox_str)
        events = self.repo.find_events_in_bbox(
            bbox=bbox,
            category=category,
            event_type=event_type,
            severity=severity,
            bus_id=bus_id,
            start_time=start_time,
            end_time=end_time,
            limit=limit,
        )

        features: List[EventFeature] = []
        for ev in events:
            if ev.longitude is None or ev.latitude is None:
                continue

            evidence_url = None
            if ev.extra_metadata and isinstance(ev.extra_metadata, dict):
                evidence_url = (
                    ev.extra_metadata.get("evidence_path")
                    or ev.extra_metadata.get("snapshot_url")
                    or ev.extra_metadata.get("image_url")
                )

            features.append(
                EventFeature(
                    type="Feature",
                    geometry=PointGeometry(
                        type="Point",
                        coordinates=[round(ev.longitude, 6), round(ev.latitude, 6)],
                    ),
                    properties=EventMapProperties(
                        event_id=str(ev.id),
                        event_type=ev.event_type,
                        category=ev.category,
                        severity=ev.severity,
                        confidence=ev.confidence,
                        video_id=str(ev.video_id),
                        job_id=str(ev.job_id),
                        frame_number=ev.frame_number,
                        timestamp=ev.timestamp,
                        description=ev.description or "",
                        evidence_url=evidence_url,
                        extra_metadata=ev.extra_metadata or {},
                        created_at=ev.created_at.isoformat() if ev.created_at else "",
                    ),
                )
            )

        return EventFeatureCollection(type="FeatureCollection", features=features)

    def get_buses_geojson(
        self,
        bbox_str: Optional[str] = None,
        route_id: Optional[str] = None,
        status_filter: Optional[str] = None,
        bus_id: Optional[str] = None,
        limit: int = 500,
    ) -> BusFeatureCollection:
        """Fetch fleet buses and return GeoJSON Point FeatureCollection."""
        bbox = self.parse_bbox(bbox_str)
        buses = self.repo.find_buses_in_bbox(
            bbox=bbox,
            route_id=route_id,
            status=status_filter,
            bus_id=bus_id,
            limit=limit,
        )

        features: List[BusFeature] = []
        for b in buses:
            if b.longitude is None or b.latitude is None:
                continue

            features.append(
                BusFeature(
                    type="Feature",
                    geometry=PointGeometry(
                        type="Point",
                        coordinates=[round(b.longitude, 6), round(b.latitude, 6)],
                    ),
                    properties=BusMapProperties(
                        bus_id=str(b.id),
                        bus_number=b.bus_number,
                        registration_number=b.registration_number,
                        route_number=b.route_number,
                        status=b.status,
                        speed=b.speed or 0.0,
                        heading=b.heading or 0.0,
                        latitude=b.latitude,
                        longitude=b.longitude,
                        last_updated_at=b.last_location_update.isoformat() if b.last_location_update else None,
                    ),
                )
            )

        return BusFeatureCollection(type="FeatureCollection", features=features)

    def get_nearby_events_geojson(
        self,
        lat: float,
        lng: float,
        radius_meters: float = 500.0,
        limit: int = 100,
    ) -> EventFeatureCollection:
        """Find events nearby a coordinate and return GeoJSON FeatureCollection."""
        if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Coordinates out of valid geographic range.",
            )

        events_with_dist = self.repo.find_nearby_events(
            lat=lat, lng=lng, radius_meters=radius_meters, limit=limit
        )

        features: List[EventFeature] = []
        for ev, dist in events_with_dist:
            if ev.longitude is None or ev.latitude is None:
                continue

            meta = dict(ev.extra_metadata or {})
            meta["distance_meters"] = dist

            features.append(
                EventFeature(
                    type="Feature",
                    geometry=PointGeometry(
                        type="Point",
                        coordinates=[round(ev.longitude, 6), round(ev.latitude, 6)],
                    ),
                    properties=EventMapProperties(
                        event_id=str(ev.id),
                        event_type=ev.event_type,
                        category=ev.category,
                        severity=ev.severity,
                        confidence=ev.confidence,
                        video_id=str(ev.video_id),
                        job_id=str(ev.job_id),
                        frame_number=ev.frame_number,
                        timestamp=ev.timestamp,
                        description=ev.description or "",
                        extra_metadata=meta,
                        created_at=ev.created_at.isoformat() if ev.created_at else "",
                    ),
                )
            )

        return EventFeatureCollection(type="FeatureCollection", features=features)

    def get_heatmap_geojson(
        self,
        bbox_str: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 500,
    ) -> HeatmapFeatureCollection:
        """Fetch traffic observations and return weighted heatmap point features."""
        bbox = self.parse_bbox(bbox_str)
        obs = self.repo.get_traffic_heatmap_observations(
            bbox=bbox, start_time=start_time, end_time=end_time, limit=limit
        )

        features: List[HeatmapFeature] = []
        for pt in obs:
            features.append(
                HeatmapFeature(
                    type="Feature",
                    geometry=PointGeometry(
                        type="Point",
                        coordinates=[round(pt["longitude"], 6), round(pt["latitude"], 6)],
                    ),
                    properties=HeatmapProperties(
                        weight=pt["weight"],
                        vehicle_count=pt["vehicle_count"],
                        average_speed=pt["average_speed"],
                        congestion_level=pt["congestion_level"],
                    ),
                )
            )

        return HeatmapFeatureCollection(type="FeatureCollection", features=features)

    def get_routes_geojson(self, route_id: Optional[str] = None) -> RouteFeatureCollection:
        """
        Return transit corridors and bus routes as LineString features.
        Provides canonical geometries (Outer Ring Road, MG Road, Hosur Road, Airport Road).
        """
        # Canonical arterial corridors (coordinates as [lng, lat])
        routes_data = [
            {
                "id": "R-500A",
                "name": "Outer Ring Road Express",
                "coordinates": [
                    [77.60, 12.90],
                    [77.65, 12.895],
                    [77.69, 12.912],
                    [77.715, 12.945],
                    [77.72, 12.985],
                    [77.70, 13.02],
                    [77.66, 13.04],
                    [77.61, 13.045],
                    [77.565, 13.03],
                    [77.535, 12.995],
                    [77.53, 12.955],
                    [77.55, 12.915],
                    [77.585, 12.90],
                    [77.60, 12.90],
                ],
                "active_buses": 12,
                "avg_speed": 26.5,
                "events": 14,
            },
            {
                "id": "R-MG1",
                "name": "MG Road Corridor",
                "coordinates": [
                    [77.5946, 12.9752],
                    [77.6050, 12.9754],
                    [77.6165, 12.9749],
                    [77.6270, 12.9737],
                ],
                "active_buses": 6,
                "avg_speed": 18.2,
                "events": 5,
            },
            {
                "id": "R-HOS",
                "name": "Hosur Road Arterial",
                "coordinates": [
                    [77.5985, 12.9605],
                    [77.6070, 12.9450],
                    [77.6170, 12.9280],
                    [77.6280, 12.9120],
                    [77.6380, 12.8970],
                ],
                "active_buses": 8,
                "avg_speed": 22.0,
                "events": 9,
            },
            {
                "id": "R-AIR",
                "name": "Old Airport Road Transit",
                "coordinates": [
                    [77.6000, 12.9605],
                    [77.6200, 12.9612],
                    [77.6450, 12.9598],
                    [77.6680, 12.9585],
                    [77.6920, 12.9580],
                ],
                "active_buses": 7,
                "avg_speed": 24.1,
                "events": 8,
            },
        ]

        if route_id:
            routes_data = [r for r in routes_data if r["id"] == route_id]

        features: List[RouteFeature] = []
        for r in routes_data:
            features.append(
                RouteFeature(
                    type="Feature",
                    geometry=LineStringGeometry(
                        type="LineString",
                        coordinates=r["coordinates"],
                    ),
                    properties=RouteMapProperties(
                        route_id=r["id"],
                        route_name=r["name"],
                        active_bus_count=r["active_buses"],
                        average_speed=r["avg_speed"],
                        event_count=r["events"],
                    ),
                )
            )

        return RouteFeatureCollection(type="FeatureCollection", features=features)

    def get_road_segments_geojson(
        self, bbox_str: Optional[str] = None
    ) -> RoadSegmentFeatureCollection:
        """
        Return road segments with health scores and defect counts as GeoJSON LineStrings.
        """
        segments = [
            {
                "id": "seg-orr-01",
                "name": "ORR: Marathahalli - Bellandur",
                "score": 68.4,
                "potholes": 4,
                "damage": 2,
                "waterlogging": 1,
                "coords": [
                    [77.695, 12.955],
                    [77.685, 12.940],
                    [77.675, 12.930],
                ],
            },
            {
                "id": "seg-mg-01",
                "name": "MG Road: Trinity - Brigade",
                "score": 91.2,
                "potholes": 0,
                "damage": 1,
                "waterlogging": 0,
                "coords": [
                    [77.6165, 12.9749],
                    [77.6050, 12.9754],
                ],
            },
            {
                "id": "seg-air-01",
                "name": "Old Airport: Domlur - HAL",
                "score": 79.5,
                "potholes": 2,
                "damage": 1,
                "waterlogging": 0,
                "coords": [
                    [77.640, 12.960],
                    [77.665, 12.958],
                ],
            },
        ]

        features: List[RoadSegmentFeature] = []
        for seg in segments:
            features.append(
                RoadSegmentFeature(
                    type="Feature",
                    geometry=LineStringGeometry(
                        type="LineString",
                        coordinates=seg["coords"],
                    ),
                    properties=RoadSegmentProperties(
                        segment_id=seg["id"],
                        road_name=seg["name"],
                        condition_score=seg["score"],
                        pothole_count=seg["potholes"],
                        road_damage_count=seg["damage"],
                        waterlogging_count=seg["waterlogging"],
                        event_count=seg["potholes"] + seg["damage"] + seg["waterlogging"],
                    ),
                )
            )

        return RoadSegmentFeatureCollection(type="FeatureCollection", features=features)
