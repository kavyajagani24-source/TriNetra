import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileCheck2,
  Filter,
  MapPin,
  Search,
  UserCheck,
  Video,
  Wrench,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PriorityBadge, StatusBadge } from "@/components/common/badges";
import { useStore } from "@/state/app-store";
import type { Issue, IssueStatus } from "@/types";

type QuickFilter =
  | "all"
  | "critical"
  | "road_issues"
  | "traffic"
  | "pedestrian"
  | "incidents"
  | "unverified"
  | "assigned";

export function ActionCenterPage() {
  const { issues, setStatus, assignIssue, demoMode, toggleDemoMode } = useStore();
  const [activeDrawerIssue, setActiveDrawerIssue] = useState<Issue | null>(null);

  // Filters state
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWard, setSelectedWard] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Filtered issues computation
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // Quick filter tabs
      if (quickFilter === "critical" && issue.priority !== "P1" && issue.severity !== "critical") {
        return false;
      }
      if (quickFilter === "road_issues" && !["pothole", "crack", "missing_divider"].includes(issue.category)) {
        return false;
      }
      if (quickFilter === "traffic" && issue.category !== "traffic") {
        return false;
      }
      if (quickFilter === "pedestrian" && !["zebra_crossing", "safety"].includes(issue.category)) {
        return false;
      }
      if (quickFilter === "incidents" && issue.category !== "incident") {
        return false;
      }
      if (quickFilter === "unverified" && (issue.status === "confirmed" || issue.status === "resolved")) {
        return false;
      }
      if (quickFilter === "assigned" && !issue.assignedTo) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = issue.id.toLowerCase().includes(q);
        const matchesTitle = issue.title.toLowerCase().includes(q);
        const matchesRoad = issue.road.toLowerCase().includes(q);
        if (!matchesId && !matchesTitle && !matchesRoad) return false;
      }

      // Ward location filter
      if (selectedWard !== "all" && issue.ward && !issue.ward.includes(selectedWard)) {
        return false;
      }

      // Status filter
      if (selectedStatus !== "all" && issue.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [issues, quickFilter, searchQuery, selectedWard, selectedStatus]);

  const quickFilterTabs: { id: QuickFilter; label: string; count: number }[] = [
    { id: "all", label: "All Issues", count: issues.length },
    { id: "critical", label: "Critical P1", count: issues.filter((i) => i.priority === "P1").length },
    { id: "road_issues", label: "Road Hazards", count: issues.filter((i) => ["pothole", "crack", "missing_divider"].includes(i.category)).length },
    { id: "traffic", label: "Traffic", count: issues.filter((i) => i.category === "traffic").length },
    { id: "pedestrian", label: "Safety / VRU", count: issues.filter((i) => ["zebra_crossing", "safety"].includes(i.category)).length },
    { id: "incidents", label: "Incidents", count: issues.filter((i) => i.category === "incident").length },
    { id: "unverified", label: "Pending Verification", count: issues.filter((i) => i.status !== "confirmed" && i.status !== "resolved").length },
    { id: "assigned", label: "Assigned Work Orders", count: issues.filter((i) => Boolean(i.assignedTo)).length },
  ];

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Quick Filter Chips Row */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-2 shadow-xs">
          {quickFilterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setQuickFilter(tab.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-ui text-xs font-semibold transition-all cursor-pointer ${
                quickFilter === tab.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  quickFilter === tab.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-card text-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Secondary Filters Bar */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-3 shadow-xs md:grid-cols-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by ID, issue, or road..."
              className="h-8 w-full rounded border border-border bg-muted/40 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:bg-card"
            />
          </div>

          {/* Location / Ward Filter */}
          <select
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            className="h-8 rounded border border-border bg-muted/40 px-2.5 text-xs text-foreground outline-none focus:border-primary"
          >
            <option value="all">All Wards / Corridors</option>
            <option value="WEH">Western Express Highway</option>
            <option value="Linking Road">Linking Road</option>
            <option value="LBS">LBS Marg</option>
            <option value="JVLR">JVLR</option>
            <option value="SV Road">SV Road</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-8 rounded border border-border bg-muted/40 px-2.5 text-xs text-foreground outline-none focus:border-primary"
          >
            <option value="all">All Operational Statuses</option>
            <option value="new">New</option>
            <option value="confirming">Confirming</option>
            <option value="confirmed">Confirmed / Verified</option>
            <option value="assigned">Assigned</option>
            <option value="under_repair">Under Repair</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        {/* Main Operational Table */}
        <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3 bg-muted/30">
            <span className="font-ui text-xs font-semibold uppercase tracking-wider text-foreground">
              Operational Issues List ({filteredIssues.length} items)
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              Detect → Corroborate → Review → Assign → Resolve
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5">Priority</th>
                  <th className="px-4 py-2.5">Issue</th>
                  <th className="px-4 py-2.5">Location</th>
                  <th className="px-4 py-2.5">Observed</th>
                  <th className="px-4 py-2.5">Observations</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Assigned To</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {filteredIssues.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto text-ok mb-2 opacity-80" />
                      <p className="font-semibold text-foreground text-sm">No Operational Issues Found</p>
                      <p className="mt-1 text-muted-foreground max-w-sm mx-auto">
                        There are no open road hazards or safety tickets matching the current filter. Ingest video footage in the Video Processing workspace to detect new road anomalies.
                      </p>
                      <div className="mt-4 flex items-center justify-center gap-3">
                        <Link
                          to="/videos"
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer"
                        >
                          <Video className="h-3.5 w-3.5" /> Video Processing
                        </Link>
                        {!demoMode && (
                          <button
                            onClick={toggleDemoMode}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/80 transition-all cursor-pointer"
                          >
                            Explore Demo Benchmark
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredIssues.map((iss) => (
                    <tr
                      key={iss.id}
                      onClick={() => setActiveDrawerIssue(iss)}
                      className="hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <PriorityBadge priority={iss.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-foreground block">{iss.title}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{iss.id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground block">{iss.road}</span>
                        <span className="text-[11px] text-muted-foreground">{iss.ward}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                        {iss.lastObservedLabel}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-foreground block">{iss.observationCount} passes</span>
                        <span className="text-[11px] text-muted-foreground">{iss.busCount} buses</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={iss.status} />
                      </td>
                      <td className="px-4 py-3">
                        {iss.assignedTo ? (
                          <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-foreground font-medium">
                            {iss.assignedTo}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDrawerIssue(iss);
                          }}
                          className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Shared Issue Detail Drawer */}
      <IssueDetailDrawer
        issue={activeDrawerIssue}
        onClose={() => setActiveDrawerIssue(null)}
        onSetStatus={setStatus}
        onAssign={assignIssue}
      />
    </AppShell>
  );
}

function IssueDetailDrawer({
  issue,
  onClose,
  onSetStatus,
  onAssign,
}: {
  issue: Issue | null;
  onClose: () => void;
  onSetStatus: (id: string, s: IssueStatus) => void;
  onAssign: (id: string, to: string) => void;
}) {
  const [contractorInput, setContractorInput] = useState("");

  if (!issue) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl animate-in slide-in-from-right duration-200">
      <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/30">
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

      <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
        {issue.evidenceUrl && (
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Evidence Artifact</span>
            <div className="aspect-video w-full rounded-md border border-border overflow-hidden bg-black/50">
              <img src={issue.evidenceUrl} alt={issue.title} className="h-full w-full object-cover" />
            </div>
          </div>
        )}

        <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Department</span>
            <span className="font-semibold text-foreground">{issue.department}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Confidence</span>
            <span className="font-mono font-bold text-primary">{Math.round(issue.confidence * 100)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <StatusBadge status={issue.status} />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Assigned To</span>
            <span className="font-semibold text-foreground">{issue.assignedTo || "None"}</span>
          </div>
        </div>

        {/* Workflow Action Controls */}
        <div className="space-y-3 pt-2 border-t border-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Operational Actions</span>
          <div className="flex gap-2">
            <button
              onClick={() => onSetStatus(issue.id, "confirmed")}
              className="flex-1 rounded-md border border-border bg-card py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Verify Defect
            </button>
            <button
              onClick={() => onSetStatus(issue.id, "resolved")}
              className="flex-1 rounded-md bg-ok py-2 text-xs font-semibold text-white hover:bg-ok/90 transition-colors cursor-pointer"
            >
              Mark Resolved
            </button>
          </div>

          <div className="rounded-md border border-border p-2.5 bg-muted/20 space-y-2">
            <span className="text-[11px] font-bold text-foreground block">Assign Work Order Dispatch</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-0.5 font-medium">Department</label>
                <select
                  defaultValue={issue.department}
                  id="action-dept-select"
                  className="w-full rounded border border-border bg-card px-2 py-1 text-xs text-foreground outline-none"
                >
                  <option value="PWD">PWD</option>
                  <option value="Traffic Police">Traffic Police</option>
                  <option value="Transport">Transport</option>
                  <option value="Sanitation">Sanitation</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-0.5 font-medium">Priority</label>
                <select
                  defaultValue={issue.priority}
                  id="action-priority-select"
                  className="w-full rounded border border-border bg-card px-2 py-1 text-xs text-foreground outline-none"
                >
                  <option value="P1">P1 - Urgent</option>
                  <option value="P2">P2 - Moderate</option>
                  <option value="P3">P3 - Watch</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={contractorInput}
                onChange={(e) => setContractorInput(e.target.value)}
                placeholder="Assign contractor or crew..."
                className="flex-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              />
              <button
                onClick={() => {
                  if (contractorInput.trim()) {
                    const deptEl = document.getElementById("action-dept-select") as HTMLSelectElement;
                    const priEl = document.getElementById("action-priority-select") as HTMLSelectElement;
                    onAssign(issue.id, {
                      to: contractorInput.trim(),
                      department: (deptEl?.value as any) || issue.department,
                      priority: (priEl?.value as any) || issue.priority,
                    } as any);
                    setContractorInput("");
                  }
                }}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
