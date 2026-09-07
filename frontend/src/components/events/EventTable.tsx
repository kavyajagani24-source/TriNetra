import { useState } from "react";
import {
  Search,
  Filter,
  Eye,
  AlertTriangle,
  Layers,
  MapPin,
  Clock,
  CheckCircle2,
  RefreshCw,
  Activity,
} from "lucide-react";
import type { BackendUrbanEvent } from "@/types/api";
import {
  getEventTypeLabel,
  getEventCategoryLabel,
  getSeverityClasses,
  getCategoryClasses,
} from "@/utils/eventUtils";
import { formatConfidence, formatDuration, formatCoordinates } from "@/utils/formatters";
import { EventDetailModal } from "./EventDetailModal";

interface EventTableProps {
  events: BackendUrbanEvent[];
  loading?: boolean;
  onRefresh?: () => void;
  title?: string;
  subtitle?: string;
}

export function EventTable({
  events,
  loading = false,
  onRefresh,
  title = "Urban Safety & Hazard Observations",
  subtitle = "AI-detected events corroborated by onboard transit camera inference runs.",
}: EventTableProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<BackendUrbanEvent | null>(null);

  const filteredEvents = events.filter((ev) => {
    const matchesSearch =
      ev.description?.toLowerCase().includes(search.toLowerCase()) ||
      ev.event_type.toLowerCase().includes(search.toLowerCase()) ||
      ev.id.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || ev.category.toLowerCase() === categoryFilter.toLowerCase();
    const matchesSeverity =
      severityFilter === "all" || ev.severity.toLowerCase() === severityFilter.toLowerCase();

    return matchesSearch && matchesCategory && matchesSeverity;
  });

  return (
    <div className="space-y-3">
      {/* Header & Controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded border border-border bg-card py-1.5 pl-8 pr-3 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded border border-border bg-card px-2.5 py-1.5 text-[11px] text-foreground focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="hazard">Road Hazards</option>
            <option value="safety">Pedestrian Safety</option>
            <option value="infrastructure">Infrastructure</option>
            <option value="behavior">Vehicle Behavior</option>
            <option value="incident">Traffic Incidents</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded border border-border bg-card px-2.5 py-1.5 text-[11px] text-foreground focus:outline-none"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="rounded border border-border bg-card p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Refresh events"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {loading && events.length === 0 ? (
          <div className="flex h-44 items-center justify-center text-[12px] text-muted-foreground">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin text-primary" /> Loading detection events...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Activity className="h-8 w-8 text-muted-foreground/40 mb-1.5" />
            <p className="text-[13px] font-medium text-foreground">No matching events found</p>
            <p className="text-[11px]">Try adjusting your search criteria or category filter.</p>
          </div>
        ) : (
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-border bg-secondary/30 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Event Type</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Timestamp</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2 text-right">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredEvents.map((ev) => {
                const sev = getSeverityClasses(ev.severity);
                return (
                  <tr
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className="cursor-pointer transition-colors hover:bg-secondary/30"
                  >
                    <td className="px-3 py-2 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${sev.dot}`} />
                        <div>
                          <span className="block font-semibold text-foreground">
                            {getEventTypeLabel(ev.event_type)}
                          </span>
                          <span className="block max-w-xs truncate text-[10px] text-muted-foreground">
                            {ev.description}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${getCategoryClasses(
                          ev.category
                        )}`}
                      >
                        {getEventCategoryLabel(ev.category)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${sev.badge}`}
                      >
                        {ev.severity}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-medium text-foreground">
                          {formatConfidence(ev.confidence)}
                        </span>
                        <div className="h-1.5 w-12 rounded-full bg-secondary overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              ev.confidence >= 0.8
                                ? "bg-emerald-500"
                                : ev.confidence >= 0.5
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                            }`}
                            style={{ width: `${Math.round(ev.confidence * 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground font-mono text-[11px]">
                      T+{formatDuration(ev.timestamp)} (#{ev.frame_number})
                    </td>
                    <td className="px-3 py-2 text-muted-foreground font-mono text-[11px]">
                      {ev.latitude && ev.longitude
                        ? formatCoordinates(ev.latitude, ev.longitude)
                        : "Corridor GPS"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(ev);
                        }}
                        className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-[11px] font-medium text-primary hover:bg-secondary"
                      >
                        <Eye className="h-3 w-3" /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}
