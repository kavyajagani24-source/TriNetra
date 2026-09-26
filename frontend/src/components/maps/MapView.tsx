import { useEffect, useRef } from "react";
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

export interface AndheriMapProps {
  showFleet?: boolean | undefined;
  selectedRoadId?: string | null | undefined;
  selectedIssueId?: string | null | undefined;
  onSelectRoad?: ((road: AndheriRoad) => void) | undefined;
  onSelectIssue?: ((issue: AndheriIssue) => void) | undefined;
  className?: string | undefined;
}

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

  // Keep latest callbacks in refs to avoid re-triggering map useEffect
  const onSelectRoadRef = useRef(onSelectRoad);
  onSelectRoadRef.current = onSelectRoad;

  const onSelectIssueRef = useRef(onSelectIssue);
  onSelectIssueRef.current = onSelectIssue;

  // Initialize Mapbox map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!MAPBOX_ACCESS_TOKEN?.startsWith("pk.")) return;

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [DEMO_REGION.center.lng, DEMO_REGION.center.lat],
      zoom: DEMO_REGION.zoom,
      minZoom: 11.5,
      maxZoom: 18.5,
      attributionControl: false,
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      // -------------------------------------------------------------
      // LAYER A: BASE ROAD NETWORK (Real OSM Street Grid)
      // -------------------------------------------------------------
      map.addSource("andheri-base-roads", {
        type: "geojson",
        data: "/andheri-base-roads.geojson",
      });

      map.addLayer({
        id: "layer-base-roads",
        type: "line",
        source: "andheri-base-roads",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#334155",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            11, 0.8,
            13, 1.4,
            15, 2.2,
            17, 3.5,
          ],
          "line-opacity": 0.65,
        },
      });

      // -------------------------------------------------------------
      // LAYER B: ROAD CONDITION INTELLIGENCE OVERLAY
      // -------------------------------------------------------------
      map.addSource("andheri-intelligence-roads", {
        type: "geojson",
        data: "/andheri-intelligence-roads.geojson",
      });

      // Subtle underglow / depth casing
      map.addLayer({
        id: "layer-road-casing",
        type: "line",
        source: "andheri-intelligence-roads",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            11, 2.2,
            13, 3.8,
            15, 5.5,
            17, 8.0,
          ],
          "line-opacity": 0.25,
          "line-blur": 2,
        },
      });

      // Main intelligence line
      map.addLayer({
        id: "layer-road-condition",
        type: "line",
        source: "andheri-intelligence-roads",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            11, 1.6,
            13, 2.8,
            15, 4.2,
            17, 6.0,
          ],
          "line-opacity": 0.95,
        },
      });

      // Selected Road Highlight Layer
      map.addLayer({
        id: "layer-road-selected",
        type: "line",
        source: "andheri-intelligence-roads",
        layout: { "line-join": "round", "line-cap": "round" },
        filter: ["==", ["get", "id"], "____none____"],
        paint: {
          "line-color": "#ffffff",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            11, 4.0,
            13, 6.0,
            15, 8.5,
            17, 11.0,
          ],
          "line-opacity": 0.9,
        },
      });

      // -------------------------------------------------------------
      // LAYER C: SURVEY OBSERVATION POINTS (Zoom >= 13.5)
      // Centerline observation dots (RoadMetrics style)
      // -------------------------------------------------------------
      map.addSource("andheri-observations", {
        type: "geojson",
        data: "/andheri-observations.geojson",
      });

      map.addLayer({
        id: "layer-obs-dots",
        type: "circle",
        source: "andheri-observations",
        minzoom: 13.5,
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            13.5, 1.8,
            15, 2.6,
            17, 4.2,
          ],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.9,
          "circle-stroke-width": 1.0,
          "circle-stroke-color": "#0a0e17",
        },
      });

      // -------------------------------------------------------------
      // HOVER & CLICK TOOLTIPS (Clean GIS Card Style)
      // -------------------------------------------------------------
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 14,
        className: "trinetra-road-popup",
      });

      map.on("mousemove", "layer-road-condition", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0];
        if (!feature) return;
        const p = feature.properties as Record<string, unknown>;
        const roadId = String(p["id"] ?? "");
        if (roadId === hoveredRoadRef.current) return;
        hoveredRoadRef.current = roadId;

        const cond = String(p["condition"] ?? "HEALTHY");
        const condCfg = CONDITION_CONFIG[cond as keyof typeof CONDITION_CONFIG];
        const condColor = condCfg?.color ?? "#16A34A";
        const roadName = String(p["name"] ?? "Surveyed Street");
        const condScore = Number(p["conditionScore"] ?? 80);
        const issueCount = Number(p["issueCount"] ?? 0);
        const obsCount = Number(p["observationCount"] ?? 0);

        popup
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 12px;
              color: #1F2933;
              padding: 2px 1px;
              min-width: 185px;
            ">
              <div style="font-weight:600; font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:#66736D; margin-bottom:2px;">
                Surveyed Road Corridor
              </div>
              <div style="font-weight:700; font-size:13px; color:#1F2933; margin-bottom:5px; line-height:1.2;">
                ${roadName}
              </div>
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:${condColor};"></span>
                <span style="color:${condColor}; font-weight:700; text-transform:uppercase; font-size:11px;">${cond}</span>
                <span style="color:#66736D; font-size:11px;">(Score ${condScore}/100)</span>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; font-size:11px; color:#66736D; border-top: 1px solid #D9E2DC; padding-top:5px;">
                <div><span style="color:#1F2933; font-weight:600;">${issueCount}</span> Defects</div>
                <div><span style="color:#1F2933; font-weight:600;">${obsCount}</span> Points</div>
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
        if (road && onSelectRoadRef.current) onSelectRoadRef.current(road);
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
  }, []);

  // Render Road-Aligned Issue Markers (Layer D)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const renderMarkers = () => {
      issueMarkersRef.current.forEach((m) => m.remove());
      issueMarkersRef.current = [];

      ANDHERI_ISSUES.forEach((issue) => {
        const isSelected = issue.id === selectedIssueId;
        const color = SEVERITY_MARKER_COLOR[issue.severity];
        const isP1 = issue.priority === "P1";
        const size = isSelected ? 26 : isP1 ? 22 : 18;

        const el = document.createElement("div");
        el.style.cssText = `
          width: ${size}px;
          height: ${size}px;
          border-radius: ${isP1 ? "4px" : "50%"};
          background: ${color};
          border: ${isSelected ? "3px solid #ffffff" : isP1 ? "2px solid rgba(255,255,255,0.9)" : "2px solid rgba(15,23,42,0.9)"};
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.35);
          transition: transform 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: ${isP1 ? "9px" : "8px"};
          font-weight: 800;
          user-select: none;
        `;
        if (isP1) {
          el.textContent = "P1";
        } else if (issue.severity === "major") {
          el.innerHTML = "&#9888;";
        }

        el.title = `${issue.title} on ${issue.roadName}`;

        el.addEventListener("mouseenter", () => {
          el.style.transform = "scale(1.25)";
        });
        el.addEventListener("mouseleave", () => {
          el.style.transform = "scale(1.0)";
        });

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          if (onSelectIssueRef.current) onSelectIssueRef.current(issue);
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([issue.position.lng, issue.position.lat])
          .addTo(map);
        issueMarkersRef.current.push(marker);
      });
    };

    if (map.isStyleLoaded()) renderMarkers();
    else map.once("load", renderMarkers);
  }, [selectedIssueId]);

  // Render Fleet Bus Markers (Layer E)
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
        if (!activeIds.has(id)) {
          m.remove();
          busMarkersRef.current.delete(id);
        }
      });

      ANDHERI_BUSES.forEach((bus) => {
        const isOnline = bus.status === "active";
        const bgColor = isOnline ? "#2563EB" : "#64748B";

        if (!busMarkersRef.current.has(bus.id)) {
          const el = document.createElement("div");
          el.style.cssText = `
            width: 18px;
            height: 18px;
            border-radius: 4px;
            background: ${bgColor};
            border: 2px solid rgba(255,255,255,0.9);
            cursor: pointer;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
          `;
          el.innerHTML = "&#128652;";
          el.title = `${bus.id} - ${bus.routeName} (${bus.speedKph} km/h)`;

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

  // Update Selected Road Highlight
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
      <div className={cn("flex items-center justify-center bg-white text-[#66736D] text-sm rounded-lg border border-[#D9E2DC]", className)}>
        <p>Set <code className="text-[#1F2933]">VITE_MAPBOX_ACCESS_TOKEN</code> in <code className="text-[#1F2933]">.env</code></p>
      </div>
    );
  }

  return (
    <div className={cn("relative isolate overflow-hidden", className)}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

// Backward-compatible shim
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

// MapLegend component: Clean White GIS card
export function MapLegend({ className }: { className?: string | undefined }) {
  return (
    <div className={cn("rounded-lg border border-[#D9E2DC] bg-white/98 backdrop-blur-xs px-3.5 py-3 shadow-md text-[#1F2933] select-none", className)}>
      <p className="mb-2 text-[9px] uppercase font-bold tracking-wider text-[#66736D]">
        Road Condition Scale
      </p>
      <ul className="flex flex-col gap-1.5 mb-2.5">
        {(Object.entries(CONDITION_CONFIG) as [string, { color: string; label: string; level: string }][]).map(([, cfg]) => (
          <li key={cfg.label} className="flex items-center gap-2 text-[11px] font-medium text-[#1F2933]">
            <span className="h-2 w-4 rounded-full shrink-0" style={{ background: cfg.color }} />
            <span>{cfg.label}</span>
            <span className="text-[10px] text-[#66736D] ml-auto font-mono">{cfg.level}</span>
          </li>
        ))}
      </ul>
      <p className="mb-2 text-[9px] uppercase font-bold tracking-wider text-[#66736D] border-t border-[#D9E2DC] pt-2">
        Inspection Indicators
      </p>
      <ul className="flex flex-col gap-1.5">
        <li className="flex items-center gap-2 text-[11px] font-medium text-[#1F2933]">
          <span className="h-3 w-3 rounded-xs bg-[#DC2626] shrink-0 flex items-center justify-center text-[7px] font-bold text-white">P1</span>
          Priority Defect
        </li>
        <li className="flex items-center gap-2 text-[11px] font-medium text-[#1F2933]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#D97706] shrink-0" />
          Major Defect
        </li>
        <li className="flex items-center gap-2 text-[11px] font-medium text-[#1F2933]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] shrink-0" />
          Survey Centerline Point
        </li>
        <li className="flex items-center gap-2 text-[11px] font-medium text-[#1F2933]">
          <span className="h-2.5 w-2.5 rounded-xs bg-[#2563EB] shrink-0 flex items-center justify-center text-[8px] text-white">&#128652;</span>
          Fleet Survey Vehicle
        </li>
      </ul>
    </div>
  );
}
