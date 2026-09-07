/**
 * UrbanEye AI — useMapData Hook
 *
 * Fetches GeoJSON datasets for buses, events, routes, segments, and heatmap
 * synchronized with active viewport bounds and filters.
 */

import { useCallback, useEffect, useState } from "react";
import { useMapStore } from "@/store/mapStore";
import {
  getMapBuses,
  getMapEvents,
  getMapHeatmap,
  getMapRoadSegments,
  getMapRoutes,
} from "@/services/api/map";
import type {
  BusFeatureCollection,
  EventFeatureCollection,
  HeatmapFeatureCollection,
  RoadSegmentFeatureCollection,
  RouteFeatureCollection,
} from "@/types/map";

export function useMapData() {
  const { bounds, filters, visibleLayers } = useMapStore();

  const [busesData, setBusesData] = useState<BusFeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });
  const [eventsData, setEventsData] = useState<EventFeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });
  const [routesData, setRoutesData] = useState<RouteFeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });
  const [segmentsData, setSegmentsData] = useState<RoadSegmentFeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });
  const [heatmapData, setHeatmapData] = useState<HeatmapFeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bboxParam = bounds ? `${bounds[0]},${bounds[1]},${bounds[2]},${bounds[3]}` : undefined;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const promises: Promise<any>[] = [];

      // 1. Buses
      if (visibleLayers.buses) {
        promises.push(
          getMapBuses({
            bbox: bboxParam,
            route_id: filters.routeId !== "all" ? filters.routeId : undefined,
          }).then(setBusesData)
        );
      }

      // 2. Events
      if (visibleLayers.events) {
        promises.push(
          getMapEvents({
            bbox: bboxParam,
            category: filters.category !== "all" ? filters.category : undefined,
            severity: filters.severity !== "all" ? filters.severity : undefined,
            event_type: filters.eventType !== "all" ? filters.eventType : undefined,
            bus_id: filters.busId !== "all" ? filters.busId : undefined,
          }).then(setEventsData)
        );
      }

      // 3. Routes
      if (visibleLayers.routes) {
        promises.push(
          getMapRoutes(filters.routeId !== "all" ? filters.routeId : undefined).then(setRoutesData)
        );
      }

      // 4. Road Segments
      if (visibleLayers.roadConditions) {
        promises.push(getMapRoadSegments(bboxParam).then(setSegmentsData));
      }

      // 5. Heatmap
      if (visibleLayers.congestion) {
        promises.push(getMapHeatmap(bboxParam).then(setHeatmapData));
      }

      await Promise.all(promises);
    } catch (err: any) {
      setError(err.message || "Failed to load spatial map data");
    } finally {
      setLoading(false);
    }
  }, [bboxParam, filters, visibleLayers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    busesData,
    eventsData,
    routesData,
    segmentsData,
    heatmapData,
    loading,
    error,
    refreshMapData: fetchData,
  };
}
