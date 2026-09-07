import { useMemo } from "react";
import {
  Activity,
  Bus,
  CloudRain,
  Layers,
  ShieldAlert,
  TrafficCone,
  TriangleAlert,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/primitives";
import { MapLegend, MapView } from "@/components/maps/MapView";
import { MapFilterPanel, MapToolbar } from "@/components/maps/MapControls";
import { IssueDetailsPanel } from "@/components/issues/IssueDetailsPanel";
import { TriageFunnel } from "@/components/workflow/pieces";
import { PriorityBadge, StatusBadge } from "@/components/common/badges";
import { filterIssues, useStore } from "@/state/app-store";

export function OverviewPage() {
  const {
    issues,
    buses,
    layers,
    toggleLayer,
    filters,
    setFilters,
    selectedIssueId,
    selectIssue,
  } = useStore();

  const visible = useMemo(() => filterIssues(issues, filters), [issues, filters]);
  const selected = issues.find((i) => i.id === selectedIssueId) ?? null;

  const kpis = [
    {
      label: "Active buses",
      value: buses.filter((b) => b.status !== "offline").length + 236,
      hint: `${buses.filter((b) => b.gps === "connected").length + 223} transmitting`,
      icon: Bus,
      tone: "ok" as const,
    },
    {
      label: "Priority issues",
      value: issues.filter((i) => i.priority === "P1" && i.status !== "resolved").length,
      hint: "↑ 3 today",
      icon: TriangleAlert,
      tone: "critical" as const,
    },
    {
      label: "Persistent issues",
      value: issues.filter((i) => i.persistent).length,
      hint: "Repeat observations",
      icon: Layers,
      tone: "warn" as const,
    },
    {
      label: "Waterlogging hotspots",
      value: issues.filter((i) => i.category === "waterlogging").length,
      hint: "Monsoon watch",
      icon: CloudRain,
      tone: "info" as const,
    },
    {
      label: "Congestion corridors",
      value: 3,
      hint: "1 severe",
      icon: TrafficCone,
      tone: "warn" as const,
    },
    {
      label: "Incidents requiring review",
      value: issues.filter((i) => i.category === "incident").length,
      hint: "Human review required",
      icon: ShieldAlert,
      tone: "critical" as const,
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Urban Intelligence Overview"
        subtitle="Real-time intelligence generated from the public transport fleet."
        actions={
          <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground md:inline-flex">
            <Activity className="h-3.5 w-3.5 text-ok" aria-hidden />
            Ingest healthy · 2,437 observations today
          </span>
        }
      />

      <div className="grid gap-2 border-b border-border bg-background p-2 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-[420px] flex-1">
          <MapView
            issues={visible}
            buses={buses}
            layers={layers}
            selectedIssueId={selectedIssueId}
            onSelectIssue={selectIssue}
            className="h-full w-full"
            overlay={
              <>
                <MapToolbar
                  layers={layers}
                  onToggle={toggleLayer}
                  className="absolute left-2 top-2 z-10 w-[150px]"
                />
                <MapFilterPanel
                  filters={filters}
                  onChange={setFilters}
                  className="absolute left-2 top-[214px] z-10 max-h-[calc(100%-240px)]"
                />
                <MapLegend className="absolute bottom-2 left-2 z-10" />
              </>
            }
          />
        </div>

        {selected ? (
          <IssueDetailsPanel
            issue={selected}
            onClose={() => selectIssue(null)}
            className="w-full shrink-0 lg:w-[400px]"
          />
        ) : (
          <div className="scroll-thin w-full shrink-0 space-y-2 overflow-y-auto border-l border-border bg-background p-2 lg:w-[340px]">
            <Panel title="Intelligence Triage" description="Observation → priority action">
              <TriageFunnel />
            </Panel>
            <Panel
              title="Today's Priority"
              description="Select an issue to open its evidence package"
              bodyClassName="p-0"
            >
              <ul className="divide-y divide-border">
                {issues
                  .filter((i) => i.status !== "resolved")
                  .slice(0, 6)
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
          </div>
        )}
      </div>
    </AppShell>
  );
}
