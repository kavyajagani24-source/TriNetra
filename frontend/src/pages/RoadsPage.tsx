import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { Donut, KpiCard, PageHeader, Panel } from "@/components/common/primitives";
import { MapLegend, MapView } from "@/components/maps/MapView";
import { IssueDetailsPanel } from "@/components/issues/IssueDetailsPanel";
import { DEFECT_TYPES, ROAD_HEALTH_LEVELS } from "@/data/mock";
import { SURVEYED_DISTANCE_KM } from "@/data/geo";
import { useStore } from "@/state/app-store";

const ROAD_CATEGORIES = new Set([
  "pothole",
  "crack",
  "missing_divider",
  "zebra_crossing",
  "traffic_sign",
  "waterlogging",
  "debris",
]);

export function RoadsPage() {
  const { issues, layers, selectedIssueId, selectIssue } = useStore();
  const roadIssues = useMemo(
    () => issues.filter((i) => ROAD_CATEGORIES.has(i.category)),
    [issues],
  );
  const selected = issues.find((i) => i.id === selectedIssueId) ?? null;

  return (
    <AppShell>
      <PageHeader
        title="Road Intelligence"
        subtitle="Surface condition derived from repeated bus-camera passes."
      />
      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <div className="relative min-h-[380px] flex-1">
          <MapView
            issues={roadIssues}
            layers={{ ...layers, traffic: false, incidents: false, buses: false }}
            selectedIssueId={selectedIssueId}
            onSelectIssue={selectIssue}
            className="h-full w-full"
            overlay={<MapLegend className="absolute bottom-2 left-2 z-10" />}
          />
        </div>

        <div className="scroll-thin w-full shrink-0 space-y-2 overflow-y-auto border-l border-border bg-background p-2 xl:w-[420px]">
          <div className="grid grid-cols-2 gap-2">
            <KpiCard label="Total distance surveyed" value={`${SURVEYED_DISTANCE_KM} km`} />
            <KpiCard label="Road defects" value={roadIssues.length} tone="warn" />
            <KpiCard
              label="Major defects"
              value={roadIssues.filter((i) => i.severity === "major" || i.severity === "critical").length}
              tone="critical"
            />
            <KpiCard
              label="Persistent defects"
              value={roadIssues.filter((i) => i.persistent).length}
              tone="warn"
            />
            <KpiCard
              label="Active DLP issues"
              value={roadIssues.filter((i) => i.contractorId).length}
              hint="Contractor warranty"
              tone="info"
            />
            <KpiCard label="Segments surveyed" value={ROAD_HEALTH_LEVELS.length * 92} />
          </div>

          <Panel title="Road Health Distribution" description="Share of surveyed network by condition level">
            <ul className="space-y-2">
              {ROAD_HEALTH_LEVELS.map((l) => (
                <li key={l.level} className="flex items-center gap-3">
                  <Donut value={l.pct} label={`${l.level} ${l.pct}%`} color={l.color} />
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-foreground">
                      {l.level} · {l.label}
                    </p>
                    <p className="num truncate text-[11px] text-muted-foreground">
                      Total distance: {l.km} km
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Defect Types" description="Detected across the surveyed network">
            <div className="h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={DEFECT_TYPES} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                    interval={0}
                    angle={-22}
                    textAnchor="end"
                    height={44}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                  <Bar dataKey="count" fill="var(--chart-1)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="major" fill="var(--chart-3)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        {selected ? (
          <IssueDetailsPanel
            issue={selected}
            onClose={() => selectIssue(null)}
            className="w-full shrink-0 xl:w-[400px]"
          />
        ) : null}
      </div>
    </AppShell>
  );
}
