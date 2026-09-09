/**
 * UrbanEye AI — Mapbox GL JS Map View (replaces SVG canvas)
 *
 * Drop-in replacement for the old SVG-based MapView.
 * Renders real Mapbox dark vector tiles with overlaid
 * bus markers, issue markers, road segments, and bus routes.
 */

import { useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { cn } from "@/lib/utils";
import { MAPBOX_ACCESS_TOKEN } from "@/config/map";
import { CONDITION_COLORS, BUS_ROUTES, ROAD_SEGMENTS, CITY_CENTER, ARTERIALS } from "@/data/geo";
import type { Bus, Issue } from "@/types";
import type { LayerState } from "@/state/app-store";

// Mumbai city center
const MUMBAI_LNG = CITY_CENTER.lng;
const MUMBAI_LAT = CITY_CENTER.lat;

export interface MapViewProps {
  issues: Issue[];
  buses?: Bus[];
  layers: LayerState;
  selectedIssueId?: string | null;
  onSelectIssue?: (id: string) => void;
  selectedBusId?: string | null;
  onSelectBus?: (id: string) => void;
  showRoutes?: boolean;
  className?: string;
  overlay?: React.ReactNode;
}

export function MapView({
  issues,
  buses = [],
  layers,
  selectedIssueId,
  onSelectIssue,
  selectedBusId,
  onSelectBus,
  showRoutes = false,
  className,
  overlay,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const busMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  // ── Map Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!MAPBOX_ACCESS_TOKEN || !MAPBOX_ACCESS_TOKEN.startsWith("pk.")) return;

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [MUMBAI_LNG, MUMBAI_LAT],
      zoom: 11.5,
      attributionControl: true,
    });

    mapRef.current = map;

    map.on("load", () => {
      // ── Road Condition Segments source ─────────────────────────────────────
      const segmentGeoJSON: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: ROAD_SEGMENTS.map((seg) => ({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: seg.path.map((p) => [p.lng, p.lat]),
          },
          properties: {
            id: seg.id,
            condition: seg.condition,
            road: seg.road,
          },
        })),
      };

      map.addSource("road-segments", { type: "geojson", data: segmentGeoJSON });
      map.addLayer({
        id: "layer-road-segments",
        type: "line",
        source: "road-segments",
        layout: {
          "line-join": "round",
          "line-cap": "round",
          visibility: layers.roadCondition ? "visible" : "none",
        },
        paint: {
          "line-color": [
            "step",
            ["get", "condition"],
            CONDITION_COLORS[0],   // 0 → green
            1, CONDITION_COLORS[1], // 1 → yellow
            2, CONDITION_COLORS[2], // 2 → orange
            3, CONDITION_COLORS[3], // 3 → red
          ],
          "line-width": 4,
          "line-opacity": 0.9,
        },
      });

      // ── Bus Routes source ──────────────────────────────────────────────────
      const isRoutesVisible = Boolean(layers.routes ?? showRoutes);
      const routeGeoJSON: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: BUS_ROUTES.map((r) => ({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: r.path.map((p) => [p.lng, p.lat]),
          },
          properties: { id: r.id, name: r.name, delayMin: r.delayMin, coverage: r.coverage },
        })),
      };

      map.addSource("bus-routes", { type: "geojson", data: routeGeoJSON });
      map.addLayer({
        id: "layer-bus-routes",
        type: "line",
        source: "bus-routes",
        layout: {
          "line-join": "round",
          "line-cap": "round",
          visibility: isRoutesVisible ? "visible" : "none",
        },
        paint: {
          "line-color": ["match", ["get", "id"],
            "B1", "#38bdf8",
            "B2", "#34d399",
            "B3", "#a78bfa",
            "#fbbf24",
          ],
          "line-width": 3.5,
          "line-dasharray": [3, 2],
          "line-opacity": 0.9,
        },
      });

      map.on("click", "layer-bus-routes", (e) => {
        if (!e.features || !e.features[0]) return;
        const props = e.features[0].properties as any;
        new mapboxgl.Popup({ closeButton: true, closeOnClick: true, offset: 10 })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="color:#0f172a; font-family:system-ui,sans-serif; font-size:12px; line-height:1.4; padding:2px 4px;">
              <div style="font-weight:700; color:#0284c7; display:flex; align-items:center; gap:4px;">
                <span>🚌</span><span>${props?.name || `Route ${props?.id}`}</span>
              </div>
              <div style="margin-top:4px; font-size:11px; color:#475569;">
                <div>Delay: <strong>+${props?.delayMin ?? 0} mins</strong></div>
                <div>Sensor Coverage: <strong>${props?.coverage ?? 90}%</strong></div>
              </div>
            </div>`
          )
          .addTo(map);
      });

      map.on("mouseenter", "layer-bus-routes", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "layer-bus-routes", () => {
        map.getCanvas().style.cursor = "";
      });

      // ── Arterials (for visual richness) ───────────────────────────────────
      const arterialGeoJSON: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: ARTERIALS.map((a) => ({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: a.path.map((p) => [p.lng, p.lat]),
          },
          properties: { road: a.road },
        })),
      };

      map.addSource("arterials", { type: "geojson", data: arterialGeoJSON });
      map.addLayer({
        id: "layer-arterials",
        type: "line",
        source: "arterials",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#2a3a4a",
          "line-width": 3,
          "line-opacity": 0.6,
        },
      });

      // ── Heatmap (issues density) ───────────────────────────────────────────
      const issuePoints: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: issues.map((iss) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [iss.position.lng, iss.position.lat] },
          properties: { id: iss.id, category: iss.category },
        })),
      };

      map.addSource("issue-heatmap", { type: "geojson", data: issuePoints });
      map.addLayer({
        id: "layer-heatmap",
        type: "heatmap",
        source: "issue-heatmap",
        layout: { visibility: layers.heatmap ? "visible" : "none" },
        paint: {
          "heatmap-weight": 0.8,
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 14, 3],
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(33,102,172,0)",
            0.2, "rgb(103,169,207)",
            0.4, "rgb(209,229,240)",
            0.6, "rgb(253,219,199)",
            0.8, "rgb(239,138,98)",
            1, "rgb(178,24,43)",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 4, 14, 25],
          "heatmap-opacity": 0.75,
        },
      });
    });

    const ro = new ResizeObserver(() => map.resize());
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      busMarkersRef.current.forEach((m) => m.remove());
      busMarkersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Issue Markers ───────────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const waitForLoad = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const CATEGORY_COLOR: Record<string, string> = {
        pothole: "#e08b3c",
        crack: "#c9c53f",
        missing_divider: "#e08b3c",
        zebra_crossing: "#c9c53f",
        traffic_sign: "#5b9bd5",
        waterlogging: "#4aa8d8",
        debris: "#c9c53f",
        traffic: "#5b9bd5",
        safety: "#dc4b3e",
        incident: "#dc4b3e",
        behavior: "#f97316",
        infrastructure: "#8b5cf6",
        hazard: "#f59e0b",
      };

      const shouldShow = (iss: Issue) => {
        if (iss.category === "traffic") return layers.traffic;
        if (iss.category === "safety") return layers.safety;
        if (iss.category === "incident") return layers.incidents;
        return layers.defects;
      };

      issues.filter(shouldShow).forEach((iss) => {
        const isSelected = iss.id === selectedIssueId;
        const color = CATEGORY_COLOR[iss.category] || "#f97316";

        const el = document.createElement("div");
        el.style.cssText = `
          width: ${isSelected ? "22px" : "16px"};
          height: ${isSelected ? "22px" : "16px"};
          border-radius: 50%;
          background: ${color};
          border: ${isSelected ? "3px solid #fff" : "2px solid rgba(0,0,0,0.6)"};
          cursor: pointer;
          box-shadow: 0 0 ${isSelected ? "12px" : "4px"} ${color}80;
          transition: all 0.15s ease;
        `;
        el.title = `${iss.category} — ${iss.road}`;

        if (onSelectIssue) {
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            onSelectIssue(iss.id);
          });
        }

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([iss.position.lng, iss.position.lat])
          .addTo(map);
        markersRef.current.push(marker);
      });
    };

    if (map.isStyleLoaded()) {
      waitForLoad();
    } else {
      map.once("load", waitForLoad);
    }
  }, [issues, layers, selectedIssueId, onSelectIssue]);

  // ── Bus Markers ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layers.buses) {
      busMarkersRef.current.forEach((m) => m.remove());
      busMarkersRef.current.clear();
      return;
    }

    const waitForLoad = () => {
      // remove old markers not in buses list
      const newIds = new Set(buses.map((b) => b.id));
      busMarkersRef.current.forEach((m, id) => {
        if (!newIds.has(id)) { m.remove(); busMarkersRef.current.delete(id); }
      });

      buses.forEach((bus) => {
        const isSelected = bus.id === selectedBusId;
        const isOnline = bus.status !== "offline";

        let el = busMarkersRef.current.get(bus.id)?.getElement();

        if (!el) {
          el = document.createElement("div");
          el.style.cssText = `
            width: 18px; height: 18px;
            border-radius: 4px;
            background: ${isOnline ? "#60a5fa" : "#6b7280"};
            border: ${isSelected ? "3px solid #fff" : "2px solid rgba(0,0,0,0.7)"};
            cursor: pointer;
            box-shadow: 0 0 ${isSelected ? "10px" : "4px"} #60a5fa80;
            display: flex; align-items: center; justify-content: center;
          `;

          if (onSelectBus) {
            el.addEventListener("click", (e) => {
              e.stopPropagation();
              onSelectBus(bus.id);
            });
          }

          const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([bus.position.lng, bus.position.lat])
            .addTo(map);
          busMarkersRef.current.set(bus.id, marker);
        } else {
          // update position & style
          busMarkersRef.current.get(bus.id)?.setLngLat([bus.position.lng, bus.position.lat]);
          el.style.background = isOnline ? "#60a5fa" : "#6b7280";
          el.style.border = isSelected ? "3px solid #fff" : "2px solid rgba(0,0,0,0.7)";
          el.style.boxShadow = `0 0 ${isSelected ? "10px" : "4px"} #60a5fa80`;
        }
      });
    };

    if (map.isStyleLoaded()) waitForLoad();
    else map.once("load", waitForLoad);
  }, [buses, layers.buses, selectedBusId, onSelectBus]);

  // ── Layer Visibility Updates ─────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const setVis = (id: string, vis: boolean) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", vis ? "visible" : "none");
      }
    };

    setVis("layer-road-segments", layers.roadCondition);
    setVis("layer-heatmap", layers.heatmap);
    setVis("layer-bus-routes", Boolean(layers.routes ?? showRoutes));
  }, [layers, showRoutes]);

  // ── Fallback if no token ─────────────────────────────────────────────────

  if (!MAPBOX_ACCESS_TOKEN || !MAPBOX_ACCESS_TOKEN.startsWith("pk.")) {
    return (
      <div className={cn("relative flex items-center justify-center rounded-lg bg-[#0d1117] text-sm text-slate-400", className)}>
        <p>Set <code className="text-slate-200">VITE_MAPBOX_ACCESS_TOKEN</code> in <code className="text-slate-200">.env</code> to load map tiles.</p>
      </div>
    );
  }

  return (
    <div className={cn("relative isolate overflow-hidden", className)}>
      <div ref={containerRef} className="h-full w-full" />
      {overlay && (
        <div className="pointer-events-none absolute inset-0 z-10">
          {overlay}
        </div>
      )}
    </div>
  );
}

// ── MapLegend (unchanged API) ────────────────────────────────────────────────

export function MapLegend({ className }: { className?: string }) {
  const items = [
    { c: CONDITION_COLORS[0], l: "Good" },
    { c: CONDITION_COLORS[1], l: "Fair" },
    { c: CONDITION_COLORS[2], l: "Poor" },
    { c: CONDITION_COLORS[3], l: "Critical" },
  ];
  return (
    <div
      className={cn(
        "rounded border border-white/10 bg-black/80 px-2.5 py-2 shadow-lg backdrop-blur",
        className,
      )}
    >
      <p className="mb-1.5 text-[10px] uppercase tracking-widest text-slate-400">Road condition</p>
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {items.map((i) => (
          <li key={i.l} className="flex items-center gap-1.5 text-[11px] text-slate-200">
            <span className="h-0.5 w-4 rounded" style={{ background: i.c }} />
            {i.l}
          </li>
        ))}
      </ul>
    </div>
  );
}
