/**
 * TriNetra — Pedestrian Movement & VRU Safety Hotspots Types
 */

export type MovementDensity = "high" | "medium" | "low";
export type SafetyRiskLevel = "high" | "medium" | "low";

export type HotspotZoneType =
  | "school_zone"
  | "crosswalk"
  | "transit_hub"
  | "commercial_market"
  | "arterial_crossing";

export interface PedestrianHotspot {
  id: string;
  name: string;
  zone_type: HotspotZoneType;
  movement_density: MovementDensity;
  risk_level: SafetyRiskLevel;
  /** [longitude, latitude] for Mapbox / GeoJSON standard */
  coordinates: [number, number];
  pedestrians_per_hour: number;
  near_miss_count: number;
  peak_hours: string;
  active_school_zone: boolean;
  bus_routes_affected: string[];
  conflict_types: string[];
  recommended_action: string;
  /** Linked SafetyIncident IDs from current run if applicable */
  associated_run_incidents?: string[];
  description: string;
}

export type HotspotDensityFilter = "all" | "high" | "medium" | "low";
export type HotspotZoneFilter = "all" | HotspotZoneType;
