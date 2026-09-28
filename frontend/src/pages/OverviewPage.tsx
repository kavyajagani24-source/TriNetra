import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
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
  Shield,
  ShieldAlert,
  Sparkles,
  Video,
  Wrench,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MapView } from "@/components/maps/MapView";
import { PriorityBadge, StatusBadge } from "@/components/common/badges";
import { useStore } from "@/state/app-store";
import { getIncidentAlerts } from "@/services/api/incident";
import type { IncidentAlertSummary } from "@/services/api/incident";
import type { Issue } from "@/types";

export function OverviewPage() {
  const {
    issues,
    buses,
    incidents,
    layers,
    selectedIssueId,
    selectIssue,
    demoMode,
    toggleDemoMode,
  } = useStore();
  const [activeDrawerIssue, setActiveDrawerIssue] = useState<Issue | null>(null);
  const [liveAlerts, setLiveAlerts] = useState<IncidentAlertSummary[]>([]);

  useEffect(() => {
    getIncidentAlerts()
      .then((data) => setLiveAlerts(data))
      .catch((err) => console.warn("Could not load overview incident alerts:", err));
  }, []);

  // Honest KPIs
  const priorityIssuesCount = issues.filter((i) => i.priority === "P1" && i.status !== "resolved").length;
  const activeIncidentsCount = (incidents.filter((inc) => inc.status !== "closed").length) + (demoMode ? 0 : liveAlerts.length);
  const persistentHotspotsCount = issues.filter((i) => i.persistent).length;
  const activeBusesCount = buses.filter((b) => b.status === "active").length;

  const priorityActions = issues.filter((i) => i.status !== "resolved").slice(0, 5);

  // Honest dynamic activity stream
  const recentActivityFeed = [
    ...liveAlerts.slice(0, 3).map((a) => ({
      id: `live-${a.incident_id || a.run_id}`,
      time: a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : "Recent",
      text: `${a.collision_detected ? "🚨 Collision Candidate" : "⚠️ Incident Candidate"} ${a.incident_id || a.run_id} detected (Score: ${Math.round((a.confidence || 0.88) * 100)}%)`,
      type: "incident",
      isLive: true,
    })),
    ...issues.slice(0, 4).map((iss) => ({
      id: `iss-${iss.id}`,
      time: iss.lastObservedLabel || "Recent",
      text: `${iss.title} (${iss.id}) identified at ${iss.road}`,
      type: "defect",
      isLive: !demoMode,
    })),
  ];

  const hasIntelligence = issues.length > 0 || liveAlerts.length > 0 || incidents.length > 0;

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Zero Data State Banner if Live Mode has no runs yet */}
        {!demoMode && !hasIntelligence && (
          <div className="rounded-xl border border-dashed border-border bg-card/60 p-7 text-center space-y-3.5 shadow-xs">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary mx-auto">
              <Video className="h-6 w-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="font-display font-bold text-base text-foreground">No Live Video Intelligence Ingested</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Upload dashcam or bus transit footage into the Video Processing workspace. The multi-module pipeline will run Road, Traffic, Safety, and Incident neural models to generate live situational intelligence.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-1">
              <Link
                to="/videos"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all cursor-pointer"
              >
                <Video className="h-4 w-4" /> Go to Video Processing
              </Link>
              <button
                onClick={toggleDemoMode}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/60 px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-all cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-amber-500" /> Explore Demo Benchmark
              </button>
            </div>
          </div>
        )}

        {/* AI Quick Navigation & Status Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Link
            to="/roads"
            className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-muted/50 transition-all group shadow-xs"
          >
            <div className="p-2 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500/20">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-xs text-foreground block truncate">Road & Pothole AI</span>
              <span className="text-[10px] text-muted-foreground">YOLOv12s RDD2022</span>
            </div>
          </Link>

          <Link
            to="/traffic"
            className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-muted/50 transition-all group shadow-xs"
          >
            <div className="p-2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20">
              <Activity className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-xs text-foreground block truncate">Traffic Flow AI</span>
              <span className="text-[10px] text-muted-foreground">YOLO11x + DIoU Tracker</span>
            </div>
          </Link>

          <Link
            to="/safety"
            className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-muted/50 transition-all group shadow-xs"
          >
            <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20">
              <Shield className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-xs text-foreground block truncate">Safety Intelligence</span>
              <span className="text-[10px] text-muted-foreground">Pedestrians & Near-Miss</span>
            </div>
          </Link>

          <Link
            to="/incidents"
            className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-card hover:border-rose-400/50 hover:bg-muted/50 transition-all group shadow-xs"
          >
            <div className="p-2 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500/20">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-xs text-foreground block truncate">Incident & ANPR AI</span>
              <span className="text-[10px] text-muted-foreground">9-Stage Fusion Engine</span>
            </div>
          </Link>
        </div>

        {/* Top KPI Cards Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-ui text-xs font-semibold uppercase tracking-wider text-muted-foreground">Priority Issues</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-destructive/10 text-destructive">
                <AlertTriangle className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-data text-2xl font-bold text-foreground">{priorityIssuesCount}</span>
              <span className="text-xs font-medium text-destructive">Critical P1</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {priorityIssuesCount > 0 ? "Requires municipal dispatch" : "All critical corridors cleared"}
            </p>
          </div>

          <Link
            to="/incidents"
            className="rounded-lg border border-border bg-card p-4 shadow-sm hover:border-amber-400/60 transition-all block group"
          >
            <div className="flex items-center justify-between">
              <span className="font-ui text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Incidents</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                <ShieldAlert className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-data text-2xl font-bold text-foreground">{activeIncidentsCount}</span>
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Awaiting review</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {liveAlerts.length > 0 ? `${liveAlerts.length} live AI runs awaiting review` : "AI candidates needing review"}
            </p>
          </Link>

          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-ui text-xs font-semibold uppercase tracking-wider text-muted-foreground">Persistent Hotspots</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-poor/10 text-poor">
                <Layers className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-data text-2xl font-bold text-foreground">{persistentHotspotsCount}</span>
              <span className="text-xs font-medium text-poor">Corroborated</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Multi-pass confirmed defects</p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-ui text-xs font-semibold uppercase tracking-wider text-muted-foreground">Transit Sensing Fleet</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-info/10 text-info">
                <Bus className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-data text-2xl font-bold text-foreground">{activeBusesCount}</span>
              <span className="text-xs font-medium text-ok">
                {buses.length > 0 ? `${Math.round((activeBusesCount / buses.length) * 100)}% connected` : "No fleet linked"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Buses actively streaming telemetry</p>
          </div>
        </div>

        {/* Main Content 2-Column Grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left Column (7 cols): Priority Actions Table & Recent Activity */}
          <div className="space-y-4 lg:col-span-7">
            {/* Priority Actions */}
            <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/40">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Priority Actions Required
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    High severity issues requiring operational review or department assignment.
                  </p>
                </div>
                <Link
                  to="/action-center"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  View All <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {priorityActions.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  <CheckCircle2 className="h-6 w-6 text-ok mx-auto mb-2 opacity-80" />
                  <p className="font-semibold text-foreground">No Pending Actions</p>
                  <p className="text-[11px] mt-0.5">All monitored road corridors and safety zones are within acceptable thresholds.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-2.5">Priority</th>
                        <th className="px-4 py-2.5">Issue</th>
                        <th className="px-4 py-2.5">Location</th>
                        <th className="px-4 py-2.5">Time</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-foreground">
                      {priorityActions.map((iss) => (
                        <tr key={iss.id} className="hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3">
                            <PriorityBadge priority={iss.priority} />
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-foreground block">{iss.title}</span>
                            <span className="font-mono text-[11px] text-muted-foreground">{iss.id}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{iss.road}</td>
                          <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">
                            {iss.lastObservedLabel}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={iss.status} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setActiveDrawerIssue(iss)}
                              className="inline-flex items-center gap-1 rounded border border-border bg-card px-2.5 py-1 text-xs font-semibold text-primary hover:bg-muted transition-colors cursor-pointer"
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
              )}
            </div>

            {/* Live Command Center Activity Feed */}
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Command Center Activity Stream
                </h2>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {demoMode ? "Demo Mode Feed" : "Live Telemetry Feed"}
                </span>
              </div>
              <div className="space-y-2.5">
                {recentActivityFeed.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">No activity entries recorded yet.</p>
                ) : (
                  recentActivityFeed.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 border-l-2 pl-3 py-1 ${
                        item.isLive ? "border-destructive bg-destructive/5 rounded-r" : "border-primary/40"
                      }`}
                    >
                      <span className="font-mono text-[11px] font-semibold text-muted-foreground shrink-0 mt-0.5">
                        {item.time}
                      </span>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-foreground font-medium">{item.text}</p>
                        {item.isLive && (
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-destructive/15 text-destructive font-bold border border-destructive/30">
                            LIVE RUN
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): City Situation Map Preview */}
          <div className="lg:col-span-5">
            <div className="flex h-full min-h-[500px] flex-col rounded-lg border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/40">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    City Situation Map Preview
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Spatial layer displaying road defects, incidents, and transit corridors.
                  </p>
                </div>
                <Link
                  to="/city-map"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
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

function IssueDetailDrawer({
  issue,
  onClose,
}: {
  issue: Issue | null;
  onClose: () => void;
}) {
  if (!issue) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl animate-in slide-in-from-right duration-200">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/40">
        <div>
          <div className="flex items-center gap-2">
            <PriorityBadge priority={issue.priority} />
            <h3 className="font-bold text-sm text-foreground">{issue.title}</h3>
          </div>
          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{issue.id} · {issue.road}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {issue.evidenceUrl && (
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Evidence Artifact</span>
            <div className="aspect-video w-full rounded-md border border-border overflow-hidden bg-black/50">
              <img src={issue.evidenceUrl} alt={issue.title} className="h-full w-full object-cover" />
            </div>
          </div>
        )}

        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Category</span>
            <span className="font-semibold text-foreground uppercase">{issue.category}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Department</span>
            <span className="font-semibold text-foreground">{issue.department}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Confidence</span>
            <span className="font-mono font-bold text-primary">{Math.round(issue.confidence * 100)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">SLA Window</span>
            <span className="font-mono text-foreground">{issue.slaHoursRemaining}h remaining</span>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <Link
            to="/action-center"
            className="flex items-center justify-center gap-2 w-full rounded-md bg-primary py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer"
          >
            <Wrench className="h-3.5 w-3.5" /> Dispatch Work Order
          </Link>
        </div>
      </div>
    </div>
  );
}
