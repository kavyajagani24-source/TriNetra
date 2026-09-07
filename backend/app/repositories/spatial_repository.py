"""
UrbanEye AI — Spatial Repository

Handles geospatial queries for events, buses, routes, and traffic heatmap points.
Optimized for PostGIS in PostgreSQL, with full fallback for SQLite test environments.
"""

from __future__ import annotations

import math
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import Session

from app.models.bus import Bus
from app.models.traffic_analytics import TrafficAnalytics
from app.models.urban_event import UrbanEvent
from app.models.video import Video


class SpatialRepository:
    """Repository handling bounding-box and spatial queries for Mapbox visualization."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def find_events_in_bbox(
        self,
        bbox: Optional[Tuple[float, float, float, float]] = None,
        category: Optional[str] = None,
        event_type: Optional[str] = None,
        severity: Optional[str] = None,
        bus_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 500,
    ) -> List[UrbanEvent]:
        """
        Query urban events with spatial bounding box and operational filters.
        bbox format: (min_lng, min_lat, max_lng, max_lat)
        """
        query = select(UrbanEvent).where(
            UrbanEvent.latitude.is_not(None),
            UrbanEvent.longitude.is_not(None),
        )

        if bbox is not None:
            min_lng, min_lat, max_lng, max_lat = bbox
            # Universal B-Tree / Spatial filtering on lat/lng
            query = query.where(
                and_(
                    UrbanEvent.latitude >= min_lat,
                    UrbanEvent.latitude <= max_lat,
                    UrbanEvent.longitude >= min_lng,
                    UrbanEvent.longitude <= max_lng,
                )
            )

        if category:
            query = query.where(UrbanEvent.category == category.upper())

        if event_type:
            query = query.where(UrbanEvent.event_type == event_type.upper())

        if severity:
            query = query.where(UrbanEvent.severity == severity.upper())

        if start_time:
            query = query.where(UrbanEvent.created_at >= start_time)

        if end_time:
            query = query.where(UrbanEvent.created_at <= end_time)

        if bus_id:
            # Join with Video to filter by Bus
            query = query.join(Video, UrbanEvent.video_id == Video.id).where(
                Video.bus_id == bus_id
            )

        query = query.order_by(desc(UrbanEvent.created_at)).limit(min(limit, 5000))
        return list(self.db.scalars(query).all())

    def find_buses_in_bbox(
        self,
        bbox: Optional[Tuple[float, float, float, float]] = None,
        route_id: Optional[str] = None,
        status: Optional[str] = None,
        bus_id: Optional[str] = None,
        limit: int = 500,
    ) -> List[Bus]:
        """
        Query fleet buses with valid GPS positions inside a bounding box.
        """
        query = select(Bus).where(
            Bus.latitude.is_not(None),
            Bus.longitude.is_not(None),
        )

        if bbox is not None:
            min_lng, min_lat, max_lng, max_lat = bbox
            query = query.where(
                and_(
                    Bus.latitude >= min_lat,
                    Bus.latitude <= max_lat,
                    Bus.longitude >= min_lng,
                    Bus.longitude <= max_lng,
                )
            )

        if route_id:
            query = query.where(Bus.route_number == route_id)

        if status:
            query = query.where(Bus.status == status.upper())

        if bus_id:
            try:
                b_uuid = UUID(bus_id)
                query = query.where(or_(Bus.id == b_uuid, Bus.bus_number == bus_id))
            except ValueError:
                query = query.where(Bus.bus_number == bus_id)

        query = query.limit(min(limit, 2000))
        return list(self.db.scalars(query).all())

    def find_nearby_events(
        self,
        lat: float,
        lng: float,
        radius_meters: float = 500.0,
        limit: int = 100,
    ) -> List[Tuple[UrbanEvent, float]]:
        """
        Find events within radius_meters of a coordinate point.
        Returns list of (UrbanEvent, distance_in_meters).
        """
        # Approx degrees for bounding box filtering before exact Haversine
        # 1 deg lat ~ 111,000m
        lat_delta = radius_meters / 111000.0
        lng_delta = radius_meters / (111000.0 * max(0.1, math.cos(math.radians(lat))))

        bbox = (lng - lng_delta, lat - lat_delta, lng + lng_delta, lat + lat_delta)
        candidates = self.find_events_in_bbox(bbox=bbox, limit=limit * 3)

        results = []
        for event in candidates:
            if event.latitude is None or event.longitude is None:
                continue
            dist = self._haversine(lat, lng, event.latitude, event.longitude)
            if dist <= radius_meters:
                results.append((event, round(dist, 1)))

        results.sort(key=lambda x: x[1])
        return results[:limit]

    def get_traffic_heatmap_observations(
        self,
        bbox: Optional[Tuple[float, float, float, float]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 500,
    ) -> List[Dict[str, Any]]:
        """
        Query traffic density observations and derive normalized congestion heatmap weights.
        """
        query = (
            select(
                TrafficAnalytics.active_vehicle_count,
                TrafficAnalytics.average_pixel_speed,
                TrafficAnalytics.congestion_level,
                UrbanEvent.latitude,
                UrbanEvent.longitude,
            )
            .join(UrbanEvent, TrafficAnalytics.video_id == UrbanEvent.video_id)
            .where(
                UrbanEvent.latitude.is_not(None),
                UrbanEvent.longitude.is_not(None),
            )
        )

        if bbox is not None:
            min_lng, min_lat, max_lng, max_lat = bbox
            query = query.where(
                and_(
                    UrbanEvent.latitude >= min_lat,
                    UrbanEvent.latitude <= max_lat,
                    UrbanEvent.longitude >= min_lng,
                    UrbanEvent.longitude <= max_lng,
                )
            )

        if start_time:
            query = query.where(TrafficAnalytics.created_at >= start_time)

        if end_time:
            query = query.where(TrafficAnalytics.created_at <= end_time)

        query = query.limit(min(limit, 1000))
        rows = self.db.execute(query).all()

        results = []
        for row in rows:
            veh_count, avg_speed, cong_lvl, lat, lng = row
            # Congestion weight calculation (0.0 to 1.0)
            density_score = min(1.0, (veh_count or 0) / 30.0)
            speed_penalty = max(0.0, 1.0 - ((avg_speed or 20.0) / 40.0))
            weight = round(min(1.0, (density_score * 0.6) + (speed_penalty * 0.4)), 3)

            results.append({
                "latitude": lat,
                "longitude": lng,
                "weight": weight,
                "vehicle_count": veh_count or 0,
                "average_speed": round(avg_speed or 0.0, 1),
                "congestion_level": cong_lvl or "LOW",
            })

        return results

    @staticmethod
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two coordinates in meters."""
        r = 6371000.0  # Earth radius in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = (
            math.sin(delta_phi / 2.0) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        )
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return r * c
