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
  type RoadCondition,
} from "@/data/andheri";
import type { Bus, Issue } from "@/types";
import type { LayerState } from "@/state/app-store";

export interface AndheriMapProps {
  issues?: any[] | undefined;
  buses?: any[] | undefined;
  showRoadCondition?: boolean | undefined;
  showIssues?: boolean | undefined;
  showFleet?: boolean | undefined;
  showObservations?: boolean | undefined;
  conditionFilter?: "ALL" | "CRITICAL" | "POOR_CRITICAL" | "WATCH_POOR" | undefined;
  selectedRoadId?: string | null | undefined;
  selectedIssueId?: string | null | undefined;
  onSelectRoad?: ((road: AndheriRoad) => void) | undefined;
  onSelectIssue?: ((issueOrId: any) => void) | undefined;
  demoMode?: boolean | undefined;
  className?: string | undefined;
}

export function AndheriIntelligenceMap({
  issues,
  buses,
  showRoadCondition = true,
  showIssues = true,
  showFleet = false,
  showObservations = false,
  conditionFilter = "ALL",
  selectedRoadId,
  selectedIssueId,
  onSelectRoad,
  onSelectIssue,
  demoMode = false,
  className,
}: AndheriMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const issueMarkersRef = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement }>>(new Map());
  const busMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const hoveredRoadRef = useRef<string | null>(null);

  // Keep latest callbacks in refs to avoid re-triggering map useEffect
  const onSelectRoadRef = useRef(onSelectRoad);
  onSelectRoadRef.current = onSelectRoad;
  const onSelectIssueRef = useRef(onSelectIssue);
  onSelectIssueRef.current = onSelectIssue;
  const selectedIssueIdRef = useRef(selectedIssueId);
  selectedIssueIdRef.current = selectedIssueId;

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

    // Standardized GIS controls (styled cleanly via CSS)
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(
      new mapboxgl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true,
      }),
      "bottom-right",
    );

    map.on("load", () => {
      // -------------------------------------------------------------
      // LAYER A: MUTED BASE OSM ROADS
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
          "line-color": "#283548",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            11, 0.8,
            13, 1.3,
            15, 2.0,
            17, 3.2,
          ],
          "line-opacity": 0.6,
        },
      });

      // -------------------------------------------------------------
      // LAYER B: ROAD CONDITION INTELLIGENCE OVERLAY
      // -------------------------------------------------------------
      map.addSource("andheri-intelligence-roads", {
        type: "geojson",
        data: "/andheri-intelligence-roads.geojson",
      });

      // Subtle underglow casing
      map.addLayer({
        id: "layer-road-casing",
        type: "line",
        source: "andheri-intelligence-roads",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            11, 2.0,
            13, 3.5,
            15, 5.0,
            17, 7.5,
          ],
          "line-opacity": 0.22,
          "line-blur": 1.5,
        },
      });

      // Main condition line
      map.addLayer({
        id: "layer-road-condition",
        type: "line",
        source: "andheri-intelligence-roads",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            11, 1.5,
            13, 2.6,
            15, 4.0,
            17, 5.5,
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
            11, 3.8,
            13, 5.5,
            15, 8.0,
            17, 10.5,
          ],
          "line-opacity": 0.9,
        },
      });

      // -------------------------------------------------------------
      // LAYER C: SURVEY OBSERVATION POINTS (Centerline dots)
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
        layout: {
          visibility: showObservations ? "visible" : "none",
        },
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            13.5, 1.5,
            15, 2.4,
            17, 3.8,
          ],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.85,
          "circle-stroke-width": 0.8,
          "circle-stroke-color": "#0a0e17",
        },
      });

      // -------------------------------------------------------------
      // HOVER & CLICK TOOLTIPS (Tiny Professional GIS Tooltip)
      // Section 16: Road Name, Condition, Condition score, issues, observations
      // -------------------------------------------------------------
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
        const roadId = String(p["id"] ?? "");
        if (roadId === hoveredRoadRef.current) return;
        hoveredRoadRef.current = roadId;

        const cond = String(p["condition"] ?? "HEALTHY") as RoadCondition;
        const condCfg = CONDITION_CONFIG[cond];
        const condColor = condCfg?.color ?? "#10b981";
        const condLabel = condCfg?.label ?? "Healthy";
        const roadName = String(p["name"] ?? "Surveyed Road");
        const condScore = Number(p["conditionScore"] ?? 80);
        const issueCount = Number(p["issueCount"] ?? 0);
        const obsCount = Number(p["observationCount"] ?? 0);

        popup
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family: Manrope, -apple-system, sans-serif; font-size: 11px; color: #1F2933; min-width: 135px; line-height: 1.35; padding: 1px;">
              <div style="font-weight: 700; font-size: 12px; color: #1F2933; margin-bottom: 2px;">
                ${roadName}
              </div>
              <div style="font-size: 11px; margin-bottom: 3px;">
                <span style="color: ${condColor}; font-family: 'DM Sans', sans-serif; font-weight: 700;">${condLabel.toUpperCase()}</span>
                <span style="color: #66736D;"> · ${condScore}</span>
              </div>
              <div style="font-size: 10px; color: #66736D; border-top: 1px solid #D9E2DC; padding-top: 3px; font-family: 'DM Sans', sans-serif;">
                ${issueCount} ${issueCount === 1 ? "issue" : "issues"} · ${obsCount} observations
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
      issueMarkersRef.current.forEach(({ marker }) => marker.remove());
      issueMarkersRef.current.clear();
      busMarkersRef.current.forEach((m) => m.remove());
      busMarkersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Road Condition Visibility & Filters
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const visibility = showRoadCondition ? "visible" : "none";
    if (map.getLayer("layer-road-casing")) {
      map.setLayoutProperty("layer-road-casing", "visibility", visibility);
    }
    if (map.getLayer("layer-road-condition")) {
      map.setLayoutProperty("layer-road-condition", "visibility", visibility);

      if (conditionFilter === "CRITICAL") {
        map.setFilter("layer-road-condition", ["==", ["get", "condition"], "CRITICAL"]);
        map.setFilter("layer-road-casing", ["==", ["get", "condition"], "CRITICAL"]);
      } else if (conditionFilter === "POOR_CRITICAL") {
        map.setFilter("layer-road-condition", ["in", ["get", "condition"], ["literal", ["CRITICAL", "POOR"]]]);
        map.setFilter("layer-road-casing", ["in", ["get", "condition"], ["literal", ["CRITICAL", "POOR"]]]);
      } else if (conditionFilter === "WATCH_POOR") {
        map.setFilter("layer-road-condition", ["in", ["get", "condition"], ["literal", ["WATCH", "POOR"]]]);
        map.setFilter("layer-road-casing", ["in", ["get", "condition"], ["literal", ["WATCH", "POOR"]]]);
      } else {
        map.setFilter("layer-road-condition", null);
        map.setFilter("layer-road-casing", null);
      }
    }
  }, [showRoadCondition, conditionFilter]);

  // Update Observation Points Visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer("layer-obs-dots")) {
      map.setLayoutProperty(
        "layer-obs-dots",
        "visibility",
        showObservations ? "visible" : "none",
      );
    }
  }, [showObservations]);

  // Render Clean Road-Aligned Issue Markers (Layer D)
  // Maintains persistent marker pool so markers never flicker or disappear on click
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const syncMarkers = () => {
      if (!showIssues) {
        issueMarkersRef.current.forEach(({ marker }) => marker.remove());
        issueMarkersRef.current.clear();
        return;
      }

      const items = demoMode ? (issues && issues.length > 0 ? issues : ANDHERI_ISSUES) : (issues || []);
      const currentIds = new Set<string>();

      items.forEach((issue: any) => {
        const lat = issue.position?.lat;
        const lng = issue.position?.lng;
        // Zero-fabrication: skip invalid or missing GPS coordinates
        if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
          return;
        }

        const id = String(issue.id);
        currentIds.add(id);

        if (issueMarkersRef.current.has(id)) {
          const { marker } = issueMarkersRef.current.get(id)!;
          marker.setLngLat([lng, lat]);
          return;
        }

        const sev = (issue.severity?.toLowerCase() || "moderate") as keyof typeof SEVERITY_MARKER_COLOR;
        const color = SEVERITY_MARKER_COLOR[sev] || "#eab308";
        const isCritical = sev === "critical";
        const isMajor = sev === "major";
        const size = isCritical ? 20 : isMajor ? 17 : 15;

        const el = document.createElement("div");
        el.className = "trinetra-issue-marker";
        el.dataset.issueId = id;
        el.style.cssText = `
          width: ${size}px;
          height: ${size}px;
          cursor: pointer;
          transition: transform 0.15s ease, filter 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          transform-origin: center center;
        `;

        el.innerHTML = `
          <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" stroke="#FFFFFF" stroke-width="1.4" stroke-linejoin="round" style="display:block; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.35));">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
            <circle cx="12" cy="17" r="1.2" fill="#FFFFFF"/>
          </svg>
        `;

        el.title = `${issue.title || issue.name || "Observation"} • ${issue.roadName || issue.road || "Corridor"}`;

        el.addEventListener("mouseenter", () => {
          if (id !== selectedIssueIdRef.current) el.style.transform = "scale(1.22)";
        });
        el.addEventListener("mouseleave", () => {
          if (id !== selectedIssueIdRef.current) el.style.transform = "scale(1.0)";
        });
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          if (onSelectIssueRef.current) onSelectIssueRef.current(issue.id || issue);
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([lng, lat])
          .addTo(map);

        issueMarkersRef.current.set(id, { marker, el });
      });

      // Remove stale markers
      issueMarkersRef.current.forEach(({ marker }, id) => {
        if (!currentIds.has(id)) {
          marker.remove();
          issueMarkersRef.current.delete(id);
        }
      });
    };

    if (map.isStyleLoaded()) syncMarkers();
    else map.once("load", syncMarkers);
  }, [showIssues, issues, demoMode]);

  // Separate Selection Styling — NEVER destroys/re-adds markers on click
  useEffect(() => {
    issueMarkersRef.current.forEach(({ el }, id) => {
      const isSelected = id === selectedIssueId;
      if (isSelected) {
        el.style.transform = "scale(1.35)";
        el.style.filter = "drop-shadow(0 0 6px #FFFFFF) drop-shadow(0 0 10px rgba(47,125,87,0.8))";
        el.style.zIndex = "100";
      } else {
        el.style.transform = "scale(1.0)";
        el.style.filter = "";
        el.style.zIndex = "1";
      }
    });
  }, [selectedIssueId]);

  // Render Subtle Fleet Bus Markers (Layer E)
  // SECTION 22: Subtle vehicle markers, secondary to road intelligence.
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

        if (busMarkersRef.current.has(bus.id)) {
          busMarkersRef.current.get(bus.id)!.setLngLat([bus.position.lng, bus.position.lat]);
        } else {
          const el = document.createElement("div");
          el.style.cssText = `
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: ${bgColor};
            border: 1.5px solid #FFFFFF;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          `;
          el.title = `${bus.id} • ${bus.routeName} (${bus.speedKph} km/h)`;

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
  demoMode?: boolean | undefined;
  className?: string | undefined;
  overlay?: React.ReactNode | undefined;
}

export function MapView({
  issues,
  buses,
  layers,
  selectedIssueId,
  onSelectIssue,
  selectedBusId,
  onSelectBus,
  showRoutes,
  demoMode = false,
  className,
}: MapViewProps) {
  return (
    <AndheriIntelligenceMap
      issues={issues}
      buses={buses}
      showIssues={layers ? layers.defects : true}
      showFleet={layers ? layers.buses : false}
      showRoadCondition={layers ? layers.roadCondition : true}
      selectedIssueId={selectedIssueId}
      onSelectIssue={onSelectIssue}
      demoMode={demoMode}
      className={className}
    />
  );
}

// MapLegend component: ONE Authoritative Compact Legend (Section 11)
export function MapLegend({ className }: { className?: string | undefined }) {
  return (
    <div className={cn("rounded-md border border-[#D9E2DC] bg-white/95 backdrop-blur-xs p-2.5 shadow-sm text-[#1F2933] select-none text-xs", className)}>
      {/* ROAD CONDITION */}
      <p className="mb-1 font-ui text-[9px] uppercase font-bold tracking-wider text-[#66736D]">
        Road Condition
      </p>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2">
        <li className="flex items-center gap-1.5 font-ui text-[11px] font-medium text-[#1F2933]">
          <span className="h-2 w-2 rounded-full shrink-0 bg-[#10b981]" />
          <span>Healthy</span>
        </li>
        <li className="flex items-center gap-1.5 font-ui text-[11px] font-medium text-[#1F2933]">
          <span className="h-2 w-2 rounded-full shrink-0 bg-[#eab308]" />
          <span>Watch</span>
        </li>
        <li className="flex items-center gap-1.5 font-ui text-[11px] font-medium text-[#1F2933]">
          <span className="h-2 w-2 rounded-full shrink-0 bg-[#f97316]" />
          <span>Poor</span>
        </li>
        <li className="flex items-center gap-1.5 font-ui text-[11px] font-medium text-[#1F2933]">
          <span className="h-2 w-2 rounded-full shrink-0 bg-[#ef4444]" />
          <span>Critical</span>
        </li>
      </ul>

      {/* ISSUES */}
      <p className="mb-1 font-ui text-[9px] uppercase font-bold tracking-wider text-[#66736D] border-t border-[#D9E2DC] pt-1.5">
        Issues
      </p>
      <ul className="flex items-center gap-3 mb-2">
        <li className="flex items-center gap-1 font-ui text-[11px] font-medium text-[#1F2933]">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="#ef4444" stroke="#FFFFFF" stroke-width="1.2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          </svg>
          <span>Critical</span>
        </li>
        <li className="flex items-center gap-1 font-ui text-[11px] font-medium text-[#1F2933]">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="#f97316" stroke="#FFFFFF" stroke-width="1.2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          </svg>
          <span>Major</span>
        </li>
        <li className="flex items-center gap-1 font-ui text-[11px] font-medium text-[#1F2933]">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="#eab308" stroke="#FFFFFF" stroke-width="1.2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          </svg>
          <span>Moderate</span>
        </li>
      </ul>

      {/* FLEET */}
      <p className="mb-1 font-ui text-[9px] uppercase font-bold tracking-wider text-[#66736D] border-t border-[#D9E2DC] pt-1.5">
        Fleet
      </p>
      <div className="flex items-center gap-1.5 font-ui text-[11px] font-medium text-[#1F2933]">
        <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB] border border-white shrink-0" />
        <span>Fleet Vehicle</span>
      </div>
    </div>
  );
}
