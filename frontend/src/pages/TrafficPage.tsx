import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/primitives";
import { MapView } from "@/components/maps/MapView";
import { CONGESTION_TREND, CORRIDORS } from "@/data/mock";
import { useStore } from "@/state/app-store";
import { cn } from "@/lib/utils";

const LEVEL_STYLE: Record<string, string> = {
  low: "bg-ok-soft text-ok",
  moderate: "bg-warn-soft text-[oklch(0.5_0.12_75)]",
  high: "bg-major-soft text-major",
  severe: "bg-critical-soft text-critical",
};

export function TrafficPage() {
  const { issues, buses, layers } = useStore();
  const trafficIssues = issues.filter((i) => i.category === "traffic" || i.category === "incident");

  return (
    <AppShell>
      <PageHeader
        title="Traffic Intelligence"
        subtitle="Vehicle density, corridor delay and fleet-derived speed profiles."
      />
      <div className="grid gap-2 border-b border-border p-2 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Vehicles detected" value="18,421" hint="Last 24 h" />
        <KpiCard label="Active congestion corridors" value={3} tone="warn" />
        <KpiCard label="Severe corridors" value={1} tone="critical" />
        <KpiCard label="Average route delay" value="+14 min" tone="warn" />
        <KpiCard label="Fleet coverage" value="82%" tone="ok" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <div className="relative min-h-[380px] flex-1">
          <MapView
            issues={trafficIssues}
            buses={buses}
            layers={{ ...layers, heatmap: true, defects: false }}
            showRoutes
            className="h-full w-full"
          />
        </div>

        <div className="scroll-thin w-full shrink-0 space-y-2 overflow-y-auto border-l border-border bg-background p-2 xl:w-[400px]">
          <Panel title="Traffic flow" description="Corridors by current flow state">
            <div className="grid grid-cols-4 gap-1.5">
              {(["low", "moderate", "high", "severe"] as const).map((l) => (
                <div
                  key={l}
                  className={cn("rounded px-2 py-1.5 text-center", LEVEL_STYLE[l])}
                >
                  <p className="num text-[15px] font-semibold">
                    {CORRIDORS.filter((c) => c.level === l).length}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide">{l}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Congestion trend" description="Average network delay by hour">
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={CONGESTION_TREND} margin={{ top: 4, right: 6, bottom: 0, left: -24 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                  <Area
                    type="monotone"
                    dataKey="delay"
                    stroke="var(--chart-1)"
                    fill="var(--chart-1)"
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Top congestion corridors" bodyClassName="p-0">
            <ol className="divide-y divide-border">
              {CORRIDORS.map((c, idx) => {
                const TrendIcon =
                  c.trend === "up" ? ArrowUpRight : c.trend === "down" ? ArrowDownRight : Minus;
                return (
                  <li key={c.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 px-3 py-2">
                    <span className="num text-[12px] font-semibold text-muted-foreground">
                      {idx + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-medium text-foreground">
                        {c.name}
                      </span>
                      <span className="num block truncate text-[11px] text-muted-foreground">
                        Avg {c.avgSpeed} km/h · now {c.currentSpeed} km/h · +{c.delayMin} min
                      </span>
                    </span>
                    <span
                      className={cn(
                        "inline-flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-semibold uppercase",
                        LEVEL_STYLE[c.level],
                      )}
                    >
                      <TrendIcon className="h-3 w-3" aria-hidden />
                      {c.level}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
