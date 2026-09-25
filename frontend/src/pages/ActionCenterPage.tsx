import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  MapPin,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PriorityBadge, SeverityBadge, StatusBadge } from "@/components/common/badges";
import { IssueDetailDrawer } from "@/components/issues/IssueDetailDrawer";
import { useStore } from "@/state/app-store";
import type { Issue, IssueCategory, IssueStatus, Priority } from "@/types";

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
  const { issues } = useStore();
  const [activeDrawerIssue, setActiveDrawerIssue] = useState<Issue | null>(null);

  // Filters state
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWard, setSelectedWard] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedTime, setSelectedTime] = useState<string>("all");

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
      if (selectedWard !== "all" && !issue.ward.includes(selectedWard)) {
        return false;
      }

      // Status filter
      if (selectedStatus !== "all" && issue.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [issues, quickFilter, searchQuery, selectedWard, selectedStatus, selectedTime]);

  const quickFilterTabs: { id: QuickFilter; label: string; count: number }[] = [
    { id: "all", label: "All Issues", count: issues.length },
    { id: "critical", label: "Critical", count: issues.filter((i) => i.priority === "P1").length },
    { id: "road_issues", label: "Road Issues", count: issues.filter((i) => ["pothole", "crack", "missing_divider"].includes(i.category)).length },
    { id: "traffic", label: "Traffic", count: issues.filter((i) => i.category === "traffic").length },
    { id: "pedestrian", label: "Pedestrian Hazards", count: issues.filter((i) => ["zebra_crossing", "safety"].includes(i.category)).length },
    { id: "incidents", label: "Vehicle Incidents", count: issues.filter((i) => i.category === "incident").length },
    { id: "unverified", label: "Unverified", count: issues.filter((i) => i.status !== "confirmed" && i.status !== "resolved").length },
    { id: "assigned", label: "Assigned", count: issues.filter((i) => Boolean(i.assignedTo)).length },
  ];

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Quick Filter Chips Row */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-2 shadow-xs">
          {quickFilterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setQuickFilter(tab.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                quickFilter === tab.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  quickFilter === tab.id ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Secondary Filters Bar */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-xs md:grid-cols-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by ID, issue, or road..."
              className="h-8 w-full rounded border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* Location / Ward Filter */}
          <select
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            className="h-8 rounded border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
          >
            <option value="all">All Wards / Locations</option>
            <option value="BMC Ward 4">BMC Ward 4 (WEH)</option>
            <option value="BMC Ward 1">BMC Ward 1 (Linking Road)</option>
            <option value="Traffic South">Traffic South (LBS Marg)</option>
            <option value="BMC Ward 7">BMC Ward 7 (JVLR)</option>
            <option value="PWD Ward 15">PWD Ward 15</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-8 rounded border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="confirming">Confirming</option>
            <option value="confirmed">Confirmed / Verified</option>
            <option value="assigned">Assigned</option>
            <option value="under_repair">Under Repair</option>
            <option value="resolved">Resolved</option>
          </select>

          {/* Time Window Filter */}
          <select
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
            className="h-8 rounded border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
          >
            <option value="all">All Time Windows</option>
            <option value="1h">Past Hour</option>
            <option value="today">Today</option>
            <option value="7d">Past 7 Days</option>
          </select>
        </div>

        {/* Main Operational Table */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 bg-slate-50">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Operational Issues List ({filteredIssues.length} items)
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Detect → Corroborate → Review → Assign → Resolve
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
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
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredIssues.map((iss) => (
                  <tr
                    key={iss.id}
                    onClick={() => setActiveDrawerIssue(iss)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <PriorityBadge priority={iss.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-900 block">{iss.title}</span>
                      <span className="font-mono text-[11px] text-slate-400">{iss.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800 block">{iss.road}</span>
                      <span className="text-[11px] text-slate-500">{iss.ward}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                      {iss.lastObservedLabel}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-900 block">{iss.observationCount} passes</span>
                      <span className="text-[11px] text-slate-500">{iss.busCount} buses</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={iss.status} />
                    </td>
                    <td className="px-4 py-3">
                      {iss.assignedTo ? (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-slate-800 font-medium">
                          {iss.assignedTo}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDrawerIssue(iss);
                        }}
                        className="inline-flex items-center gap-1 rounded border border-blue-600 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-600 hover:text-white transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
