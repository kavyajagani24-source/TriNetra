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

  const awaitingReviewCount = incidents.filter((i) => i.status === "human_review" || i.status === "flagged").length;
  const confirmedCount = incidents.filter((i) => i.status === "confirmed").length;
  const dismissedCount = incidents.filter((i) => (i.status as string) === "dismissed").length;
  const closedCount = incidents.filter((i) => (i.status as string) === "closed").length;

  return (
    <AppShell>
      <div className="space-y-4">
        {/* AI Disclaimer Banner */}
        <div className="flex items-center gap-3 rounded-lg border border-[#F0DCA0] bg-[#FBF6E3] p-4 text-xs text-[#26352E] shadow-[var(--shadow-panel)]">
          <AlertOctagon className="h-5 w-5 text-[#E1BE63] shrink-0" />
          <div>
            <span className="font-display font-semibold text-sm block tracking-tight">AI-Generated Incident Candidates Console</span>
            All items listed below represent automated detection signals from edge video analytics. They require mandatory human review and verification before initiating official municipal or law enforcement action.
          </div>
        </div>

        {/* Summary Count Badges */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-[#DCE9E1] bg-white p-4 shadow-[var(--shadow-panel)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#64736B]">Awaiting Review</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-[#FBF6E3] text-[#E1BE63]">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-data text-2xl font-bold text-[#26352E]">{awaitingReviewCount}</span>
              <span className="text-xs font-medium text-[#E1BE63]">Pending</span>
            </div>
            <p className="mt-1 text-[11px] text-[#91A099]">Requires human review</p>
          </div>

          <div className="rounded-lg border border-[#DCE9E1] bg-white p-4 shadow-[var(--shadow-panel)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#64736B]">Confirmed</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-[#E4F5EC] text-[#68C491]">
                <ShieldCheck className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-data text-2xl font-bold text-[#26352E]">{confirmedCount}</span>
              <span className="text-xs font-medium text-[#68C491]">Verified</span>
            </div>
            <p className="mt-1 text-[11px] text-[#91A099]">Operator confirmed candidates</p>
          </div>

          <div className="rounded-lg border border-[#DCE9E1] bg-white p-4 shadow-[var(--shadow-panel)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#64736B]">Dismissed</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-[#FDEAEA] text-[#E27676]">
                <XCircle className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-data text-2xl font-bold text-[#26352E]">{dismissedCount}</span>
              <span className="text-xs font-medium text-[#E27676]">False positives</span>
            </div>
            <p className="mt-1 text-[11px] text-[#91A099]">Rejected during inspection</p>
          </div>

          <div className="rounded-lg border border-[#DCE9E1] bg-white p-4 shadow-[var(--shadow-panel)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#64736B]">Closed</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-[#E8F3FA] text-[#72A9C9]">
                <CheckCircle2 className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-data text-2xl font-bold text-[#26352E]">{closedCount}</span>
              <span className="text-xs font-medium text-[#72A9C9]">Archived</span>
            </div>
            <p className="mt-1 text-[11px] text-[#91A099]">Handled and logged</p>
          </div>
        </div>

        {/* Main Incident Candidates Table */}
        <div className="rounded-lg border border-[#DCE9E1] bg-white shadow-[var(--shadow-panel)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#DCE9E1] px-5 py-3 bg-[#F7FAF8]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#26352E]">
              AI Incident Candidates Table ({incidents.length} candidates)
            </span>
            <span className="text-[11px] text-[#91A099] font-mono">
              Types: Collision Candidate | Rash Driving | Hit-and-Run Candidate
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#DCE9E1] bg-[#F0F7F3] text-[11px] font-semibold text-[#64736B] uppercase tracking-wider">
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
              <tbody className="divide-y divide-[#DCE9E1] text-[#26352E]">
                {incidents.map((inc) => (
                  <tr
                    key={inc.id}
                    onClick={() => setActiveDrawerIncident(inc)}
                    className="hover:bg-[#F7FAF8] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-[#26352E]">
                      {inc.id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-[#26352E] block">{inc.type}</span>
                      <span className="text-[10px] text-[#91A099] font-mono">
                        {(inc.confidence * 100).toFixed(0)}% AI confidence
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#64736B]">{inc.location}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[#91A099]">{inc.at}</td>
                    <td className="px-4 py-3 text-[#64736B]">{inc.vehicleType}</td>
                    <td className="px-4 py-3 font-mono font-bold text-[#4BAF7C]">
                      {inc.plateCandidate || "Not Identified"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          inc.status === "human_review"
                            ? "border-[#F0DCA0] bg-[#FBF6E3] text-[#26352E]"
                            : inc.status === "confirmed"
                            ? "border-[#CBEBDD] bg-[#E4F5EC] text-[#26352E]"
                            : "border-[#DCE9E1] bg-[#F0F7F3] text-[#64736B]"
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
                        className="inline-flex items-center gap-1 rounded border border-[#CBEBDD] bg-[#E4F5EC] px-2.5 py-1 text-xs font-semibold text-[#26352E] hover:bg-[#4BAF7C] hover:text-white hover:border-[#4BAF7C] transition-colors"
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

      <IncidentDetailDrawer
        incident={activeDrawerIncident}
        onClose={() => setActiveDrawerIncident(null)}
      />
    </AppShell>
  );
}
