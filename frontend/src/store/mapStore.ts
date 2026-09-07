/**
 * UrbanEye AI — Map State Management (Zustand)
 */

import { create } from "zustand";
import { DEFAULT_CENTER, DEFAULT_MAP_ZOOM } from "@/config/map";
import type { MapFiltersState, VisibleLayersState } from "@/types/map";

export interface MapState {
  center: [number, number];
  zoom: number;
  bounds: [number, number, number, number] | null;

  selectedBusId: string | null;
  selectedEventId: string | null;

  visibleLayers: VisibleLayersState;
  filters: MapFiltersState;

  mapStyle: "streets" | "satellite";
  followSelectedBus: boolean;
  realtimeStatus: "LIVE" | "RECONNECTING" | "OFFLINE";

  // Actions
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  setBounds: (bounds: [number, number, number, number]) => void;

  selectBus: (busId: string | null) => void;
  selectEvent: (eventId: string | null) => void;

  toggleLayer: (layer: keyof VisibleLayersState) => void;
  setLayerVisibility: (layer: keyof VisibleLayersState, visible: boolean) => void;

  setFilters: (filters: Partial<MapFiltersState>) => void;
  resetFilters: () => void;

  setMapStyle: (style: "streets" | "satellite") => void;
  setFollowSelectedBus: (follow: boolean) => void;
  setRealtimeStatus: (status: "LIVE" | "RECONNECTING" | "OFFLINE") => void;
}

const DEFAULT_FILTERS: MapFiltersState = {
  category: "all",
  severity: "all",
  eventType: "all",
  busId: "all",
  routeId: "all",
  timeRange: "all",
  searchQuery: "",
};

const DEFAULT_LAYERS: VisibleLayersState = {
  buses: true,
  events: true,
  routes: true,
  congestion: false,
  roadConditions: false,
};

export const useMapStore = create<MapState>((set) => ({
  center: DEFAULT_CENTER,
  zoom: DEFAULT_MAP_ZOOM,
  bounds: null,

  selectedBusId: null,
  selectedEventId: null,

  visibleLayers: DEFAULT_LAYERS,
  filters: DEFAULT_FILTERS,

  mapStyle: "streets",
  followSelectedBus: false,
  realtimeStatus: "OFFLINE",

  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setBounds: (bounds) => set({ bounds }),

  selectBus: (busId) => set({ selectedBusId: busId, selectedEventId: null }),
  selectEvent: (eventId) => set({ selectedEventId: eventId, selectedBusId: null }),

  toggleLayer: (layer) =>
    set((state) => ({
      visibleLayers: {
        ...state.visibleLayers,
        [layer]: !state.visibleLayers[layer],
      },
    })),

  setLayerVisibility: (layer, visible) =>
    set((state) => ({
      visibleLayers: {
        ...state.visibleLayers,
        [layer]: visible,
      },
    })),

  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),

  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  setMapStyle: (mapStyle) => set({ mapStyle }),
  setFollowSelectedBus: (followSelectedBus) => set({ followSelectedBus }),
  setRealtimeStatus: (realtimeStatus) => set({ realtimeStatus }),
}));
