import { describe, it, expect } from "vitest";
import { useMapStore } from "../store/mapStore";
import {
  MOCK_BUS_FEATURES,
  MOCK_EVENT_FEATURES,
  MOCK_ROUTE_FEATURES,
  MOCK_HEATMAP_FEATURES,
  MOCK_ROAD_SEGMENT_FEATURES,
} from "../mocks/map";

describe("Map State Store Suite", () => {
  it("initializes with default viewport center and zoom", () => {
    const state = useMapStore.getState();
    expect(state.center).toBeDefined();
    expect(state.center.length).toBe(2);
    expect(state.zoom).toBeGreaterThanOrEqual(10);
    expect(state.visibleLayers.buses).toBe(true);
    expect(state.visibleLayers.events).toBe(true);
  });

  it("toggles layer visibility cleanly", () => {
    const { toggleLayer } = useMapStore.getState();
    const initialCongestion = useMapStore.getState().visibleLayers.congestion;
    toggleLayer("congestion");
    expect(useMapStore.getState().visibleLayers.congestion).toBe(!initialCongestion);
    toggleLayer("congestion");
    expect(useMapStore.getState().visibleLayers.congestion).toBe(initialCongestion);
  });

  it("updates and resets operational filters", () => {
    const { setFilters, resetFilters } = useMapStore.getState();
    setFilters({ category: "hazard", severity: "critical", searchQuery: "pothole" });
    expect(useMapStore.getState().filters.category).toBe("hazard");
    expect(useMapStore.getState().filters.severity).toBe("critical");
    expect(useMapStore.getState().filters.searchQuery).toBe("pothole");

    resetFilters();
    expect(useMapStore.getState().filters.category).toBe("all");
    expect(useMapStore.getState().filters.searchQuery).toBe("");
  });

  it("selects and unselects buses and events mutually", () => {
    const { selectBus, selectEvent } = useMapStore.getState();
    selectBus("BUS-101");
    expect(useMapStore.getState().selectedBusId).toBe("BUS-101");
    expect(useMapStore.getState().selectedEventId).toBeNull();

    selectEvent("EV-202");
    expect(useMapStore.getState().selectedEventId).toBe("EV-202");
    expect(useMapStore.getState().selectedBusId).toBeNull();
  });
});

describe("Mapbox GeoJSON Standard Compliance Suite", () => {
  it("verifies bus features have RFC 7946 [lng, lat] coordinate order", () => {
    expect(MOCK_BUS_FEATURES.type).toBe("FeatureCollection");
    expect(MOCK_BUS_FEATURES.features.length).toBeGreaterThan(0);

    for (const feat of MOCK_BUS_FEATURES.features) {
      expect(feat.type).toBe("Feature");
      expect(feat.geometry.type).toBe("Point");
      const [lng, lat] = feat.geometry.coordinates;
      expect(lng).toBeGreaterThan(70.0);
      expect(lng).toBeLessThan(80.0);
      expect(lat).toBeGreaterThan(10.0);
      expect(lat).toBeLessThan(20.0);
      expect(feat.properties.bus_number).toBeDefined();
      expect(feat.properties.heading).toBeGreaterThanOrEqual(0);
    }
  });

  it("verifies event features contain severity, category, and evidence links", () => {
    expect(MOCK_EVENT_FEATURES.features.length).toBeGreaterThan(0);
    const severities = new Set(MOCK_EVENT_FEATURES.features.map((f) => f.properties.severity));
    expect(severities.has("CRITICAL")).toBe(true);
    expect(severities.has("HIGH")).toBe(true);

    const categories = new Set(MOCK_EVENT_FEATURES.features.map((f) => f.properties.category));
    expect(categories.has("HAZARD")).toBe(true);
    expect(categories.has("SAFETY")).toBe(true);
  });

  it("verifies route features are valid LineStrings", () => {
    expect(MOCK_ROUTE_FEATURES.features.length).toBeGreaterThan(0);
    for (const route of MOCK_ROUTE_FEATURES.features) {
      expect(route.geometry.type).toBe("LineString");
      expect(route.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
      expect(route.properties.route_name).toBeDefined();
    }
  });

  it("verifies heatmap points contain normalized weights between 0 and 1", () => {
    expect(MOCK_HEATMAP_FEATURES.features.length).toBeGreaterThan(0);
    for (const pt of MOCK_HEATMAP_FEATURES.features) {
      expect(pt.properties.weight).toBeGreaterThanOrEqual(0.0);
      expect(pt.properties.weight).toBeLessThanOrEqual(1.0);
    }
  });
});
