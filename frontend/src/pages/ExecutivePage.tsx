import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Building2, TrendingUp } from "lucide-react";
import { ResponsiveContainer, Line, LineChart, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/primitives";
import { MapView } from "@/components/maps/MapView";
import { DEPARTMENT_PERFORMANCE, ROAD_HEALTH_TREND } from "@/data/mock";
import { Button } from "@/components/ui/button";
import { useStore } from "@/state/app-store";

const WARDS = [
  { ward: "Ward 34 · Indiranagar", score: 91, open: 4 },
  { ward: "Ward 12 · Koramangala", score: 84, open: 9 },
  { ward: "Ward 41 · Whitefield", score: 78, open: 13 },
  { ward: "Ward 07 · Hebbal", score: 74, open: 15 },
  { ward: "Ward 22 · Bommanahalli", score: 66, open: 21 },
];

export function ExecutivePage() {
  const { issues, layers } = useStore();

  return (
    <AppShell>
      <PageHeader
        title="Executive Summary"
        subtitle="City-level outcomes for the Commissioner's review — September 2026"
        actions={
          <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
            <Link to="/analytics">
              Detailed analytics
              <ArrowUpRight className="ml-1 h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        }
      />

      <div className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="City road health index" value="82 / 100" hint="↑ 5 pts this quarter" tone="ok" icon={TrendingUp} />
          <KpiCard label="Issues resolved this month" value={181} hint="88% verified by re-observation" tone="ok" />
          <KpiCard label="Median response time" value="38 h" hint="Target 48 h" tone="info" />
          <KpiCard label="Network under active DLP" value="19%" hint="Contractor liability tracked" icon={Building2} tone="warn" />
        </div>

        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Panel title="Citywide condition" description="Aggregated road condition and open issues" bodyClassName="p-0">
            <div className="h-[340px]">
              <MapView
                issues={issues}
                layers={{ ...layers, buses: false, incidents: false }}
                className="h-full w-full"
              />
            </div>
          </Panel>

          <div className="space-y-2">
            <Panel title="Ward performance" bodyClassName="p-0">
              <ul className="divide-y divide-border">
                {WARDS.map((w) => (
                  <li key={w.ward} className="px-3 py-2">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="truncate text-foreground">{w.ward}</span>
                      <span className="num text-muted-foreground">{w.open} open</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
                        <div className="h-full bg-primary" style={{ width: `${w.score}%` }} />
                      </div>
                      <span className="num text-[11px] font-semibold">{w.score}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Health trajectory">
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ROAD_HEALTH_TREND} margin={{ top: 6, right: 8, bottom: 0, left: -24 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                    <Line type="monotone" dataKey="health" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>
        </div>

        <div className="grid gap-2 xl:grid-cols-2">
          <Panel title="Department accountability" bodyClassName="p-0">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="label-xs">
                  <th className="border-b border-border px-3 py-2">Department</th>
                  <th className="border-b border-border px-3 py-2">Open</th>
                  <th className="border-b border-border px-3 py-2">Median response</th>
                  <th className="border-b border-border px-3 py-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {DEPARTMENT_PERFORMANCE.map((d) => (
                  <tr key={d.department} className="border-b border-border">
                    <td className="px-3 py-2 text-foreground">{d.department}</td>
                    <td className="num px-3 py-2">{d.open}</td>
                    <td className="num px-3 py-2">{d.responseH} h</td>
                    <td className="num px-3 py-2 font-semibold">{d.score}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="What the platform claims — and does not" description="Positioning for public accountability">
            <ul className="space-y-2 text-[12px] leading-relaxed text-foreground">
              <li>
                <strong>Claims:</strong> continuous, low-cost sensing of the road network using
                buses already in service; corroborated evidence for every reported defect; auditable
                verification that a repair actually held.
              </li>
              <li>
                <strong>Does not claim:</strong> automated enforcement. Incident detections are
                review proposals only; a human officer decides.
              </li>
              <li>
                <strong>Privacy:</strong> faces and number plates are blurred on-device before any
                frame leaves the vehicle; raw footage is never retained centrally.
              </li>
              <li>
                <strong>Coverage honesty:</strong> streets without bus service are shown as
                unsurveyed rather than assumed healthy.
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
