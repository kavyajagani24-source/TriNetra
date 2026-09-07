/**
 * UrbanEye AI — Mapbox GIS Configuration
 */

export const MAPBOX_ACCESS_TOKEN =
  (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string) || "";

export const DEFAULT_MAP_LNG = parseFloat(
  (import.meta.env.VITE_DEFAULT_MAP_LNG as string) || "72.868"
);

export const DEFAULT_MAP_LAT = parseFloat(
  (import.meta.env.VITE_DEFAULT_MAP_LAT as string) || "19.065"
);

export const DEFAULT_MAP_ZOOM = parseFloat(
  (import.meta.env.VITE_DEFAULT_MAP_ZOOM as string) || "12"
);

export const MAP_STYLES = {
  // Deep Command-Center Dark Street View (Mapbox Dark v11)
  streets: "mapbox://styles/mapbox/dark-v11",
  // High-Resolution Satellite with Street Overlay
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  // Light mode fallback
  light: "mapbox://styles/mapbox/light-v11",
};

export const DEFAULT_CENTER: [number, number] = [DEFAULT_MAP_LNG, DEFAULT_MAP_LAT];
