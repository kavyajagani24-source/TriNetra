/**
 * UrbanEye AI — MapFilters Component
 */

import { Search, Filter, Layers, Radio, AlertTriangle, Route, Flame, Activity } from "lucide-react";
import { useMapStore } from "@/store/mapStore";

interface MapFiltersProps {
  busCount?: number;
  eventCount?: number;
  criticalCount?: number;
}

export function MapFilters({ busCount = 0, eventCount = 0, criticalCount = 0 }: MapFiltersProps) {
  const { filters, setFilters, visibleLayers, toggleLayer, resetFilters } = useMapStore();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/90 backdrop-blur-md p-2 shadow-lg text-[12px]">
      {/* Left: Search & Dropdown Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-[180px]">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search bus, route, defect..."
            value={filters.searchQuery}
            onChange={(e) => setFilters({ searchQuery: e.target.value })}
            className="w-full rounded border border-border bg-secondary/30 py-1 pl-8 pr-2.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        {/* Category */}
        <select
          value={filters.category}
          onChange={(e) => setFilters({ category: e.target.value })}
          className="rounded border border-border bg-secondary/30 px-2 py-1 text-[11px] text-foreground focus:border-primary focus:outline-none"
        >
          <option value="all">All Categories</option>
          <option value="hazard">Road Hazards</option>
          <option value="safety">Pedestrian Safety</option>
          <option value="infrastructure">Infrastructure</option>
          <option value="behavior">Vehicle Behavior</option>
          <option value="incident">Traffic Incidents</option>
        </select>

        {/* Severity */}
        <select
          value={filters.severity}
          onChange={(e) => setFilters({ severity: e.target.value })}
          className="rounded border border-border bg-secondary/30 px-2 py-1 text-[11px] text-foreground focus:border-primary focus:outline-none"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical Only</option>
          <option value="high">High & Critical</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Time Range Pills */}
        <div className="hidden sm:inline-flex rounded-md border border-border bg-secondary/20 p-0.5 text-[10px]">
          {(["15m", "1h", "6h", "today", "all"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilters({ timeRange: t })}
              className={`rounded px-1.5 py-0.5 uppercase tracking-wider font-semibold transition-colors ${
                filters.timeRange === t
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "15m" ? "15m" : t === "1h" ? "1h" : t === "6h" ? "6h" : t === "today" ? "Today" : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Layer Toggles & Live Metrics */}
      <div className="flex items-center gap-1.5">
        {/* Layer Buttons */}
        <button
          onClick={() => toggleLayer("buses")}
          title="Toggle Fleet Buses Layer"
          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
            visibleLayers.buses
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : "border-border text-muted-foreground hover:bg-secondary"
          }`}
        >
          <Radio className="h-3 w-3" />
          Fleet ({busCount})
        </button>

        <button
          onClick={() => toggleLayer("events")}
          title="Toggle Urban Events Layer"
          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
            visibleLayers.events
              ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
              : "border-border text-muted-foreground hover:bg-secondary"
          }`}
        >
          <AlertTriangle className="h-3 w-3" />
          Events ({eventCount})
        </button>

        <button
          onClick={() => toggleLayer("congestion")}
          title="Toggle Traffic Congestion Heatmap"
          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
            visibleLayers.congestion
              ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
              : "border-border text-muted-foreground hover:bg-secondary"
          }`}
        >
          <Flame className="h-3 w-3" />
          Heatmap
        </button>

        <button
          onClick={() => toggleLayer("routes")}
          title="Toggle Transit Route Corridors"
          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
            visibleLayers.routes
              ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400"
              : "border-border text-muted-foreground hover:bg-secondary"
          }`}
        >
          <Route className="h-3 w-3" />
          Routes
        </button>

        {criticalCount > 0 && (
          <span className="hidden xl:inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/30 animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            {criticalCount} Critical
          </span>
        )}
      </div>
    </div>
  );
}
