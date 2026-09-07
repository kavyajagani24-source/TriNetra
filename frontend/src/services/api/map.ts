/**
 * UrbanEye AI — Spatial & Map API Client Service
 */

import { apiClient } from "./client";
import { useAppStore } from "@/store/appStore";
import type {
  BusFeatureCollection,
  EventFeatureCollection,
  HeatmapFeatureCollection,
  RoadSegmentFeatureCollection,
  RouteFeatureCollection,
} from "@/types/map";
import {
  MOCK_BUS_FEATURES,
  MOCK_EVENT_FEATURES,
  MOCK_HEATMAP_FEATURES,
  MOCK_ROAD_SEGMENT_FEATURES,
  MOCK_ROUTE_FEATURES,
} from "@/mocks/map";

export interface MapEventsParams {
  bbox?: string;
  category?: string;
  event_type?: string;
  severity?: string;
  bus_id?: string;
  start_time?: string;
  end_time?: string;
  limit?: number;
}

export interface MapBusesParams {
  bbox?: string;
  route_id?: string;
  status?: string;
  bus_id?: string;
  limit?: number;
}

export async function getMapEvents(params: MapEventsParams = {}): Promise<EventFeatureCollection> {
  const isDemo = useAppStore.getState().demoMode;
  if (isDemo) {
    let filtered = [...MOCK_EVENT_FEATURES.features];
    if (params.category && params.category !== "all") {
      filtered = filtered.filter(
        (f) => f.properties.category.toLowerCase() === params.category!.toLowerCase()
      );
    }
    if (params.severity && params.severity !== "all") {
      filtered = filtered.filter(
        (f) => f.properties.severity.toLowerCase() === params.severity!.toLowerCase()
      );
    }
    return { type: "FeatureCollection", features: filtered };
  }

  try {
    const resp = await apiClient.get<EventFeatureCollection>("/map/events", { params });
    return resp.data;
  } catch (err) {
    console.warn("Falling back to demo event GeoJSON:", err);
    return MOCK_EVENT_FEATURES;
  }
}

export async function getMapBuses(params: MapBusesParams = {}): Promise<BusFeatureCollection> {
  const isDemo = useAppStore.getState().demoMode;
  if (isDemo) {
    let filtered = [...MOCK_BUS_FEATURES.features];
    if (params.status && params.status !== "all") {
      filtered = filtered.filter(
        (f) => f.properties.status.toLowerCase() === params.status!.toLowerCase()
      );
    }
    if (params.route_id && params.route_id !== "all") {
      filtered = filtered.filter((f) => f.properties.route_number === params.route_id);
    }
    return { type: "FeatureCollection", features: filtered };
  }

  try {
    const resp = await apiClient.get<BusFeatureCollection>("/map/buses", { params });
    return resp.data;
  } catch (err) {
    console.warn("Falling back to demo bus GeoJSON:", err);
    return MOCK_BUS_FEATURES;
  }
}

export async function getMapRoutes(routeId?: string): Promise<RouteFeatureCollection> {
  const isDemo = useAppStore.getState().demoMode;
  if (isDemo) {
    if (routeId) {
      return {
        type: "FeatureCollection",
        features: MOCK_ROUTE_FEATURES.features.filter((f) => f.properties.route_id === routeId),
      };
    }
    return MOCK_ROUTE_FEATURES;
  }

  try {
    const resp = await apiClient.get<RouteFeatureCollection>("/map/routes", {
      params: routeId ? { route_id: routeId } : undefined,
    });
    return resp.data;
  } catch {
    return MOCK_ROUTE_FEATURES;
  }
}

export async function getMapRoadSegments(bbox?: string): Promise<RoadSegmentFeatureCollection> {
  const isDemo = useAppStore.getState().demoMode;
  if (isDemo) return MOCK_ROAD_SEGMENT_FEATURES;

  try {
    const resp = await apiClient.get<RoadSegmentFeatureCollection>("/map/road-segments", {
      params: bbox ? { bbox } : undefined,
    });
    return resp.data;
  } catch {
    return MOCK_ROAD_SEGMENT_FEATURES;
  }
}

export async function getMapHeatmap(bbox?: string): Promise<HeatmapFeatureCollection> {
  const isDemo = useAppStore.getState().demoMode;
  if (isDemo) return MOCK_HEATMAP_FEATURES;

  try {
    const resp = await apiClient.get<HeatmapFeatureCollection>("/map/heatmap", {
      params: bbox ? { bbox } : undefined,
    });
    return resp.data;
  } catch {
    return MOCK_HEATMAP_FEATURES;
  }
}

export async function getNearbyEvents(
  lat: number,
  lng: number,
  radiusMeters = 500
): Promise<EventFeatureCollection> {
  const isDemo = useAppStore.getState().demoMode;
  if (isDemo) return MOCK_EVENT_FEATURES;

  try {
    const resp = await apiClient.get<EventFeatureCollection>("/map/events/nearby", {
      params: { latitude: lat, longitude: lng, radius_meters: radiusMeters },
    });
    return resp.data;
  } catch {
    return MOCK_EVENT_FEATURES;
  }
}
