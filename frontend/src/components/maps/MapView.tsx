import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { cn } from "@/lib/utils";
import { MAPBOX_ACCESS_TOKEN } from "@/config/map";
import {
  DEMO_REGION,
  ANDHERI_ROADS,
  ANDHERI_ISSUES,
  ANDHERI_BUSES,
  CONDITION_CONFIG,
  SEVERITY_MARKER_COLOR,
  type AndheriRoad,
  type AndheriIssue,
} from "@/data/andheri";
import type { Bus, Issue } from "@/types";
import type { LayerState } from "@/state/app-store";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AndheriMapProps {
  showFleet?: boolean | undefined;
  selectedRoadId?: string | null | undefined;
  selectedIssueId?: string | null | undefined;
  onSelectRoad?: ((road: AndheriRoad) => void) | undefined;
  onSelectIssue?: ((issue: AndheriIssue) => void) | undefined;
  className?: string | undefined;
}

// Helper: safely read from Mapbox index-signature properties
function prop<T = unknown>(p: Record<string, unknown>, key: string, fallback: T): T {
  const v = p[key];
  return v !== undefined && v !== null ? (v as T) : fallback;
}

// ── AndheriIntelligenceMap ────────────────────────────────────────────────────

export function AndheriIntelligenceMap({
  showFleet = false,
  selectedRoadId,
  selectedIssueId,
  onSelectRoad,
  onSelectIssue,
  className,
}: AndheriMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const issueMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const busMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const hoveredRoadRef = useRef<string | null>(null);

  // ── Map Initialization ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!MAPBOX_ACCESS_TOKEN?.startsWith("pk.")) return;

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [DEMO_REGION.center.lng, DEMO_REGION.center.lat],
      zoom: DEMO_REGION.zoom,
      minZoom: 11,
      maxZoom: 18,
      attributionControl: false,
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      // ── 1. Road Condition Intelligence Layer ──────────────────────────────
      const roadConditionGeoJSON: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: ANDHERI_ROADS.map((road) => ({
          type: "Feature" as const,
          id: road.id,
          geometry: {
            type: "LineString" as const,
            coordinates: road.coordinates,
          },
          properties: {
            id: road.id,
            name: road.name,
            type: road.type,
            condition: road.condition,
            conditionScore: road.conditionScore,
            issueCount: road.issueCount,
            observationCount: road.observationCount,
            lastObserved: road.lastObserved,
            priority: road.priority ?? "",
            status: road.status,
            surveyedBuses: road.surveyedBuses,
            color: CONDITION_CONFIG[road.condition].color,
            lineWidth: CONDITION_CONFIG[road.condition].lineWidth,
          },
        })),
      };

      map.addSource("andheri-roads", {
        type: "geojson",
        data: roadConditionGeoJSON,
        generateId: false,
      });

      // Road glow / halo
      map.addLayer({
        id: "layer-road-glow",
        type: "line",
        source: "andheri-roads",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            12, ["*", ["get", "lineWidth"], 1.8],
            16, ["*", ["get", "lineWidth"], 2.5],
          ],
          "line-opacity": 0.18,
          "line-blur": 4,
        },
      });

      // Main intelligence line
      map.addLayer({
        id: "layer-road-condition",
        type: "line",
        source: "andheri-roads",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            12, ["get", "lineWidth"],
            16, ["*", ["get", "lineWidth"], 1.5],
          ],
          "line-opacity": 0.92,
        },
      });

      // Selected road highlight layer
      map.addLayer({
        id: "layer-road-selected",
        type: "line",
        source: "andheri-roads",
        layout: { "line-join": "round", "line-cap": "round" },
        filter: ["==", ["get", "id"], "____none____"],
        paint: {
          "line-color": ["get", "color"],
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            12, 10,
            16, 14,
          ],
          "line-opacity": 0.5,
          "line-blur": 3,
        },
      });

      // ── 2. Survey Observation Dots (zoom >= 14) ───────────────────────────
      const obsDots: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: ANDHERI_ROADS.flatMap((road) =>
          road.coordinates.map((coord) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: coord },
            properties: {
              condition: road.condition,
              color: CONDITION_CONFIG[road.condition].color,
            },
          }))
        ),
      };

      map.addSource("andheri-obs-dots", { type: "geojson", data: obsDots });
      map.addLayer({
        id: "layer-obs-dots",
        type: "circle",
        source: "andheri-obs-dots",
        minzoom: 14,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 2.5, 17, 4],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.8,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#0d1117",
        },
      });

      // ── 3. Hover + Click interactions ─────────────────────────────────────
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        className: "trinetra-road-popup",
      });

      map.on("mousemove", "layer-road-condition", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0];
        if (!feature) return;
        const p = feature.properties as Record<string, unknown>;
        // Use bracket notation for index-signature properties (TS4111)
        const roadId = String(p["id"] ?? "");
        if (roadId === hoveredRoadRef.current) return;
        hoveredRoadRef.current = roadId;

        const cond = String(p["condition"] ?? "");
        const condCfg = CONDITION_CONFIG[cond as keyof typeof CONDITION_CONFIG];
        const condColor = condCfg?.color ?? "#fff";
        const roadName = String(p["name"] ?? "Unknown Road");
        const condScore = Number(p["conditionScore"] ?? 0);
        const issueCount = Number(p["issueCount"] ?? 0);
        const obsCount = Number(p["observationCount"] ?? 0);
        const lastObs = String(p["lastObserved"] ?? "—");

        popup
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="
              font-family: 'Inter', system-ui, sans-serif;
              font-size: 12px;
              color: #f8fafc;
              padding: 4px 2px;
              min-width: 180px;
            ">
              <div style="font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:#94a3b8; margin-bottom:4px;">
                Road Segment
              </div>
              <div style="font-weight:700; font-size:13px; color:#f1f5f9; margin-bottom:6px; line-height:1.3;">
                ${roadName}
              </div>
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${condColor};"></span>
                <span style="color:${condColor}; font-weight:600; text-transform:uppercase; font-size:11px;">${cond}</span>
                <span style="color:#64748b; font-size:11px;">· Score ${condScore}</span>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-top:6px; font-size:11px; color:#94a3b8;">
                <div><span style="color:#e2e8f0;">${issueCount}</span> Issues</div>
                <div><span style="color:#e2e8f0;">${obsCount}</span> Obs.</div>
                <div style="grid-column:1/-1;">Last seen: <span style="color:#cbd5e1;">${lastObs}</span></div>
              </div>
            </div>
          `)
          .addTo(map);
      });

      map.on("mouseleave", "layer-road-condition", () => {
        map.getCanvas().style.cursor = "";
        hoveredRoadRef.current = null;
        popup.remove();
      });

      map.on("click", "layer-road-condition", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const p = feature.properties as Record<string, unknown>;
        const roadId = String(p["id"] ?? "");
        const road = ANDHERI_ROADS.find((r) => r.id === roadId);
        if (road && onSelectRoad) onSelectRoad(road);
      });
    });

    const ro = new ResizeObserver(() => map.resize());
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      issueMarkersRef.current.forEach((m) => m.remove());
      issueMarkersRef.current = [];
      busMarkersRef.current.forEach((m) => m.remove());
      busMarkersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Issue Markers ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const renderMarkers = () => {
      issueMarkersRef.current.forEach((m) => m.remove());
      issueMarkersRef.current = [];

      ANDHERI_ISSUES.forEach((issue) => {
        const isSelected = issue.id === selectedIssueId;
        const color = SEVERITY_MARKER_COLOR[issue.severity];
        const size = isSelected ? 24 : 16;
        const isP1 = issue.priority === "P1";

        const el = document.createElement("div");
        el.style.cssText = `
          width: ${size}px;
          height: ${size}px;
          border-radius: ${isP1 ? "3px" : "50%"};
          background: ${color};
          border: ${isSelected ? "3px solid #ffffff" : isP1 ? "2px solid rgba(255,255,255,0.5)" : "2px solid rgba(0,0,0,0.7)"};
          cursor: pointer;
          box-shadow: 0 0 ${isSelected ? "16px 4px" : isP1 ? "8px 2px" : "4px 1px"} ${color}90;
          transition: all 0.15s ease;
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 9px; font-weight: 700;
        `;
        if (isP1) el.textContent = "P1";
        el.title = `${issue.title} (${issue.priority})`;

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          if (onSelectIssue) onSelectIssue(issue);
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([issue.position.lng, issue.position.lat])
          .addTo(map);
        issueMarkersRef.current.push(marker);
      });
    };

    if (map.isStyleLoaded()) renderMarkers();
    else map.once("load", renderMarkers);
  }, [selectedIssueId, onSelectIssue]);

  // ── Fleet Bus Markers ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const renderBuses = () => {
      if (!showFleet) {
        busMarkersRef.current.forEach((m) => m.remove());
        busMarkersRef.current.clear();
        return;
      }

      const activeIds = new Set(ANDHERI_BUSES.map((b) => b.id));
      busMarkersRef.current.forEach((m, id) => {
        if (!activeIds.has(id)) { m.remove(); busMarkersRef.current.delete(id); }
      });

      ANDHERI_BUSES.forEach((bus) => {
        const isOnline = bus.status === "active";
        const bgColor = isOnline ? "#3b82f6" : "#475569";

        if (!busMarkersRef.current.has(bus.id)) {
          const el = document.createElement("div");
          el.style.cssText = `
            width: 14px; height: 14px;
            border-radius: 3px;
            background: ${bgColor};
            border: 1.5px solid rgba(255,255,255,0.6);
            cursor: pointer;
            box-shadow: 0 0 6px ${bgColor}80;
          `;
          el.title = `${bus.id} · ${bus.routeName} · ${bus.speedKph} km/h`;

          const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([bus.position.lng, bus.position.lat])
            .addTo(map);
          busMarkersRef.current.set(bus.id, marker);
        }
      });
    };

    if (map.isStyleLoaded()) renderBuses();
    else map.once("load", renderBuses);
  }, [showFleet]);

  // ── Selected Road filter update ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const filterId = selectedRoadId ?? "____none____";
    if (map.getLayer("layer-road-selected")) {
      map.setFilter("layer-road-selected", ["==", ["get", "id"], filterId]);
    }
  }, [selectedRoadId]);

  if (!MAPBOX_ACCESS_TOKEN?.startsWith("pk.")) {
    return (
      <div className={cn("flex items-center justify-center bg-[#0d1117] text-slate-400 text-sm rounded-lg", className)}>
        <p>Set <code className="text-slate-200">VITE_MAPBOX_ACCESS_TOKEN</code> in <code className="text-slate-200">.env</code></p>
      </div>
    );
  }

  return (
    <div className={cn("relative isolate overflow-hidden", className)}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

// ── MapView (backward-compat shim) ────────────────────────────────────────────
// Kept so other pages that import MapView still compile without changes.

export interface MapViewProps {
  issues?: Issue[] | undefined;
  buses?: Bus[] | undefined;
  layers?: LayerState | undefined;
  selectedIssueId?: string | null | undefined;
  onSelectIssue?: ((id: string) => void) | undefined;
  selectedBusId?: string | null | undefined;
  onSelectBus?: ((id: string) => void) | undefined;
  showRoutes?: boolean | undefined;
  className?: string | undefined;
  overlay?: React.ReactNode | undefined;
}

export function MapView({ className }: MapViewProps) {
  return <AndheriIntelligenceMap className={className} />;
}

// ── MapLegend ─────────────────────────────────────────────────────────────────

export function MapLegend({ className }: { className?: string | undefined }) {
  return (
    <div className={cn("rounded-xl border border-white/10 bg-[#0d1117]/95 backdrop-blur px-4 py-3 shadow-2xl", className)}>
      <p className="mb-2 text-[9px] uppercase font-bold tracking-widest text-slate-500">
        Road Condition
      </p>
      <ul className="flex flex-col gap-1.5 mb-3">
        {(Object.entries(CONDITION_CONFIG) as [string, { color: string; label: string }][]).map(([, cfg]) => (
          <li key={cfg.label} className="flex items-center gap-2 text-[11px] font-medium text-slate-300">
            <span className="h-2.5 w-5 rounded-full shrink-0" style={{ background: cfg.color }} />
            {cfg.label}
          </li>
        ))}
      </ul>
      <p className="mb-2 text-[9px] uppercase font-bold tracking-widest text-slate-500 border-t border-white/10 pt-2.5">
        Issues
      </p>
      <ul className="flex flex-col gap-1.5">
        <li className="flex items-center gap-2 text-[11px] font-medium text-slate-300">
          <span className="h-3 w-3 rounded-sm bg-red-500 shrink-0 flex items-center justify-center text-[7px] font-bold text-white">P1</span>
          Priority Issue
        </li>
        <li className="flex items-center gap-2 text-[11px] font-medium text-slate-300">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shrink-0" />
          Major Issue
        </li>
        <li className="flex items-center gap-2 text-[11px] font-medium text-slate-300">
          <span className="h-2.5 w-2.5 rounded-full bg-[#3b82f6] shrink-0" />
          Fleet Bus
        </li>
      </ul>
    </div>
  );
}
