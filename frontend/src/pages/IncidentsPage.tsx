import { useState } from "react";
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Truck,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { IncidentDetailDrawer } from "@/components/incidents/IncidentDetailDrawer";
import { useStore } from "@/state/app-store";
import type { IncidentCandidate } from "@/types";

export function IncidentsPage() {
  const { incidents } = useStore();
  const [activeDrawerIncident, setActiveDrawerIncident] = useState<IncidentCandidate | null>(null);

  // Metrics summary counts
  const awaitingReviewCount = incidents.filter((i) => i.status === "human_review" || i.status === "flagged").length;
  const confirmedCount = incidents.filter((i) => i.status === "confirmed").length;
  const dismissedCount = incidents.filter((i) => (i.status as string) === "dismissed").length;
  const closedCount = incidents.filter((i) => (i.status as string) === "closed").length;

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Top AI Disclaimer Banner */}
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 shadow-xs">
          <AlertOctagon className="h-5 w-5 text-amber-700 shrink-0" />
          <div>
            <span className="font-bold text-sm block">AI-Generated Incident Candidates Console</span>
            All items listed below represent automated detection signals from edge video analytics. They require mandatory human review and verification before initiating official municipal or law enforcement action.
          </div>
        </div>

        {/* Summary Count Badges */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Awaiting Review</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-amber-50 text-amber-600">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">{awaitingReviewCount}</span>
              <span className="text-xs font-medium text-amber-600">Pending</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Requires human review</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Confirmed</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">{confirmedCount}</span>
              <span className="text-xs font-medium text-emerald-600">Verified</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Operator confirmed candidates</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Dismissed</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-rose-50 text-rose-600">
                <XCircle className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">{dismissedCount}</span>
              <span className="text-xs font-medium text-rose-600">False positives</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Rejected during inspection</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Closed</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-blue-50 text-blue-600">
                <CheckCircle2 className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">{closedCount}</span>
              <span className="text-xs font-medium text-blue-600">Archived</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Handled and logged</p>
          </div>
        </div>

        {/* Main Incident Candidates Table */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 bg-slate-50">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              AI Incident Candidates Table ({incidents.length} candidates)
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Types: Collision Candidate | Rash Driving | Hit-and-Run Candidate
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5">Incident ID</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Location</th>
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">Vehicle</th>
                  <th className="px-4 py-2.5">Plate Candidate</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {incidents.map((inc) => (
                  <tr
                    key={inc.id}
                    onClick={() => setActiveDrawerIncident(inc)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {inc.id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-900 block">{inc.type}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {(inc.confidence * 100).toFixed(0)}% AI confidence
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{inc.location}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{inc.at}</td>
                    <td className="px-4 py-3 text-slate-700">{inc.vehicleType}</td>
                    <td className="px-4 py-3 font-mono font-bold text-blue-700">
                      {inc.plateCandidate || "MH01AB1234"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          inc.status === "human_review"
                            ? "border-amber-300 bg-amber-50 text-amber-800"
                            : inc.status === "confirmed"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border-slate-300 bg-slate-50 text-slate-700"
                        }`}
                      >
                        {inc.status === "human_review" ? "Awaiting Review" : inc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDrawerIncident(inc);
                        }}
                        className="inline-flex items-center gap-1 rounded border border-blue-600 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-600 hover:text-white transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Review Evidence
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Incident Detail Evidence Drawer */}
      <IncidentDetailDrawer
        incident={activeDrawerIncident}
        onClose={() => setActiveDrawerIncident(null)}
      />
    </AppShell>
  );
}
