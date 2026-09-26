import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  AlertTriangle,
  Compass,
  Eye,
  Flame,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  RotateCcw,
  School,
  Search,
  ShieldAlert,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MAPBOX_ACCESS_TOKEN, MAP_STYLES, DEFAULT_CENTER } from "@/config/map";
import type {
  HotspotDensityFilter,
  HotspotZoneFilter,
  PedestrianHotspot,
} from "@/types/safetyHotspots";
import type { SafetyIncident } from "@/types/safety";
import {
  MUMBAI_SAFETY_HOTSPOTS,
  buildHeatmapGeoJSON,
  buildHotspotPointsGeoJSON,
  anchorIncidentsToGeo,
} from "@/data/safetyHotspots";
import { Button } from "@/components/ui/button";

interface SafetyHotspotMapProps {
  incidents?: SafetyIncident[];
  selectedHotspotId?: string | null;
  onSelectHotspot: (hotspot: PedestrianHotspot | null) => void;
  onSelectIncident?: (incident: SafetyIncident) => void;
  className?: string;
}

export function SafetyHotspotMap({
  incidents = [],
  selectedHotspotId,
  onSelectHotspot,
  onSelectIncident,
  className,
}: SafetyHotspotMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const incidentMarkersRef = useRef<mapboxgl.Marker[]>([]);

  // Controls state
  const [densityFilter, setDensityFilter] = useState<HotspotDensityFilter>("all");
  const [zoneFilter, setZoneFilter] = useState<HotspotZoneFilter>("all");
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);

  const hasValidToken = Boolean(
    MAPBOX_ACCESS_TOKEN && MAPBOX_ACCESS_TOKEN.startsWith("pk.")
  );

  // Filtered hotspots
  const filteredHotspots = useMemo(() => {
    return MUMBAI_SAFETY_HOTSPOTS.filter((h) => {
      if (densityFilter !== "all" && h.movement_density !== densityFilter) return false;
      if (zoneFilter !== "all" && h.zone_type !== zoneFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          h.name.toLowerCase().includes(q) ||
          h.description.toLowerCase().includes(q) ||
          h.bus_routes_affected.some((r) => r.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [densityFilter, zoneFilter, searchQuery]);

  // Correlated incidents with coordinates
  const anchoredIncidents = useMemo(() => {
    return anchorIncidentsToGeo(incidents, MUMBAI_SAFETY_HOTSPOTS[0]);
  }, [incidents]);

  // ── Initialize Mapbox GL Map ────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !hasValidToken) return;

    try {
      mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [72.855, 19.045], // Mumbai transit center
        zoom: 11.8,
        attributionControl: false,
      });

      mapRef.current = map;

      map.on("load", () => {
        setMapLoaded(true);

        // 1. Add Heatmap GeoJSON Source
        map.addSource("urbaneye-pedestrian-heatmap", {
          type: "geojson",
          data: buildHeatmapGeoJSON(MUMBAI_SAFETY_HOTSPOTS),
        });

        // 2. Add Continuous Thermal Density Heatmap Layer
        map.addLayer({
          id: "layer-pedestrian-heatmap",
          type: "heatmap",
          source: "urbaneye-pedestrian-heatmap",
          paint: {
            "heatmap-weight": ["get", "weight"],
            "heatmap-intensity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              1,
              12,
              2.2,
              16,
              3.5,
            ],
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(0,0,0,0)",
              0.15,
              "rgba(14, 165, 233, 0.4)",
              0.35,
              "rgba(16, 185, 129, 0.65)",
              0.6,
              "rgba(245, 158, 11, 0.85)",
              0.8,
              "rgba(239, 68, 68, 0.95)",
              1.0,
              "rgba(220, 38, 38, 1.0)",
            ],
            "heatmap-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              12,
              12,
              35,
              16,
              65,
            ],
            "heatmap-opacity": 0.82,
          },
        });

        // 3. Add Hotspots GeoJSON Source
        map.addSource("urbaneye-hotspots-points", {
          type: "geojson",
          data: buildHotspotPointsGeoJSON(MUMBAI_SAFETY_HOTSPOTS),
        });

        // 4. Hotspots Outer Pulsing Ring
        map.addLayer({
          id: "layer-hotspots-glow",
          type: "circle",
          source: "urbaneye-hotspots-points",
          paint: {
            "circle-color": [
              "match",
              ["get", "movement_density"],
              "high",
              "#ef4444",
              "medium",
              "#f59e0b",
              "low",
              "#10b981",
              "#3b82f6",
            ],
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10,
              14,
              14,
              24,
            ],
            "circle-opacity": 0.25,
            "circle-blur": 0.4,
          },
        });

        // 5. Hotspots Inner Core Circle
        map.addLayer({
          id: "layer-hotspots-core",
          type: "circle",
          source: "urbaneye-hotspots-points",
          paint: {
            "circle-color": [
              "match",
              ["get", "movement_density"],
              "high",
              "#ef4444",
              "medium",
              "#f59e0b",
              "low",
              "#10b981",
              "#3b82f6",
            ],
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10,
              6,
              14,
              9,
            ],
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#ffffff",
          },
        });

        // 6. Hotspots Typography Labels
        map.addLayer({
          id: "layer-hotspots-labels",
          type: "symbol",
          source: "urbaneye-hotspots-points",
          layout: {
            "text-field": [
              "format",
              ["get", "name"],
              { "font-scale": 0.85, "text-font": ["literal", ["Open Sans Semibold", "Arial Unicode MS Bold"]] },
              "\n",
              {},
              ["concat", ["to-string", ["get", "pedestrians_per_hour"]], " peds/hr"],
              { "font-scale": 0.75, "text-color": "#94a3b8" }
            ],
            "text-offset": [0, 1.4],
            "text-anchor": "top",
            "text-size": 11,
            "text-max-width": 14,
          },
          paint: {
            "text-color": "#f8fafc",
            "text-halo-color": "#090d16",
            "text-halo-width": 2,
          },
        });

        // ── Interaction: Click on Hotspot ──────────────────────────────────
        map.on("click", "layer-hotspots-core", (e) => {
          if (!e.features || !e.features[0]) return;
          const featId = e.features[0].properties?.["id"];
          const matched = MUMBAI_SAFETY_HOTSPOTS.find((h) => h.id === featId);
          if (matched) {
            onSelectHotspot(matched);
            map.flyTo({
              center: matched.coordinates,
              zoom: 14.5,
              speed: 1.2,
              curve: 1.4,
            });
          }
        });

        map.on("mouseenter", "layer-hotspots-core", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "layer-hotspots-core", () => {
          map.getCanvas().style.cursor = "";
        });
      });

      map.on("error", () => {
        setMapError(true);
      });
    } catch {
      setMapError(true);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [hasValidToken, onSelectHotspot]);

  // ── Sync GeoJSON Sources when Filters change ────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    const pointsSource = map.getSource(
      "urbaneye-hotspots-points"
    ) as mapboxgl.GeoJSONSource | undefined;
    if (pointsSource) {
      pointsSource.setData(buildHotspotPointsGeoJSON(filteredHotspots));
    }

    const heatSource = map.getSource(
      "urbaneye-pedestrian-heatmap"
    ) as mapboxgl.GeoJSONSource | undefined;
    if (heatSource) {
      heatSource.setData(buildHeatmapGeoJSON(filteredHotspots));
    }
  }, [filteredHotspots, mapLoaded]);

  // ── Toggle Heatmap Layer Visibility ─────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    if (map.getLayer("layer-pedestrian-heatmap")) {
      map.setLayoutProperty(
        "layer-pedestrian-heatmap",
        "visibility",
        showHeatmap ? "visible" : "none"
      );
    }
  }, [showHeatmap, mapLoaded]);

  // ── Pin Active Run Incidents onto Map ───────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    // Clear previous incident markers
    incidentMarkersRef.current.forEach((m) => m.remove());
    incidentMarkersRef.current = [];

    // Add HTML markers for each incident
    anchoredIncidents.forEach((inc) => {
      const el = document.createElement("div");
      el.className =
        "group relative flex items-center justify-center cursor-pointer select-none";

      const isHighRisk = inc.risk_level === "high";

      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          <div class="absolute -inset-1 rounded-full ${
            isHighRisk ? "bg-red-500/40 animate-ping" : "bg-amber-500/40"
          }"></div>
          <div class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-lg ${
            isHighRisk ? "bg-red-600 text-white" : "bg-amber-500 text-white"
          } transition-transform hover:scale-125">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
              <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
            </svg>
          </div>
          <div class="pointer-events-none absolute -top-7 whitespace-nowrap rounded bg-black/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow opacity-0 group-hover:opacity-100 transition-opacity">
            ${inc.title} (#${inc.track_id})
          </div>
        </div>
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectIncident?.(inc);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(inc.coordinates)
        .addTo(map);

      incidentMarkersRef.current.push(marker);
    });
  }, [anchoredIncidents, mapLoaded, onSelectIncident]);

  // ── Fly to selected hotspot when changed externally ────────────────────────
  useEffect(() => {
    if (!selectedHotspotId || !mapRef.current || !mapLoaded) return;
    const h = MUMBAI_SAFETY_HOTSPOTS.find((item) => item.id === selectedHotspotId);
    if (h) {
      mapRef.current.flyTo({
        center: h.coordinates,
        zoom: 14.5,
        speed: 1.2,
      });
    }
  }, [selectedHotspotId, mapLoaded]);

  // Map Navigation Handlers
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleReset = () => {
    mapRef.current?.flyTo({
      center: [72.855, 19.045],
      zoom: 11.8,
    });
    onSelectHotspot(null);
  };

  // High, medium, low counts
  const highCount = MUMBAI_SAFETY_HOTSPOTS.filter((h) => h.movement_density === "high").length;
  const medCount = MUMBAI_SAFETY_HOTSPOTS.filter((h) => h.movement_density === "medium").length;
  const lowCount = MUMBAI_SAFETY_HOTSPOTS.filter((h) => h.movement_density === "low").length;

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className
      )}
    >
      {/* ── Top Floating Controls Bar ────────────────────────────────────────── */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left Filter & Search Pill */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/80 bg-card/90 p-1.5 shadow-lg backdrop-blur-md pointer-events-auto">
          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search corridor or route..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-44 rounded-lg border border-border/80 bg-background/90 pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="h-4 w-[1px] bg-border mx-0.5" />

          {/* Density Filter Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDensityFilter("all")}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-semibold transition",
                densityFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              All ({MUMBAI_SAFETY_HOTSPOTS.length})
            </button>
            <button
              onClick={() => setDensityFilter("high")}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-semibold transition flex items-center gap-1",
                densityFilter === "high"
                  ? "bg-critical text-white shadow-sm"
                  : "text-muted-foreground hover:text-critical hover:bg-critical/10"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-critical" />
              High Movement ({highCount})
            </button>
            <button
              onClick={() => setDensityFilter("medium")}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-semibold transition flex items-center gap-1",
                densityFilter === "medium"
                  ? "bg-warn text-white shadow-sm"
                  : "text-muted-foreground hover:text-warn hover:bg-warn/10"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-warn" />
              Medium ({medCount})
            </button>
            <button
              onClick={() => setDensityFilter("low")}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-semibold transition flex items-center gap-1",
                densityFilter === "low"
                  ? "bg-ok text-white shadow-sm"
                  : "text-muted-foreground hover:text-ok hover:bg-ok/10"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              Low ({lowCount})
            </button>
          </div>
        </div>

        {/* Right Layer & View Toggles */}
        <div className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-card/90 p-1.5 shadow-lg backdrop-blur-md pointer-events-auto">
          {/* Heatmap Toggle */}
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition",
              showHeatmap
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Toggle continuous thermal movement heatmap"
          >
            <Flame className="h-3.5 w-3.5" />
            <span>Heatmap {showHeatmap ? "ON" : "OFF"}</span>
          </button>

          {/* Correlated Incidents Badge */}
          {anchoredIncidents.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-critical/15 text-critical border border-critical/30 px-2 py-1 text-[11px] font-bold">
              <span className="h-2 w-2 rounded-full bg-critical animate-pulse" />
              {anchoredIncidents.length} Video Incidents Pinned
            </span>
          )}
        </div>
      </div>

      {/* ── Main Map Canvas Viewport ────────────────────────────────────────── */}
      <div className="relative min-h-[460px] flex-1 bg-background overflow-hidden">
        {hasValidToken && !mapError ? (
          <div ref={containerRef} className="h-full w-full" />
        ) : (
          /* High-Fidelity Interactive SVG Fallback (If WebGL or Token is restricted) */
          <div className="relative flex h-full w-full flex-col items-center justify-center p-8 text-center bg-radial from-card to-background">
            <div className="max-w-md space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
                <MapPin className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-foreground">
                Mumbai Pedestrian Movement Radar Active
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Displaying {filteredHotspots.length} verified corridor safety hotspots across Western & Eastern transit corridors.
              </p>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="rounded-lg border border-critical/30 bg-critical/10 p-2 text-center">
                  <div className="text-base font-extrabold text-critical">{highCount}</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">High Density</div>
                </div>
                <div className="rounded-lg border border-warn/30 bg-warn/10 p-2 text-center">
                  <div className="text-base font-extrabold text-warn">{medCount}</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">Medium Density</div>
                </div>
                <div className="rounded-lg border border-ok/30 bg-ok/10 p-2 text-center">
                  <div className="text-base font-extrabold text-ok">{lowCount}</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">Low Density</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Bottom-Left Legend Overlay ────────────────────────────────────── */}
        <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5 rounded-xl border border-border/80 bg-card/90 p-3 shadow-xl backdrop-blur-md text-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-primary" />
            Pedestrian Movement Intensity
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between gap-4 text-[11px]">
              <span className="flex items-center gap-1.5 text-critical font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-critical shadow-sm" />
                High Movement Hotspot
              </span>
              <span className="font-mono text-muted-foreground">1,200+ peds/hr</span>
            </div>

            <div className="flex items-center justify-between gap-4 text-[11px]">
              <span className="flex items-center gap-1.5 text-warn font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-warn shadow-sm" />
                Medium Density Corridor
              </span>
              <span className="font-mono text-muted-foreground">450 - 1,200 peds/hr</span>
            </div>

            <div className="flex items-center justify-between gap-4 text-[11px]">
              <span className="flex items-center gap-1.5 text-ok font-medium">
                <span className="h-2.5 w-2.5 rounded-full bg-ok shadow-sm" />
                Low Movement / Buffer
              </span>
              <span className="font-mono text-muted-foreground">&lt; 450 peds/hr</span>
            </div>

            <div className="flex items-center justify-between gap-4 text-[11px] pt-1 border-t border-border/60">
              <span className="flex items-center gap-1.5 text-primary font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-primary animate-ping" />
                Video Incidents Pinned
              </span>
              <span className="font-mono text-foreground font-semibold">{incidents.length} encounters</span>
            </div>
          </div>
        </div>

        {/* ── Bottom-Right Navigation Floating Tools ────────────────────────── */}
        <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5 rounded-xl border border-border/80 bg-card/90 p-1 shadow-xl backdrop-blur-md">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleZoomIn}
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleZoomOut}
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="h-[1px] bg-border my-0.5" />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleReset}
            title="Reset Map to Mumbai Overview"
            aria-label="Reset Map"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
