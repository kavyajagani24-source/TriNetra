import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/primitives";
import {
  CONGESTION_TREND,
  DEFECT_TYPES,
  DEPARTMENT_PERFORMANCE,
  FLEET_COVERAGE_TREND,
  RESOLUTION_TREND,
  ROAD_HEALTH_TREND,
} from "@/data/mock";

const axis = { fontSize: 10, fill: "var(--muted-foreground)" };
const tip = { fontSize: 11, borderRadius: 6, border: "1px solid var(--border)" };

export function AnalyticsPage() {
  return (
    <AppShell>
      <PageHeader
        title="City Analytics"
        subtitle="Trends derived from corroborated observations across the fleet."
      />
      <div className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Road health" value="82%" hint="↑ 5 pts vs Aug" tone="ok" />
          <KpiCard label="Defects discovered" value={104} hint="Last 30 days" />
          <KpiCard label="Issues resolved" value={181} tone="ok" />
          <KpiCard label="Verification success" value="88%" tone="ok" />
          <KpiCard label="Fleet coverage" value="82%" tone="info" />
          <KpiCard label="Avg response time" value="38 h" tone="warn" />
        </div>

        <div className="grid gap-2 xl:grid-cols-2">
          <Panel title="Road health trend" description="Health index vs open defects">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ROAD_HEALTH_TREND} margin={{ top: 6, right: 8, bottom: 0, left: -22 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={axis} />
                  <YAxis tick={axis} />
                  <Tooltip contentStyle={tip} />
                  <Line type="monotone" dataKey="health" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="defects" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Congestion trend" description="Network delay by hour of day">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={CONGESTION_TREND} margin={{ top: 6, right: 8, bottom: 0, left: -24 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="hour" tick={axis} />
                  <YAxis tick={axis} />
                  <Tooltip contentStyle={tip} />
                  <Area type="monotone" dataKey="delay" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.16} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Issue resolution" description="Reported vs resolved vs verified per week">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={RESOLUTION_TREND} margin={{ top: 6, right: 8, bottom: 0, left: -22 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week" tick={axis} />
                  <YAxis tick={axis} />
                  <Tooltip contentStyle={tip} />
                  <Bar dataKey="reported" fill="var(--chart-1)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="resolved" fill="var(--chart-2)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="verified" fill="var(--chart-4)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Defect discovery" description="By defect class">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={DEFECT_TYPES} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 34 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={axis} />
                  <YAxis type="category" dataKey="name" tick={{ ...axis, fontSize: 9 }} width={92} />
                  <Tooltip contentStyle={tip} />
                  <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Fleet coverage" description="Share of network surveyed per day">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={FLEET_COVERAGE_TREND} margin={{ top: 6, right: 8, bottom: 0, left: -24 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" tick={axis} />
                  <YAxis tick={axis} domain={[50, 100]} />
                  <Tooltip contentStyle={tip} />
                  <Area type="monotone" dataKey="coverage" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.16} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Department response time" description="Score and median response hours" bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {DEPARTMENT_PERFORMANCE.map((d) => (
                <li key={d.department} className="px-3 py-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-foreground">{d.department}</span>
                    <span className="num text-muted-foreground">
                      {d.responseH} h median · {d.open} open
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${d.score}%` }} />
                    </div>
                    <span className="num text-[11px] font-semibold">{d.score}%</span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
