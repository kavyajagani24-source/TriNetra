/**
 * UrbanEye AI — Geospatial & Map Types (RFC 7946 GeoJSON)
 */

export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

export interface GeoJSONLineString {
  type: "LineString";
  coordinates: [number, number][]; // [[lng, lat], ...]
}

export interface BusMapProperties {
  bus_id: string;
  bus_number: string;
  registration_number?: string | null;
  route_number?: string | null;
  status: "ACTIVE" | "MAINTENANCE" | "INACTIVE" | string;
  speed: number;
  heading: number;
  latitude: number;
  longitude: number;
  last_updated_at?: string | null;
  active_event_count?: number;
}

export interface EventMapProperties {
  event_id: string;
  event_type: string;
  category: "HAZARD" | "INFRASTRUCTURE" | "SAFETY" | "BEHAVIOR" | "INCIDENT" | string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;
  confidence: number;
  bus_id?: string | null;
  video_id: string;
  job_id: string;
  frame_number: number;
  timestamp: number;
  description: string;
  evidence_url?: string | null;
  extra_metadata?: Record<string, unknown>;
  created_at: string;
}

export interface RouteMapProperties {
  route_id: string;
  route_name: string;
  active_bus_count: number;
  average_speed: number;
  event_count: number;
}

export interface RoadSegmentProperties {
  segment_id: string;
  road_name: string;
  condition_score: number;
  pothole_count: number;
  road_damage_count: number;
  waterlogging_count: number;
  event_count: number;
  last_observed_at?: string | null;
}

export interface HeatmapProperties {
  weight: number; // 0.0 to 1.0
  vehicle_count: number;
  average_speed: number;
  congestion_level: string;
}

export interface GeoJSONFeature<G = GeoJSONPoint | GeoJSONLineString, P = Record<string, unknown>> {
  type: "Feature";
  geometry: G;
  properties: P;
}

export interface GeoJSONFeatureCollection<G = GeoJSONPoint | GeoJSONLineString, P = Record<string, unknown>> {
  type: "FeatureCollection";
  features: GeoJSONFeature<G, P>[];
}

export type BusFeatureCollection = GeoJSONFeatureCollection<GeoJSONPoint, BusMapProperties>;
export type EventFeatureCollection = GeoJSONFeatureCollection<GeoJSONPoint, EventMapProperties>;
export type RouteFeatureCollection = GeoJSONFeatureCollection<GeoJSONLineString, RouteMapProperties>;
export type RoadSegmentFeatureCollection = GeoJSONFeatureCollection<GeoJSONLineString, RoadSegmentProperties>;
export type HeatmapFeatureCollection = GeoJSONFeatureCollection<GeoJSONPoint, HeatmapProperties>;

export interface MapFiltersState {
  category: string;
  severity: string;
  eventType: string;
  busId: string;
  routeId: string;
  timeRange: "15m" | "1h" | "6h" | "today" | "all";
  searchQuery: string;
}

export interface VisibleLayersState {
  buses: boolean;
  events: boolean;
  routes: boolean;
  congestion: boolean;
  roadConditions: boolean;
}

export interface RealtimeMapMessage {
  type: "BUS_LOCATION_UPDATED" | "EVENT_CREATED" | "HEARTBEAT" | "CONNECTION_ESTABLISHED" | "PONG";
  status?: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
}
