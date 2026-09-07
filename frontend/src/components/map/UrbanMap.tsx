/**
 * UrbanEye AI — Master UrbanMap Engine
 *
 * Direct Mapbox GL JS WebGL implementation.
 * Manages singleton map instance, clustering, GeoJSON data sources,
 * layer visibility, click interactions, and viewport resize observers.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_ACCESS_TOKEN, MAP_STYLES } from "@/config/map";
import { useMapStore } from "@/store/mapStore";
import type {
  BusFeatureCollection,
  EventFeatureCollection,
  HeatmapFeatureCollection,
  RoadSegmentFeatureCollection,
  RouteFeatureCollection,
  BusMapProperties,
  EventMapProperties,
} from "@/types/map";
import { BusPopup } from "./BusPopup";
import { EventPopup } from "./EventPopup";
import { AlertCircle, KeyRound, Sparkles } from "lucide-react";

interface UrbanMapProps {
  busesData: BusFeatureCollection;
  eventsData: EventFeatureCollection;
  routesData: RouteFeatureCollection;
  segmentsData: RoadSegmentFeatureCollection;
  heatmapData: HeatmapFeatureCollection;
  onInspectEvidence?: (event: EventMapProperties) => void;
  onViewFleet?: (busId: string) => void;
  className?: string;
  onMapReady?: (map: mapboxgl.Map) => void;
}

export function UrbanMap({
  busesData,
  eventsData,
  routesData,
  segmentsData,
  heatmapData,
  onInspectEvidence,
  onViewFleet,
  className = "",
  onMapReady,
}: UrbanMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const {
    center,
    zoom,
    mapStyle,
    visibleLayers,
    setCenter,
    setZoom,
    setBounds,
    selectedBusId,
    selectedEventId,
    selectBus,
    selectEvent,
  } = useMapStore();

  const [activeBusPopup, setActiveBusPopup] = useState<BusMapProperties | null>(null);
  const [activeEventPopup, setActiveEventPopup] = useState<EventMapProperties | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hasValidToken, setHasValidToken] = useState(Boolean(MAPBOX_ACCESS_TOKEN && MAPBOX_ACCESS_TOKEN.startsWith("pk.")));

  // ── 1. Map Initialization (Run Once) ────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !hasValidToken) return;

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLES[mapStyle] || MAP_STYLES.streets,
      center,
      zoom,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on("load", () => {
      setMapLoaded(true);
      if (onMapReady) onMapReady(map);

      // Add Sources
      // 1. Buses Source with Clustering
      map.addSource("urbaneye-buses", {
        type: "geojson",
        data: busesData,
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 50,
      });

      // 2. Events Source with Clustering
      map.addSource("urbaneye-events", {
        type: "geojson",
        data: eventsData,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 40,
      });

      // 3. Routes Source
      map.addSource("urbaneye-routes", {
        type: "geojson",
        data: routesData,
      });

      // 4. Road Segments Source
      map.addSource("urbaneye-road-segments", {
        type: "geojson",
        data: segmentsData,
      });

      // 5. Heatmap Source
      map.addSource("urbaneye-heatmap", {
        type: "geojson",
        data: heatmapData,
      });

      // ── WebGL Layers Setup ────────────────────────────────────────────────

      // 1. Heatmap Layer
      map.addLayer({
        id: "layer-heatmap",
        type: "heatmap",
        source: "urbaneye-heatmap",
        layout: { visibility: visibleLayers.congestion ? "visible" : "none" },
        paint: {
          "heatmap-weight": ["get", "weight"],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 15, 3],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(33,102,172,0)",
            0.2,
            "rgb(103,169,207)",
            0.4,
            "rgb(209,229,240)",
            0.6,
            "rgb(253,219,199)",
            0.8,
            "rgb(239,138,98)",
            1,
            "rgb(178,24,43)",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 4, 15, 30],
          "heatmap-opacity": 0.8,
        },
      });

      // 2. Routes Layer
      map.addLayer({
        id: "layer-routes",
        type: "line",
        source: "urbaneye-routes",
        layout: {
          visibility: visibleLayers.routes ? "visible" : "none",
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#06b6d4",
          "line-width": 3.5,
          "line-opacity": 0.85,
        },
      });

      // 3. Road Segments Layer
      map.addLayer({
        id: "layer-road-segments",
        type: "line",
        source: "urbaneye-road-segments",
        layout: {
          visibility: visibleLayers.roadConditions ? "visible" : "none",
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": [
            "step",
            ["get", "condition_score"],
            "#ef4444",
            50,
            "#f59e0b",
            80,
            "#10b981",
          ],
          "line-width": 4.5,
          "line-opacity": 0.9,
        },
      });

      // 4. Events Clusters & Points
      map.addLayer({
        id: "layer-events-clusters",
        type: "circle",
        source: "urbaneye-events",
        filter: ["has", "point_count"],
        layout: { visibility: visibleLayers.events ? "visible" : "none" },
        paint: {
          "circle-color": "#f97316",
          "circle-radius": ["step", ["get", "point_count"], 18, 5, 24, 15, 32],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.9,
        },
      });

      map.addLayer({
        id: "layer-events-cluster-count",
        type: "symbol",
        source: "urbaneye-events",
        filter: ["has", "point_count"],
        layout: {
          visibility: visibleLayers.events ? "visible" : "none",
          "text-field": "{point_count_abbreviated}",
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 11,
        },
        paint: { "text-color": "#ffffff" },
      });

      map.addLayer({
        id: "layer-events-points",
        type: "circle",
        source: "urbaneye-events",
        filter: ["!", ["has", "point_count"]],
        layout: { visibility: visibleLayers.events ? "visible" : "none" },
        paint: {
          "circle-color": [
            "match",
            ["get", "severity"],
            "CRITICAL",
            "#ef4444",
            "HIGH",
            "#f97316",
            "MEDIUM",
            "#f59e0b",
            "#10b981",
          ],
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // 5. Buses Clusters & Points
      map.addLayer({
        id: "layer-buses-clusters",
        type: "circle",
        source: "urbaneye-buses",
        filter: ["has", "point_count"],
        layout: { visibility: visibleLayers.buses ? "visible" : "none" },
        paint: {
          "circle-color": "#3b82f6",
          "circle-radius": ["step", ["get", "point_count"], 18, 5, 24, 10, 30],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.9,
        },
      });

      map.addLayer({
        id: "layer-buses-cluster-count",
        type: "symbol",
        source: "urbaneye-buses",
        filter: ["has", "point_count"],
        layout: {
          visibility: visibleLayers.buses ? "visible" : "none",
          "text-field": "{point_count_abbreviated}",
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 11,
        },
        paint: { "text-color": "#ffffff" },
      });

      map.addLayer({
        id: "layer-buses-points",
        type: "circle",
        source: "urbaneye-buses",
        filter: ["!", ["has", "point_count"]],
        layout: { visibility: visibleLayers.buses ? "visible" : "none" },
        paint: {
          "circle-color": [
            "match",
            ["get", "status"],
            "ACTIVE",
            "#10b981",
            "MAINTENANCE",
            "#f59e0b",
            "#94a3b8",
          ],
          "circle-radius": 8,
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
        },
      });

      // ── Event Handlers: Clicks & Cluster Zooms ────────────────────────────

      // Event cluster zoom
      map.on("click", "layer-events-clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["layer-events-clusters"] });
        const clusterId = features[0].properties?.cluster_id;
        const source = map.getSource("urbaneye-events") as mapboxgl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId, (err, zoomLevel) => {
          if (err || zoomLevel == null) return;
          const geom = features[0].geometry as GeoJSON.Point;
          map.easeTo({ center: geom.coordinates as [number, number], zoom: zoomLevel + 1 });
        });
      });

      // Bus cluster zoom
      map.on("click", "layer-buses-clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["layer-buses-clusters"] });
        const clusterId = features[0].properties?.cluster_id;
        const source = map.getSource("urbaneye-buses") as mapboxgl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId, (err, zoomLevel) => {
          if (err || zoomLevel == null) return;
          const geom = features[0].geometry as GeoJSON.Point;
          map.easeTo({ center: geom.coordinates as [number, number], zoom: zoomLevel + 1 });
        });
      });

      // Individual Event click
      map.on("click", "layer-events-points", (e) => {
        if (!e.features || !e.features[0]) return;
        const props = e.features[0].properties as any;
        setActiveEventPopup({
          event_id: props.event_id,
          event_type: props.event_type,
          category: props.category,
          severity: props.severity,
          confidence: Number(props.confidence || 0),
          bus_id: props.bus_id,
          video_id: props.video_id,
          job_id: props.job_id,
          frame_number: Number(props.frame_number || 0),
          timestamp: Number(props.timestamp || 0),
          description: props.description,
          evidence_url: props.evidence_url,
          created_at: props.created_at,
        });
        setActiveBusPopup(null);
        selectEvent(props.event_id);
      });

      // Individual Bus click
      map.on("click", "layer-buses-points", (e) => {
        if (!e.features || !e.features[0]) return;
        const props = e.features[0].properties as any;
        setActiveBusPopup({
          bus_id: props.bus_id,
          bus_number: props.bus_number,
          registration_number: props.registration_number,
          route_number: props.route_number,
          status: props.status,
          speed: Number(props.speed || 0),
          heading: Number(props.heading || 0),
          latitude: Number(props.latitude || 0),
          longitude: Number(props.longitude || 0),
          last_updated_at: props.last_updated_at,
        });
        setActiveEventPopup(null);
        selectBus(props.bus_id);
      });

      // Cursor pointer changes on hover
      const interactiveLayers = [
        "layer-events-clusters",
        "layer-events-points",
        "layer-buses-clusters",
        "layer-buses-points",
      ];
      interactiveLayers.forEach((l) => {
        map.on("mouseenter", l, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", l, () => {
          map.getCanvas().style.cursor = "";
        });
      });
    });

    // Viewport change listener (debounced bounds update)
    map.on("moveend", () => {
      const c = map.getCenter();
      const z = map.getZoom();
      const b = map.getBounds();
      setCenter([c.lng, c.lat]);
      setZoom(z);
      if (b) {
        setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      }
    });

    // Resize Observer to handle sidebar/window layout updates
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, [hasValidToken]);

  // ── 2. Data Updates into Mapbox Sources ─────────────────────────────────────

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    const busSource = map.getSource("urbaneye-buses") as mapboxgl.GeoJSONSource;
    if (busSource) busSource.setData(busesData);

    const eventSource = map.getSource("urbaneye-events") as mapboxgl.GeoJSONSource;
    if (eventSource) eventSource.setData(eventsData);

    const routeSource = map.getSource("urbaneye-routes") as mapboxgl.GeoJSONSource;
    if (routeSource) routeSource.setData(routesData);

    const segmentSource = map.getSource("urbaneye-road-segments") as mapboxgl.GeoJSONSource;
    if (segmentSource) segmentSource.setData(segmentsData);

    const heatmapSource = map.getSource("urbaneye-heatmap") as mapboxgl.GeoJSONSource;
    if (heatmapSource) heatmapSource.setData(heatmapData);
  }, [mapLoaded, busesData, eventsData, routesData, segmentsData, heatmapData]);

  // ── 3. Layer Visibility Updates ─────────────────────────────────────────────

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    const setVis = (layerId: string, visible: boolean) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
      }
    };

    setVis("layer-buses-clusters", visibleLayers.buses);
    setVis("layer-buses-cluster-count", visibleLayers.buses);
    setVis("layer-buses-points", visibleLayers.buses);

    setVis("layer-events-clusters", visibleLayers.events);
    setVis("layer-events-cluster-count", visibleLayers.events);
    setVis("layer-events-points", visibleLayers.events);

    setVis("layer-routes", visibleLayers.routes);
    setVis("layer-road-segments", visibleLayers.roadConditions);
    setVis("layer-heatmap", visibleLayers.congestion);
  }, [mapLoaded, visibleLayers]);

  // ── 4. Style Changes (streets vs satellite) ─────────────────────────────────

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const targetStyle = MAP_STYLES[mapStyle] || MAP_STYLES.streets;
    map.setStyle(targetStyle);
  }, [mapStyle]);

  // Fallback when token is missing
  if (!hasValidToken) {
    return (
      <div className={`relative flex h-full w-full flex-col items-center justify-center rounded-lg border border-border bg-card p-6 text-center ${className}`}>
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary mb-3">
          <KeyRound className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-foreground">Mapbox Token Configuration Required</h3>
        <p className="mt-1.5 max-w-md text-[12px] text-muted-foreground">
          To render high-resolution WebGL vector map tiles, provide your public Mapbox access token in <code className="rounded bg-secondary px-1 py-0.5 text-foreground font-mono">.env</code> as <code className="rounded bg-secondary px-1 py-0.5 text-foreground font-mono">VITE_MAPBOX_ACCESS_TOKEN</code>.
        </p>
        <div className="mt-4 flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-md">
          <Sparkles className="h-3.5 w-3.5" />
          Demo Mode is fully active: telemetry & event data are synchronized.
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full overflow-hidden rounded-lg ${className}`}>
      <div ref={containerRef} className="h-full w-full" />

      {/* Floating Bus Popup Card */}
      {activeBusPopup && (
        <div className="absolute right-3 top-3 z-30">
          <BusPopup
            bus={activeBusPopup}
            onClose={() => setActiveBusPopup(null)}
            onViewFleet={onViewFleet}
          />
        </div>
      )}

      {/* Floating Event Popup Card */}
      {activeEventPopup && (
        <div className="absolute right-3 top-3 z-30">
          <EventPopup
            event={activeEventPopup}
            onClose={() => setActiveEventPopup(null)}
            onInspectEvidence={onInspectEvidence}
          />
        </div>
      )}
    </div>
  );
}
