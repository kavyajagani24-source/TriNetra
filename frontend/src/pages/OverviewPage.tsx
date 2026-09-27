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
  const activeBusesCount = buses.filter((b) => b.status === "active").length + 236;

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
          <div className="rounded-lg border border-[#DCE9E1] bg-white p-4 shadow-[var(--shadow-panel)]">
            <div className="flex items-center justify-between">
              <span className="font-ui text-xs font-semibold uppercase tracking-wider text-[#64736B]">Priority Issues</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-[#FDEAEA] text-[#E27676]">
                <AlertTriangle className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-data text-2xl font-bold text-[#26352E]">{priorityIssuesCount}</span>
              <span className="text-xs font-medium text-[#E27676]">Critical P1</span>
            </div>
            <p className="mt-1 text-[11px] text-[#91A099]">Requires immediate dispatch</p>
          </div>

          <div className="rounded-lg border border-[#DCE9E1] bg-white p-4 shadow-[var(--shadow-panel)]">
            <div className="flex items-center justify-between">
              <span className="font-ui text-xs font-semibold uppercase tracking-wider text-[#64736B]">Active Incidents</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-[#FBF6E3] text-[#E1BE63]">
                <ShieldAlert className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-data text-2xl font-bold text-[#26352E]">{activeIncidentsCount}</span>
              <span className="text-xs font-medium text-[#E1BE63]">Awaiting review</span>
            </div>
            <p className="mt-1 text-[11px] text-[#91A099]">AI candidates needing human operator sign-off</p>
          </div>

          <div className="rounded-lg border border-[#DCE9E1] bg-white p-4 shadow-[var(--shadow-panel)]">
            <div className="flex items-center justify-between">
              <span className="font-ui text-xs font-semibold uppercase tracking-wider text-[#64736B]">Persistent Hotspots</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-[#FDF0E6] text-[#E89A68]">
                <Layers className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-data text-2xl font-bold text-[#26352E]">{persistentHotspotsCount}</span>
              <span className="text-xs font-medium text-[#E89A68]">Recurring</span>
            </div>
            <p className="mt-1 text-[11px] text-[#91A099]">Repeat observations across multiple days</p>
          </div>

          <div className="rounded-lg border border-[#DCE9E1] bg-white p-4 shadow-[var(--shadow-panel)]">
            <div className="flex items-center justify-between">
              <span className="font-ui text-xs font-semibold uppercase tracking-wider text-[#64736B]">Active Buses</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-[#E8F3FA] text-[#72A9C9]">
                <Bus className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-data text-2xl font-bold text-[#26352E]">{activeBusesCount}</span>
              <span className="text-xs font-medium text-[#68C491]">98.4% online</span>
            </div>
            <p className="mt-1 text-[11px] text-[#91A099]">Transmitting camera & GPS telemetry</p>
          </div>
        </div>

        {/* Main Grid: Priority Actions Table & Map Preview */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left Column (7 cols): Priority Actions Table & Activity Feed */}
          <div className="space-y-4 lg:col-span-7">
            {/* Priority Actions Card */}
            <div className="rounded-lg border border-[#DCE9E1] bg-white shadow-[var(--shadow-panel)]">
              <div className="flex items-center justify-between border-b border-[#DCE9E1] px-5 py-3.5">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#26352E]">
                    Priority Actions Required
                  </h2>
                  <p className="text-[11px] text-[#91A099]">
                    High severity issues requiring operational review or department assignment.
                  </p>
                </div>
                <Link
                  to="/action-center"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#4BAF7C] hover:text-[#3F9F70]"
                >
                  View All <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#DCE9E1] bg-[#F7FAF8] text-[11px] font-semibold text-[#64736B] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Priority</th>
                      <th className="px-4 py-2.5">Issue</th>
                      <th className="px-4 py-2.5">Location</th>
                      <th className="px-4 py-2.5">Time</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE9E1] text-[#26352E]">
                    {priorityActions.map((iss) => (
                      <tr key={iss.id} className="hover:bg-[#F7FAF8] transition-colors">
                        <td className="px-4 py-3">
                          <PriorityBadge priority={iss.priority} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-[#26352E] block">{iss.title}</span>
                          <span className="font-mono text-[11px] text-[#91A099]">{iss.id}</span>
                        </td>
                        <td className="px-4 py-3 text-[#64736B]">{iss.road}</td>
                        <td className="px-4 py-3 text-[#91A099] font-mono text-[11px]">
                          {iss.lastObservedLabel}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={iss.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setActiveDrawerIssue(iss)}
                            className="inline-flex items-center gap-1 rounded border border-[#DCE9E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#4BAF7C] hover:bg-[#E4F5EC] transition-colors"
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
            <div className="rounded-lg border border-[#DCE9E1] bg-white p-5 shadow-[var(--shadow-panel)]">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#26352E] flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-[#4BAF7C]" />
                Live Command Center Activity Stream
              </h2>
              <div className="space-y-3">
                {recentActivityFeed.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 border-l-2 border-[#9BD8B8] pl-3 py-0.5">
                    <span className="font-mono text-[11px] font-semibold text-[#91A099] shrink-0 mt-0.5">
                      {item.time}
                    </span>
                    <p className="text-xs text-[#26352E] font-medium">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): City Situation Map Preview */}
          <div className="lg:col-span-5">
            <div className="flex h-full min-h-[500px] flex-col rounded-lg border border-[#DCE9E1] bg-white shadow-[var(--shadow-panel)] overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#DCE9E1] px-4 py-3">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#26352E]">
                    City Situation Map Preview
                  </h2>
                  <p className="text-[11px] text-[#91A099]">
                    Live Mapbox vector layer displaying issues, incidents, and congestion.
                  </p>
                </div>
                <Link
                  to="/city-map"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#4BAF7C] hover:text-[#3F9F70]"
                >
                  Full Map <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

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

      <IssueDetailDrawer
        issue={activeDrawerIssue}
        onClose={() => setActiveDrawerIssue(null)}
      />
    </AppShell>
  );
}
