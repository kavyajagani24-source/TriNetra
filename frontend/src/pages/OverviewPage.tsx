import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bus,
  CheckCircle2,
  Clock,
  Eye,
  Layers,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { MapView } from "@/components/maps/MapView";
import { PriorityBadge, StatusBadge } from "@/components/common/badges";
import { IssueDetailDrawer } from "@/components/issues/IssueDetailDrawer";
import { useStore } from "@/state/app-store";
import type { Issue } from "@/types";

export function OverviewPage() {
  const { issues, buses, incidents, layers, selectedIssueId, selectIssue } = useStore();
  const [activeDrawerIssue, setActiveDrawerIssue] = useState<Issue | null>(null);

  // KPIs
  const priorityIssuesCount = issues.filter((i) => i.priority === "P1" && i.status !== "resolved").length;
  const activeIncidentsCount = incidents.filter((inc) => inc.status !== "closed").length;
  const persistentHotspotsCount = issues.filter((i) => i.persistent).length;
  const activeBusesCount = buses.filter((b) => b.status === "active").length + 236; // 248 total

  const priorityActions = issues.filter((i) => i.status !== "resolved").slice(0, 5);

  const recentActivityFeed = [
    { id: "act-1", time: "10:44 AM", text: "Pothole P-184 corroborated by BUS-042 (Observation #37)", type: "corroborated" },
    { id: "act-2", time: "10:32 AM", text: "Incident candidate INC-118 (Rash Driving) generated on WEH", type: "incident" },
    { id: "act-3", time: "10:15 AM", text: "Waterlogging P-186 assigned to Sanitation Zone 2", type: "assigned" },
    { id: "act-4", time: "09:58 AM", text: "Pedestrian Hazard P-195 detected near School Zone, Chembur", type: "detection" },
    { id: "act-5", time: "09:12 AM", text: "Issue P-211 marked Resolved following verification pass", type: "resolved" },
  ];

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Top KPI Cards Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Priority Issues</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-rose-50 text-rose-600">
                <AlertTriangle className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">{priorityIssuesCount}</span>
              <span className="text-xs font-medium text-rose-600">Critical P1</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Requires immediate dispatch</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Incidents</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-amber-50 text-amber-600">
                <ShieldAlert className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">{activeIncidentsCount}</span>
              <span className="text-xs font-medium text-amber-600">Awaiting review</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">AI candidates needing human operator sign-off</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Persistent Hotspots</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-purple-50 text-purple-600">
                <Layers className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">{persistentHotspotsCount}</span>
              <span className="text-xs font-medium text-purple-600">Recurring</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Repeat observations across multiple days</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Buses</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-blue-50 text-blue-600">
                <Bus className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">{activeBusesCount}</span>
              <span className="text-xs font-medium text-emerald-600">98.4% online</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Transmitting camera & GPS telemetry</p>
          </div>
        </div>

        {/* Main Grid: Priority Actions Table & Map Preview */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left Column (7 cols): Priority Actions Table & Activity Feed */}
          <div className="space-y-4 lg:col-span-7">
            {/* Priority Actions Card */}
            <div className="rounded-lg border border-slate-200 bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Priority Actions Required
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    High severity issues requiring operational review or department assignment.
                  </p>
                </div>
                <Link
                  to="/action-center"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                >
                  View All <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Priority</th>
                      <th className="px-4 py-2.5">Issue</th>
                      <th className="px-4 py-2.5">Location</th>
                      <th className="px-4 py-2.5">Time</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {priorityActions.map((iss) => (
                      <tr key={iss.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <PriorityBadge priority={iss.priority} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-900 block">{iss.title}</span>
                          <span className="font-mono text-[11px] text-slate-400">{iss.id}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{iss.road}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                          {iss.lastObservedLabel}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={iss.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setActiveDrawerIssue(iss)}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            <Eye className="h-3 w-3" />
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Activity Feed */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-blue-600" />
                Live Command Center Activity Stream
              </h2>
              <div className="space-y-3">
                {recentActivityFeed.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 border-l-2 border-blue-500 pl-3 py-0.5">
                    <span className="font-mono text-[11px] font-semibold text-slate-500 shrink-0 mt-0.5">
                      {item.time}
                    </span>
                    <p className="text-xs text-slate-800 font-medium">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): City Situation Map Preview */}
          <div className="lg:col-span-5">
            <div className="flex h-full min-h-[500px] flex-col rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    City Situation Map Preview
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Live Mapbox vector layer displaying issues, incidents, and congestion.
                  </p>
                </div>
                <Link
                  to="/city-map"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                >
                  Full Map <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Reused Mapbox Implementation */}
              <div className="relative flex-1 min-h-[420px]">
                <MapView
                  issues={issues}
                  buses={buses}
                  layers={layers}
                  selectedIssueId={selectedIssueId}
                  onSelectIssue={(id) => {
                    const found = issues.find((i) => i.id === id);
                    if (found) setActiveDrawerIssue(found);
                  }}
                  className="h-full w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Shared Issue Detail Drawer */}
      <IssueDetailDrawer
        issue={activeDrawerIssue}
        onClose={() => setActiveDrawerIssue(null)}
      />
    </AppShell>
  );
}
