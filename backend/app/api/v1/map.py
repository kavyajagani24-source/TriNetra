"""
UrbanEye AI — Spatial & Map GIS REST & WebSocket APIs

Provides GeoJSON endpoints for Mapbox WebGL layers and real-time WebSocket streaming.
All endpoints return standard RFC 7946 FeatureCollections with [longitude, latitude] coordinates.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from fastapi import (
    APIRouter,
    Depends,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.map import (
    BusFeatureCollection,
    EventFeatureCollection,
    HeatmapFeatureCollection,
    RoadSegmentFeatureCollection,
    RouteFeatureCollection,
)
from app.services.spatial_service import SpatialService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/map", tags=["GIS & Spatial Map"])


# ── Realtime WebSocket Connection Manager ────────────────────────────────────

class MapConnectionManager:
    """Manages active browser WebSocket connections for real-time map telemetry."""

    def __init__(self) -> None:
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info("WebSocket map client connected. Total active: %d", len(self.active_connections))

    def disconnect(self, websocket: WebSocket) -> None:
        self.active_connections.discard(websocket)
        logger.info("WebSocket map client disconnected. Remaining: %d", len(self.active_connections))

    async def broadcast(self, message: Dict[str, Any]) -> None:
        """Broadcast JSON message to all connected clients."""
        if not self.active_connections:
            return

        dead_connections: List[WebSocket] = []
        payload = json.dumps(message)

        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception:
                dead_connections.append(connection)

        for dead in dead_connections:
            self.active_connections.discard(dead)


map_connection_manager = MapConnectionManager()


# ── REST Endpoints ───────────────────────────────────────────────────────────

@router.get(
    "/events",
    response_model=EventFeatureCollection,
    summary="Get Urban Events as GeoJSON Point FeatureCollection",
)
def get_map_events(
    bbox: Optional[str] = Query(
        None,
        description="Bounding box in 'minLng,minLat,maxLng,maxLat' format (e.g. '77.5,12.8,77.7,13.1')",
    ),
    category: Optional[str] = Query(
        None,
        description="Filter by category: HAZARD, INFRASTRUCTURE, SAFETY, BEHAVIOR, INCIDENT",
    ),
    event_type: Optional[str] = Query(
        None,
        description="Filter by event type (e.g. POTHOLE, WATERLOGGING, NEAR_MISS)",
    ),
    severity: Optional[str] = Query(
        None,
        description="Filter by severity: LOW, MEDIUM, HIGH, CRITICAL",
    ),
    bus_id: Optional[str] = Query(
        None,
        description="Filter events observed by a specific bus",
    ),
    start_time: Optional[datetime] = Query(
        None,
        description="Filter events created at or after timestamp",
    ),
    end_time: Optional[datetime] = Query(
        None,
        description="Filter events created at or before timestamp",
    ),
    limit: int = Query(
        500,
        ge=1,
        le=5000,
        description="Maximum number of features to return",
    ),
    db: Session = Depends(get_db),
) -> EventFeatureCollection:
    """Retrieve urban events within the current map viewport as standard GeoJSON."""
    service = SpatialService(db)
    return service.get_events_geojson(
        bbox_str=bbox,
        category=category,
        event_type=event_type,
        severity=severity,
        bus_id=bus_id,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
    )


@router.get(
    "/buses",
    response_model=BusFeatureCollection,
    summary="Get Fleet Buses as GeoJSON Point FeatureCollection",
)
def get_map_buses(
    bbox: Optional[str] = Query(
        None,
        description="Bounding box in 'minLng,minLat,maxLng,maxLat' format",
    ),
    route_id: Optional[str] = Query(
        None,
        description="Filter by assigned route number",
    ),
    status: Optional[str] = Query(
        None,
        description="Filter by status: ACTIVE, MAINTENANCE, INACTIVE",
    ),
    bus_id: Optional[str] = Query(
        None,
        description="Filter by specific bus ID or bus number",
    ),
    limit: int = Query(
        500,
        ge=1,
        le=2000,
        description="Maximum number of bus features to return",
    ),
    db: Session = Depends(get_db),
) -> BusFeatureCollection:
    """Retrieve sensing buses with active GPS positions as standard GeoJSON."""
    service = SpatialService(db)
    return service.get_buses_geojson(
        bbox_str=bbox,
        route_id=route_id,
        status_filter=status,
        bus_id=bus_id,
        limit=limit,
    )


@router.get(
    "/routes",
    response_model=RouteFeatureCollection,
    summary="Get Transit Routes as GeoJSON LineString FeatureCollection",
)
def get_map_routes(
    route_id: Optional[str] = Query(
        None,
        description="Filter by specific route ID (e.g. R-500A)",
    ),
    db: Session = Depends(get_db),
) -> RouteFeatureCollection:
    """Retrieve bus routes and transit corridors with average speed and event counts."""
    service = SpatialService(db)
    return service.get_routes_geojson(route_id=route_id)


@router.get(
    "/road-segments",
    response_model=RoadSegmentFeatureCollection,
    summary="Get Road Condition Segments as GeoJSON LineString FeatureCollection",
)
def get_map_road_segments(
    bbox: Optional[str] = Query(
        None,
        description="Bounding box in 'minLng,minLat,maxLng,maxLat' format",
    ),
    db: Session = Depends(get_db),
) -> RoadSegmentFeatureCollection:
    """Retrieve road segments with condition health scores (0-100) and defect density."""
    service = SpatialService(db)
    return service.get_road_segments_geojson(bbox_str=bbox)


@router.get(
    "/heatmap",
    response_model=HeatmapFeatureCollection,
    summary="Get Traffic Congestion Heatmap as GeoJSON Point FeatureCollection",
)
def get_map_heatmap(
    bbox: Optional[str] = Query(
        None,
        description="Bounding box in 'minLng,minLat,maxLng,maxLat' format",
    ),
    start_time: Optional[datetime] = Query(
        None,
        description="Start time for traffic observations",
    ),
    end_time: Optional[datetime] = Query(
        None,
        description="End time for traffic observations",
    ),
    limit: int = Query(
        500,
        ge=1,
        le=1000,
        description="Maximum number of heatmap points",
    ),
    db: Session = Depends(get_db),
) -> HeatmapFeatureCollection:
    """Retrieve weighted traffic observation points for Mapbox WebGL heatmap layer."""
    service = SpatialService(db)
    return service.get_heatmap_geojson(
        bbox_str=bbox,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
    )


@router.get(
    "/events/nearby",
    response_model=EventFeatureCollection,
    summary="Find Urban Events within a Geographic Radius",
)
def get_nearby_events(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Center latitude"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Center longitude"),
    radius_meters: float = Query(500.0, ge=10.0, le=50000.0, description="Search radius in meters"),
    limit: int = Query(100, ge=1, le=500, description="Maximum events to return"),
    db: Session = Depends(get_db),
) -> EventFeatureCollection:
    """Find events within radius_meters of a coordinate point (e.g. for bus proximity alerts)."""
    service = SpatialService(db)
    return service.get_nearby_events_geojson(
        lat=latitude,
        lng=longitude,
        radius_meters=radius_meters,
        limit=limit,
    )


# ── WebSocket Streaming Endpoint ─────────────────────────────────────────────

@router.websocket("/ws/map")
async def websocket_map_stream(websocket: WebSocket) -> None:
    """
    Real-time streaming channel for live bus position telemetry and newly detected events.
    Emits messages: BUS_LOCATION_UPDATED, EVENT_CREATED, and periodic HEARTBEAT.
    """
    await map_connection_manager.connect(websocket)
    try:
        # Initial greeting and handshake
        await websocket.send_text(
            json.dumps({
                "type": "CONNECTION_ESTABLISHED",
                "status": "LIVE",
                "timestamp": datetime.utcnow().isoformat(),
            })
        )

        while True:
            # Keep-alive ping/pong receiver
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                msg = json.loads(data)
                if msg.get("type") == "PING":
                    await websocket.send_text(json.dumps({"type": "PONG", "timestamp": datetime.utcnow().isoformat()}))
            except asyncio.TimeoutError:
                # Send server heartbeat
                await websocket.send_text(json.dumps({"type": "HEARTBEAT", "timestamp": datetime.utcnow().isoformat()}))
    except WebSocketDisconnect:
        map_connection_manager.disconnect(websocket)
    except Exception as exc:
        logger.warning("WebSocket map connection error: %s", exc)
        map_connection_manager.disconnect(websocket)
