import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Film,
  Filter,
  Flame,
  Layers,
  ListFilter,
  Loader2,
  Map,
  MapPin,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, PageHeader } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { SafetyEventCard } from "@/components/safety/SafetyEventCard";
import {
  SafetyIncidentCard,
  type OfficialIncidentStatus,
} from "@/components/safety/SafetyIncidentCard";
import { SafetyVideoPlayer } from "@/components/safety/SafetyVideoPlayer";
import { SafetyEventInspector } from "@/components/safety/SafetyEventInspector";
import { SafetyIncidentInspector } from "@/components/safety/SafetyIncidentInspector";
import { SafetyHotspotMap } from "@/components/safety/SafetyHotspotMap";
import { SafetyHotspotCard } from "@/components/safety/SafetyHotspotCard";
import { SafetyHotspotInspector } from "@/components/safety/SafetyHotspotInspector";
import {
  getSafetyRuns,
  getSafetyRunEvents,
  getSafetyEventDetail,
} from "@/services/api/safety";
import type {
  SafetyEventDetail,
  SafetyEventListItem,
  SafetyIncident,
  SafetyRun,
} from "@/types/safety";
import { aggregateEventsToIncidents } from "@/types/safety";
import type {
  HotspotDensityFilter,
  PedestrianHotspot,
} from "@/types/safetyHotspots";
import { MUMBAI_SAFETY_HOTSPOTS } from "@/data/safetyHotspots";
import { cn } from "@/lib/utils";

type RiskFilter = "all" | "high" | "medium" | "low";
type PrimaryView = "video" | "map";

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(0);
  return `${m}m ${s}s`;
}

export function SafetyPage() {
  // Navigation View State: "video" (video triage) or "map" (geospatial hotspot GIS)
  const [primaryView, setPrimaryView] = useState<PrimaryView>("video");

  // Data state
  const [runs, setRuns] = useState<SafetyRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<SafetyRun | null>(null);
  const [events, setEvents] = useState<SafetyEventListItem[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);

  // UI state
  const [runsLoading, setRunsLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<"incidents" | "raw">("incidents");

  // Selection & Inspector (Video Mode)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<SafetyIncident | null>(null);
  const [inspectedEvent, setInspectedEvent] = useState<SafetyEventDetail | null>(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);

  // Selection & Filters (Hotspot Map Mode)
  const [selectedHotspot, setSelectedHotspot] = useState<PedestrianHotspot | null>(null);
  const [hotspotDensityFilter, setHotspotDensityFilter] =
    useState<HotspotDensityFilter>("all");
  const [hotspotSearchQuery, setHotspotSearchQuery] = useState("");

  // Official Review Statuses (persisted in localStorage)
  const [incidentStatuses, setIncidentStatuses] = useState<
    Record<string, { status: OfficialIncidentStatus; notes?: string }>
  >(() => {
    try {
      const raw = localStorage.getItem("trinetra_safety_incident_reviews");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const handleUpdateIncidentStatus = useCallback(
    (incidentId: string, status: OfficialIncidentStatus, notes?: string) => {
      setIncidentStatuses((prev) => {
        const next = {
          ...prev,
          [incidentId]: { status, notes: notes ?? prev[incidentId]?.notes ?? "" },
        };
        try {
          localStorage.setItem("trinetra_safety_incident_reviews", JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    []
  );

  // Load runs on mount
  useEffect(() => {
    setRunsLoading(true);
    getSafetyRuns(1, 50)
      .then((res) => {
        setRuns(res.data);
        if (res.data[0]) setSelectedRun(res.data[0]);
      })
      .catch(() => {})
      .finally(() => setRunsLoading(false));
  }, []);

  // Load events when run or filter changes
  useEffect(() => {
    if (!selectedRun) return;
    setEventsLoading(true);
    getSafetyRunEvents(selectedRun.id, {
      risk_level: riskFilter === "all" ? undefined : riskFilter,
      event_type: eventTypeFilter || undefined,
      limit: 500, // Fetch comprehensive dataset for incident aggregation
    })
      .then((res) => {
        setEvents(res.data);
        setTotalEvents(res.total);
      })
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, [selectedRun, riskFilter, eventTypeFilter]);

  const fps = selectedRun?.video_fps ?? 30;

  // Aggregate raw frame detections into distinct, actionable VRU incidents
  const allIncidents = useMemo(() => {
    return aggregateEventsToIncidents(events, fps);
  }, [events, fps]);

  // Filtered incidents based on active risk level and hazard type
  const filteredIncidents = useMemo(() => {
    return allIncidents.filter((inc) => {
      if (riskFilter !== "all" && inc.risk_level !== riskFilter) return false;
      if (eventTypeFilter && inc.event_type !== eventTypeFilter) return false;
      return true;
    });
  }, [allIncidents, riskFilter, eventTypeFilter]);

  // Filtered hotspots for Map list view
  const filteredHotspots = useMemo(() => {
    return MUMBAI_SAFETY_HOTSPOTS.filter((h) => {
      if (hotspotDensityFilter !== "all" && h.movement_density !== hotspotDensityFilter)
        return false;
      if (hotspotSearchQuery.trim()) {
        const q = hotspotSearchQuery.toLowerCase();
        return (
          h.name.toLowerCase().includes(q) ||
          h.description.toLowerCase().includes(q) ||
          h.bus_routes_affected.some((r) => r.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [hotspotDensityFilter, hotspotSearchQuery]);

  // Handle selecting an aggregated incident
  const handleSelectIncident = useCallback((incident: SafetyIncident) => {
    setSelectedIncident(incident);
    setSelectedEventId(incident.id);
    setInspectorLoading(true);
    getSafetyEventDetail(incident.id)
      .then(setInspectedEvent)
      .catch(() => {})
      .finally(() => setInspectorLoading(false));
  }, []);

  // Handle selecting a raw event
  const handleSelectEvent = useCallback((event: SafetyEventListItem) => {
    setSelectedEventId(event.id);
    setSelectedIncident(null);
    setInspectorLoading(true);
    getSafetyEventDetail(event.id)
      .then(setInspectedEvent)
      .catch(() => {})
      .finally(() => setInspectorLoading(false));
  }, []);

  // Video player seeks to event or incident
  const handleVideoSeek = useCallback((event: SafetyEventListItem) => {
    setSelectedEventId(event.id);
  }, []);

  // Dismiss inspector
  const handleCloseInspector = useCallback(() => {
    setInspectedEvent(null);
    setSelectedIncident(null);
    setSelectedEventId(null);
    setSelectedHotspot(null);
  }, []);

  // Switch from Incident Inspector to Hotspot Map
  const handleLocateOnMap = useCallback(() => {
    setPrimaryView("map");
    // Select the first school hotspot or matching corridor
    setSelectedHotspot(MUMBAI_SAFETY_HOTSPOTS[0]);
  }, []);

  // Switch from Hotspot to Video Incident
  const handleInspectInVideo = useCallback(
    (incident: SafetyIncident) => {
      setPrimaryView("video");
      handleSelectIncident(incident);
    },
    [handleSelectIncident]
  );

  // Incident counts for official dashboard
  const highIncidentCount = allIncidents.filter((i) => i.risk_level === "high").length;
  const medIncidentCount = allIncidents.filter((i) => i.risk_level === "medium").length;
  const reviewedIncidentCount = allIncidents.filter(
    (i) => incidentStatuses[i.id]?.status && incidentStatuses[i.id].status !== "pending"
  ).length;

  // Hotspot counts
  const highHotspotsCount = MUMBAI_SAFETY_HOTSPOTS.filter(
    (h) => h.movement_density === "high"
  ).length;
  const medHotspotsCount = MUMBAI_SAFETY_HOTSPOTS.filter(
    (h) => h.movement_density === "medium"
  ).length;
  const lowHotspotsCount = MUMBAI_SAFETY_HOTSPOTS.filter(
    (h) => h.movement_density === "low"
  ).length;

  // Unique event types from current events
  const eventTypes = Array.from(new Set(events.map((e) => e.event_type))).sort();

  return (
    <AppShell>
      <div className="flex h-full flex-col overflow-hidden bg-background">
        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col border-b border-border bg-card/60 px-5 py-2.5 md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                Safety Intelligence
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Module 3 · VRU AI
                </span>
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automated Vulnerable Road User (VRU) trajectory, incident triage & geospatial pedestrian movement hotspots
            </p>
          </div>

          {/* Right Tools: View Mode Switcher + Run Selector */}
          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Segmented Switcher */}
            <div className="flex items-center rounded-lg border border-border bg-muted/60 p-1 text-xs shadow-sm">
              <button
                type="button"
                onClick={() => setPrimaryView("video")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition",
                  primaryView === "video"
                    ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Review footage and triage actionable safety incidents"
              >
                <Video className="h-3.5 w-3.5 text-primary" />
                <span>Video Triage</span>
                <span className="rounded bg-primary/10 text-primary px-1 py-0.2 text-[10px] font-bold">
                  {allIncidents.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPrimaryView("map")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition",
                  primaryView === "map"
                    ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="View pedestrian movement hotspots and density heatmap"
              >
                <Map className="h-3.5 w-3.5 text-primary" />
                <span>Hotspots Map</span>
                <span className="rounded bg-critical/15 text-critical px-1 py-0.2 text-[10px] font-bold">
                  {MUMBAI_SAFETY_HOTSPOTS.length} Corridors
                </span>
              </button>
            </div>

            {/* Run Selector Dropdown */}
            {runs.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline">
                  Run:
                </span>
                <div className="relative">
                  <select
                    value={selectedRun?.id ?? ""}
                    onChange={(e) => {
                      const run = runs.find((r) => r.id === e.target.value);
                      if (run) {
                        setSelectedRun(run);
                        handleCloseInspector();
                      }
                    }}
                    className="h-8 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-xs font-medium text-foreground shadow-sm hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    aria-label="Select safety analysis run"
                  >
                    {runs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {new Date(r.created_at).toLocaleString([], {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}{" "}
                        — {r.total_events} detections
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Loading Splash ───────────────────────────────────────────────── */}
        {runsLoading && (
          <div className="flex flex-1 items-center justify-center gap-2.5 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Loading safety intelligence pipeline data…
          </div>
        )}

        {/* ── Empty State ──────────────────────────────────────────────────── */}
        {!runsLoading && runs.length === 0 && (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState
              icon={ShieldCheck}
              title="No safety analysis runs found"
              description="Upload and process bus camera footage through the AI pipeline to analyze pedestrian interactions."
            />
          </div>
        )}

        {/* ── Dashboard Content ────────────────────────────────────────────── */}
        {!runsLoading && selectedRun && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* ── Dynamic Metric Ribbon: Adapts based on Primary View ───────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 border-b border-border bg-card/40 p-3">
              {primaryView === "video" ? (
                <>
                  {/* Critical Incidents */}
                  <div className="flex items-center gap-3 rounded-lg border border-critical/30 bg-critical/5 px-3.5 py-2.5 shadow-sm">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-critical/15 text-critical">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-critical/80">
                        Critical Incidents
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-extrabold text-foreground">
                          {highIncidentCount}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Require Review
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Precautionary Incidents */}
                  <div className="flex items-center gap-3 rounded-lg border border-warn/30 bg-warn/5 px-3.5 py-2.5 shadow-sm">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warn/15 text-warn">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-warn/80">
                        Precautionary
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-extrabold text-foreground">
                          {medIncidentCount}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Curb / Proximity
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Official Review Progress */}
                  <div className="flex items-center gap-3 rounded-lg border border-ok/30 bg-ok/5 px-3.5 py-2.5 shadow-sm">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ok/15 text-ok">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-ok/80">
                        Official Triage
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-extrabold text-foreground">
                          {reviewedIncidentCount} / {allIncidents.length}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {allIncidents.length > 0 &&
                          reviewedIncidentCount === allIncidents.length
                            ? "Completed"
                            : "Processed"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pipeline Video Coverage */}
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5 shadow-sm">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                      <Film className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Video Coverage
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-bold text-foreground">
                          {selectedRun.total_frames} Frames
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ({formatDuration(selectedRun.elapsed_seconds)} @ {fps} FPS)
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Hotspot Map Mode Metrics */
                <>
                  {/* High Movement Corridors */}
                  <div className="flex items-center gap-3 rounded-lg border border-critical/30 bg-critical/5 px-3.5 py-2.5 shadow-sm">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-critical/15 text-critical">
                      <Flame className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-critical/80">
                        High Movement Hotspots
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-extrabold text-foreground">
                          {highHotspotsCount}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          1,200+ peds/hr
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Medium Movement Corridors */}
                  <div className="flex items-center gap-3 rounded-lg border border-warn/30 bg-warn/5 px-3.5 py-2.5 shadow-sm">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warn/15 text-warn">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-warn/80">
                        Medium Density Zones
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-extrabold text-foreground">
                          {medHotspotsCount}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          450 - 1,200 peds/hr
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Low Movement Corridors */}
                  <div className="flex items-center gap-3 rounded-lg border border-ok/30 bg-ok/5 px-3.5 py-2.5 shadow-sm">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ok/15 text-ok">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-ok/80">
                        Low Movement / Safe
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-extrabold text-foreground">
                          {lowHotspotsCount}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          &lt; 450 peds/hr
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Correlated Incidents Pinned */}
                  <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-2.5 shadow-sm">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
                        Run Geocoding
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-extrabold text-foreground">
                          {allIncidents.length}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Incidents Mapped
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ── Main Workspace: Switchable between Video Triage and Hotspots Map ─ */}
            <div className="flex min-h-0 flex-1 overflow-hidden">
              {primaryView === "video" ? (
                /* ═══════════════════════════════════════════════════════════════
                 * 🎥 VIEW A: VIDEO INCIDENT TRIAGE WORKSPACE
                 * ═══════════════════════════════════════════════════════════════ */
                <>
                  {/* Left Panel: Consolidated Incident Feed */}
                  <div className="flex w-[340px] md:w-[380px] xl:w-[420px] shrink-0 flex-col border-r border-border bg-card/30">
                    {/* Header & Mode Switcher */}
                    <div className="flex flex-col gap-2.5 border-b border-border p-3 bg-card/60">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                            <ShieldAlert className="h-3.5 w-3.5 text-primary" />
                            <span>
                              {viewMode === "incidents"
                                ? "Actionable Incidents"
                                : "Raw Detections Log"}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {viewMode === "incidents"
                              ? `Consolidated ${totalEvents} frame detections into ${allIncidents.length} encounters`
                              : `Frame-by-frame detector output`}
                          </p>
                        </div>

                        {/* Mode Toggle Switch */}
                        <div className="flex items-center rounded-lg border border-border bg-muted/60 p-0.5 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setViewMode("incidents")}
                            className={cn(
                              "rounded-md px-2 py-0.5 font-semibold transition",
                              viewMode === "incidents"
                                ? "bg-card text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                            title="Executive Incident View: Grouped by pedestrian encounters"
                          >
                            Incidents ({allIncidents.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewMode("raw")}
                            className={cn(
                              "rounded-md px-2 py-0.5 font-semibold transition",
                              viewMode === "raw"
                                ? "bg-card text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                            title="Technical CV View: Frame-by-frame detections"
                          >
                            Raw ({totalEvents})
                          </button>
                        </div>
                      </div>

                      {/* Risk filter buttons */}
                      <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-muted/50 border border-border/40">
                        {(["all", "high", "medium", "low"] as const).map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() => setRiskFilter(lvl)}
                            className={cn(
                              "rounded-md py-1 text-[11px] font-semibold capitalize transition text-center",
                              riskFilter === lvl
                                ? lvl === "high"
                                  ? "bg-critical text-white shadow-sm"
                                  : lvl === "medium"
                                    ? "bg-warn text-white shadow-sm"
                                    : lvl === "low"
                                      ? "bg-ok text-white shadow-sm"
                                      : "bg-card text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>

                      {/* Hazard Type Dropdown */}
                      {eventTypes.length > 0 && (
                        <div className="relative">
                          <select
                            value={eventTypeFilter}
                            onChange={(e) => setEventTypeFilter(e.target.value)}
                            className="h-7 w-full appearance-none rounded-md border border-border bg-card px-2.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                            aria-label="Filter by event type"
                          >
                            <option value="">All Hazard Types ({eventTypes.length})</option>
                            {eventTypes.map((t) => (
                              <option key={t} value={t}>
                                {t.replace(/_/g, " ")}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Event / Incident Cards Scroll Area */}
                    <div className="min-h-0 flex-1 overflow-y-auto p-2.5 space-y-2.5">
                      {eventsLoading ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          Loading safety events…
                        </div>
                      ) : viewMode === "incidents" ? (
                        filteredIncidents.length === 0 ? (
                          <div className="py-12 text-center text-xs text-muted-foreground">
                            <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                            <p className="font-semibold text-foreground">
                              No incidents match criteria
                            </p>
                            <p className="mt-1">
                              Try switching to "All" risk or clear the hazard filter.
                            </p>
                          </div>
                        ) : (
                          filteredIncidents.map((inc) => (
                            <SafetyIncidentCard
                              key={inc.id}
                              incident={inc}
                              isSelected={inc.id === selectedEventId}
                              status={incidentStatuses[inc.id]?.status ?? "pending"}
                              onSelect={handleSelectIncident}
                              onUpdateStatus={(id, status, e) => {
                                e.stopPropagation();
                                handleUpdateIncidentStatus(id, status);
                              }}
                            />
                          ))
                        )
                      ) : events.length === 0 ? (
                        <div className="py-12 text-center text-xs text-muted-foreground">
                          <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                          <p className="font-semibold text-foreground">
                            No raw detections match criteria
                          </p>
                          <p className="mt-1">
                            Try switching to "All" risk or clear the hazard filter.
                          </p>
                        </div>
                      ) : (
                        events.map((ev) => (
                          <SafetyEventCard
                            key={ev.id}
                            event={ev}
                            fps={fps}
                            isSelected={ev.id === selectedEventId}
                            onSelect={handleSelectEvent}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* Main Center: Expansive Video Player */}
                  <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-4 bg-muted/10">
                    <div className="flex flex-col gap-3 max-w-6xl mx-auto w-full">
                      {/* Video Player */}
                      <SafetyVideoPlayer
                        run={selectedRun}
                        events={events}
                        incidents={allIncidents}
                        selectedEventId={selectedEventId}
                        onSeekToEvent={handleVideoSeek}
                        onSeekToIncident={handleSelectIncident}
                      />

                      {/* Compact Run Telemetry & Context Strip */}
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-sm text-xs">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">Run ID:</span>
                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                              {selectedRun.id.slice(0, 8)}
                            </code>
                          </div>
                          <div className="h-3 w-[1px] bg-border hidden sm:block" />
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">Analyzed:</span>
                            <span className="font-medium text-foreground">
                              {selectedRun.processed_frames} / {selectedRun.total_frames}{" "}
                              Frames ({fps} FPS)
                            </span>
                          </div>
                          <div className="h-3 w-[1px] bg-border hidden sm:block" />
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">
                              Actionable Encounters:
                            </span>
                            <span className="rounded bg-primary/10 text-primary px-1.5 py-0.2 font-mono text-[10px] font-bold">
                              {allIncidents.length} Incidents
                            </span>
                          </div>
                        </div>

                        {/* Breakdown Tag Pills */}
                        {selectedRun.events_by_type &&
                          Object.keys(selectedRun.events_by_type).length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {Object.entries(selectedRun.events_by_type).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                                >
                                  <span className="capitalize">
                                    {k.replace(/_/g, " ")}:
                                  </span>
                                  <span className="font-bold text-foreground">{v}</span>
                                </span>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Right Panel: Contextual Inspector */}
                  {(selectedIncident || inspectedEvent) && (
                    <div className="w-[360px] xl:w-[420px] shrink-0 border-l border-border bg-card flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 shadow-xl">
                      {/* Inspector Header with Close Button */}
                      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-muted/20">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          {selectedIncident
                            ? "Incident Action & Verification"
                            : "Raw Detection Deep Dive"}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={handleCloseInspector}
                          aria-label="Close inspector"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Inspector Content */}
                      <div className="min-h-0 flex-1 overflow-y-auto">
                        {inspectorLoading ? (
                          <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            Fetching incident telemetry…
                          </div>
                        ) : selectedIncident ? (
                          <SafetyIncidentInspector
                            incident={selectedIncident}
                            detail={inspectedEvent}
                            fps={fps}
                            status={
                              incidentStatuses[selectedIncident.id]?.status ?? "pending"
                            }
                            notes={incidentStatuses[selectedIncident.id]?.notes}
                            onUpdateStatus={(status, notes) =>
                              handleUpdateIncidentStatus(
                                selectedIncident.id,
                                status,
                                notes
                              )
                            }
                            onSeekToIncident={(inc) => {
                              handleVideoSeek(inc.primary_event);
                            }}
                            onLocateOnMap={handleLocateOnMap}
                            onClose={handleCloseInspector}
                          />
                        ) : inspectedEvent ? (
                          <SafetyEventInspector
                            event={inspectedEvent}
                            fps={fps}
                            onClose={handleCloseInspector}
                          />
                        ) : null}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* ═══════════════════════════════════════════════════════════════
                 * 🗺️ VIEW B: PEDESTRIAN MOVEMENT HOTSPOT GIS WORKSPACE
                 * ═══════════════════════════════════════════════════════════════ */
                <>
                  {/* Left Panel: Hotspot Corridors List */}
                  <div className="flex w-[340px] md:w-[380px] xl:w-[400px] shrink-0 flex-col border-r border-border bg-card/30">
                    <div className="flex flex-col gap-2.5 border-b border-border p-3 bg-card/60">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                            <Flame className="h-3.5 w-3.5 text-primary" />
                            <span>Pedestrian Movement Hotspots</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Categorized by pedestrian footfall volume & risk
                          </p>
                        </div>
                        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                          {filteredHotspots.length} Corridors
                        </span>
                      </div>

                      {/* Density Filter Buttons */}
                      <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-muted/50 border border-border/40">
                        {(["all", "high", "medium", "low"] as const).map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() => setHotspotDensityFilter(lvl)}
                            className={cn(
                              "rounded-md py-1 text-[11px] font-semibold capitalize transition text-center",
                              hotspotDensityFilter === lvl
                                ? lvl === "high"
                                  ? "bg-critical text-white shadow-sm"
                                  : lvl === "medium"
                                    ? "bg-warn text-white shadow-sm"
                                    : lvl === "low"
                                      ? "bg-ok text-white shadow-sm"
                                      : "bg-card text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>

                      {/* Corridor Search Bar */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Filter corridor, school or route..."
                          value={hotspotSearchQuery}
                          onChange={(e) => setHotspotSearchQuery(e.target.value)}
                          className="h-7 w-full rounded-md border border-border bg-card pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>

                    {/* Hotspot Cards Scroll List */}
                    <div className="min-h-0 flex-1 overflow-y-auto p-2.5 space-y-2">
                      {filteredHotspots.length === 0 ? (
                        <div className="py-12 text-center text-xs text-muted-foreground">
                          <MapPin className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                          <p className="font-semibold text-foreground">
                            No hotspots match filter
                          </p>
                          <p className="mt-1">
                            Try resetting search query or switching to All density.
                          </p>
                        </div>
                      ) : (
                        filteredHotspots.map((h) => (
                          <SafetyHotspotCard
                            key={h.id}
                            hotspot={h}
                            isSelected={h.id === selectedHotspot?.id}
                            onSelect={(hotspot) => setSelectedHotspot(hotspot)}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* Center Panel: Mapbox GIS Hotspot Canvas */}
                  <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-3 bg-muted/10">
                    <SafetyHotspotMap
                      incidents={allIncidents}
                      selectedHotspotId={selectedHotspot?.id}
                      onSelectHotspot={(h) => setSelectedHotspot(h)}
                      onSelectIncident={(inc) => {
                        handleInspectInVideo(inc);
                      }}
                      className="h-full w-full"
                    />
                  </div>

                  {/* Right Panel: Hotspot Inspector Drawer (when selected) */}
                  {selectedHotspot && (
                    <div className="w-[360px] xl:w-[420px] shrink-0 border-l border-border bg-card flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 shadow-xl">
                      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-muted/20">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Flame className="h-3.5 w-3.5 text-primary" />
                          Corridor Safety Intelligence
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => setSelectedHotspot(null)}
                          aria-label="Close hotspot inspector"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto">
                        <SafetyHotspotInspector
                          hotspot={selectedHotspot}
                          linkedIncidents={allIncidents}
                          onViewIncidentInVideo={(inc) => {
                            handleInspectInVideo(inc);
                          }}
                          onClose={() => setSelectedHotspot(null)}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
