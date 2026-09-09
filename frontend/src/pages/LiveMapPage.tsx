import { useMemo, useState } from "react";
import {
  Activity,
  Bus,
  Clock,
  Layers,
  MapPin,
  Maximize2,
  Navigation,
  Radio,
  Route as RouteIcon,
  Search,
  Sparkles,
  TriangleAlert,
  Wifi,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, Panel, MetaRow } from "@/components/common/primitives";
import { MapLegend, MapView } from "@/components/maps/MapView";
import { MapFilterPanel, MapToolbar } from "@/components/maps/MapControls";
import { IssueDetailsPanel } from "@/components/issues/IssueDetailsPanel";
import { PriorityBadge, StatusBadge } from "@/components/common/badges";
import { filterIssues, useStore } from "@/state/app-store";
import { BUS_ROUTES } from "@/data/geo";
import { cn } from "@/lib/utils";

export function LiveMapPage() {
  const {
    issues,
    buses,
    layers,
    toggleLayer,
    filters,
    setFilters,
    selectedIssueId,
    selectIssue,
    selectedBusId,
    selectBus,
  } = useStore();

  const [sidePanelOpen, setSidePanelOpen] = useState(true);

  // Apply active filters to issues
  const visibleIssues = useMemo(() => filterIssues(issues, filters), [issues, filters]);
  const selectedIssue = issues.find((i) => i.id === selectedIssueId) ?? null;
  const selectedBus = buses.find((b) => b.id === selectedBusId) ?? null;

  // Filter buses if a route is selected
  const visibleBuses = useMemo(() => {
    if (!filters.route || filters.route === "all") return buses;
    return buses.filter((b) => b.route === filters.route);
  }, [buses, filters.route]);

  const activeBusCount = buses.filter((b) => b.status !== "offline").length + 236;
  const transmittingGpsCount = buses.filter((b) => b.gps === "connected").length + 223;

  return (
    <AppShell>
      <PageHeader
        title="Live GIS & Transit Route Command Center"
        subtitle="Real-time municipal telemetry, bus fleet positioning, corridor hazards, and live road conditions."
        actions={
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground md:inline-flex">
              <Radio className="h-3 w-3 text-ok animate-pulse" aria-hidden />
              <span>{transmittingGpsCount} GPS Transmitting</span>
            </span>
            <span className="hidden items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground sm:inline-flex">
              <RouteIcon className="h-3 w-3 text-primary" aria-hidden />
              <span>{BUS_ROUTES.length} Routes Monitored</span>
            </span>
            <button
              onClick={() => setSidePanelOpen((o) => !o)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                sidePanelOpen
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
              aria-label="Toggle telemetry panel"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{sidePanelOpen ? "Hide Panel" : "Show Panel"}</span>
            </button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Main Dashboard Map View */}
        <div className="relative min-h-[450px] flex-1">
          <MapView
            issues={visibleIssues}
            buses={visibleBuses}
            layers={layers}
            selectedIssueId={selectedIssueId}
            onSelectIssue={(id) => {
              selectBus(null);
              selectIssue(id);
            }}
            selectedBusId={selectedBusId}
            onSelectBus={(id) => {
              selectIssue(null);
              selectBus(id);
            }}
            showRoutes={layers.routes ?? true}
            className="h-full w-full"
            overlay={
              <>
                <MapToolbar
                  layers={layers}
                  onToggle={toggleLayer}
                  className="absolute left-3 top-3 z-10 w-[155px]"
                />
                <MapFilterPanel
                  filters={filters}
                  onChange={setFilters}
                  className="absolute left-3 top-[250px] z-10 max-h-[calc(100%-270px)]"
                />
                <MapLegend className="absolute bottom-3 left-3 z-10" />

                {/* Active Route Filter Chip (if active) */}
                {filters.route && filters.route !== "all" && (
                  <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-md border border-primary/40 bg-card/90 px-3 py-1.5 shadow-lg backdrop-blur text-xs">
                    <span className="flex items-center gap-1 font-semibold text-primary">
                      <RouteIcon className="h-3.5 w-3.5" />
                      Filtered by Route {filters.route}
                    </span>
                    <button
                      onClick={() => setFilters({ ...filters, route: "all" })}
                      className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      title="Clear route filter"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </>
            }
          />
        </div>

        {/* Dynamic Context Panel */}
        {sidePanelOpen && (
          <div className="scroll-thin w-full shrink-0 space-y-2 overflow-y-auto border-t lg:border-t-0 lg:border-l border-border bg-background p-2.5 lg:w-[380px]">
            {selectedIssue ? (
              <IssueDetailsPanel
                issue={selectedIssue}
                onClose={() => selectIssue(null)}
                className="w-full"
              />
            ) : selectedBus ? (
              <Panel
                title={`${selectedBus.id} · Route ${selectedBus.route}`}
                description={selectedBus.operator}
                action={
                  <button
                    onClick={() => selectBus(null)}
                    className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    aria-label="Close bus details"
                  >
                    <X className="h-4 w-4" />
                  </button>
                }
              >
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between rounded bg-secondary/50 p-2 text-xs">
                    <span className="text-muted-foreground">Status</span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                        selectedBus.status === "active"
                          ? "bg-ok-soft text-ok"
                          : selectedBus.status === "idle"
                          ? "bg-warn-soft text-[oklch(0.5_0.12_75)]"
                          : "bg-critical-soft text-critical"
                      )}
                    >
                      {selectedBus.status}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <MetaRow label="Speed" value={`${selectedBus.speedKph} km/h`} />
                    <MetaRow label="Heading" value={`${selectedBus.headingDeg}°`} />
                    <MetaRow label="GPS Accuracy" value={`${selectedBus.accuracyM} m`} />
                    <MetaRow label="Connection" value={selectedBus.bandwidth} />
                    <MetaRow
                      label="Cameras"
                      value={`${selectedBus.camerasOnline}/${selectedBus.camerasTotal} online`}
                    />
                    <MetaRow label="Last Packet" value={selectedBus.lastPacket} />
                  </dl>

                  <div className="pt-2 border-t border-border">
                    <p className="label-xs mb-1.5 text-muted-foreground">Recent Detections</p>
                    <ul className="divide-y divide-border rounded border border-border text-xs">
                      {selectedBus.recentObservations.map((o) => (
                        <li key={o.type} className="flex items-center justify-between px-2.5 py-1.5">
                          <span className="font-medium text-foreground">{o.type}</span>
                          <span className="num text-[11px] text-muted-foreground">
                            {o.at} · {Math.round(o.confidence * 100)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Panel>
            ) : (
              <>
                {/* Transit Routes Directory */}
                <Panel
                  title="Monitored Transit Corridors"
                  description="Click a route to filter map and focus telemetry"
                >
                  <div className="space-y-1.5 pt-1">
                    {BUS_ROUTES.map((route) => {
                      const isSelected = filters.route === route.id;
                      return (
                        <button
                          key={route.id}
                          onClick={() => {
                            setFilters({
                              ...filters,
                              route: isSelected ? "all" : route.id,
                            });
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-md border p-2 text-left text-xs transition-all",
                            isSelected
                              ? "border-primary bg-primary/10 shadow-sm"
                              : "border-border bg-card/60 hover:bg-secondary/70"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                {route.id}
                              </span>
                              <span className="truncate font-medium text-foreground">
                                {route.name.split("·")[1]?.trim() || route.name}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span>Coverage: {route.coverage}%</span>
                              <span>·</span>
                              <span className={route.delayMin > 10 ? "text-warn" : "text-ok"}>
                                Delay: +{route.delayMin}m
                              </span>
                            </div>
                          </div>
                          <RouteIcon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isSelected ? "text-primary" : "text-muted-foreground"
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                </Panel>

                {/* Active Priority Events */}
                <Panel
                  title="Geospatial Alerts"
                  description="Click any hazard to inspect on map"
                  bodyClassName="p-0"
                >
                  <ul className="divide-y divide-border">
                    {visibleIssues
                      .filter((i) => i.status !== "resolved")
                      .slice(0, 5)
                      .map((i) => (
                        <li key={i.id}>
                          <button
                            onClick={() => selectIssue(i.id)}
                            className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2 px-3 py-2 text-left hover:bg-secondary/60"
                          >
                            <PriorityBadge priority={i.priority} />
                            <span className="min-w-0">
                              <span className="block truncate text-[12px] font-medium text-foreground">
                                {i.title} — {i.road}
                              </span>
                              <span className="mt-0.5 flex items-center gap-1.5">
                                <StatusBadge status={i.status} />
                                <span className="num text-[11px] text-muted-foreground">
                                  {i.busCount} buses · {Math.round(i.confidence * 100)}%
                                </span>
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                  </ul>
                </Panel>
              </>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
