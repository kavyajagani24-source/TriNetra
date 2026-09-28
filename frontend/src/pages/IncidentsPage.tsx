import { useEffect, useState, useMemo } from "react";
import {
  AlertOctagon,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileText,
  Filter,
  Flame,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Truck,
  Video,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { IncidentDetailDrawer } from "@/components/incidents/IncidentDetailDrawer";
import { IncidentAnalysisPanel } from "@/components/incidents/IncidentAnalysisPanel";
import { useStore } from "@/state/app-store";
import { getIncidentAlerts, type IncidentAlertSummary } from "@/services/api/incident";
import type { IncidentCandidate } from "@/types";
import { cn } from "@/lib/utils";

export function IncidentsPage() {
  const { incidents: mockIncidents, setIncidentStatus } = useStore();
  const [liveAlerts, setLiveAlerts] = useState<IncidentAlertSummary[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeDrawerIncident, setActiveDrawerIncident] = useState<IncidentCandidate | null>(null);

  // Fetch real alerts from backend
  const fetchAlerts = async () => {
    setIsLoadingAlerts(true);
    try {
      const alerts = await getIncidentAlerts();
      setLiveAlerts(alerts);
    } catch (err) {
      console.warn("Could not fetch live incident alerts:", err);
    } finally {
      setIsLoadingAlerts(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  // Map live alerts from backend into unified IncidentCandidate format
  const liveIncidentCandidates = useMemo<IncidentCandidate[]>(() => {
    return liveAlerts.map((a) => {
      const runId = a.incident_id.replace(/^INC_/, "");
      const trackId = a.vehicle?.track_ids?.length ? a.vehicle.track_ids.join(", ") : "0";
      return {
        id: a.incident_id,
        type: a.incident_type === "COLLISION_CANDIDATE"
          ? "Collision Candidate"
          : a.incident_type === "HIT_AND_RUN_CANDIDATE"
          ? "Hit-and-Run Candidate"
          : a.incident_type === "ABNORMAL_DRIVING_CANDIDATE" || a.incident_type === "RASH_DRIVING"
          ? "Rash Driving Candidate"
          : a.incident_type === "NEAR_COLLISION"
          ? "Near Collision / Proximity Pass"
          : a.incident_type,
        location: a.gps
          ? `GPS: ${a.gps.latitude.toFixed(4)}, ${a.gps.longitude.toFixed(4)}`
          : "Transit Corridor (Live Ingestion)",
        at: a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
        confidence: a.confidence,
        vehicleType: a.vehicle?.role || "Motor Vehicle",
        trackId: `Track #${trackId}`,
        plateCandidate: a.anpr?.status === "DETECTED" ? a.anpr.plate_number : "Plate not readable",
        plateConfidence: a.anpr?.plate_confidence || 0,
        status: a.status === "REVIEW_REQUIRED" ? "human_review" : (a.status as any) || "human_review",
        isLiveRun: true,
        runId,
        evidencePackage: a.evidence,
        statement: a.statement,
        evidence: {
          busId: "SURVEY-CAM-01",
          image: a.evidence?.during ? (a.evidence.during.startsWith("http") ? a.evidence.during : `http://localhost:8000/${a.evidence.during.replace(/^\/+/, "")}`) : undefined,
          detections: [],
        },
      } as IncidentCandidate;
    });
  }, [liveAlerts]);

  // Combine live runs (first) + unique baseline benchmark candidates
  const allIncidents = useMemo(() => {
    const liveIds = new Set(liveIncidentCandidates.map((i) => i.id));
    const uniqueMocks = mockIncidents.filter((m) => !liveIds.has(m.id));
    return [...liveIncidentCandidates, ...uniqueMocks];
  }, [liveIncidentCandidates, mockIncidents]);

  // Filtered list
  const filteredIncidents = useMemo(() => {
    if (statusFilter === "all") return allIncidents;
    if (statusFilter === "human_review") {
      return allIncidents.filter((i) => i.status === "human_review" || i.status === "flagged");
    }
    return allIncidents.filter((i) => i.status === statusFilter);
  }, [allIncidents, statusFilter]);

  const awaitingReviewCount = allIncidents.filter((i) => i.status === "human_review" || i.status === "flagged").length;
  const confirmedCount = allIncidents.filter((i) => i.status === "confirmed").length;
  const dismissedCount = allIncidents.filter((i) => (i.status as string) === "dismissed").length;
  const closedCount = allIncidents.filter((i) => (i.status as string) === "closed").length;

  return (
    <AppShell>
      <div className="space-y-4">
        {/* AI Governance / Disclaimer Banner */}
        <div className="flex items-center justify-between rounded-lg border border-[#F0DCA0] bg-[#FBF6E3] p-4 text-xs text-[#26352E] shadow-[var(--shadow-panel)]">
          <div className="flex items-center gap-3">
            <AlertOctagon className="h-5 w-5 text-[#E1BE63] shrink-0" />
            <div>
              <span className="font-display font-semibold text-sm block tracking-tight">
                AI-Generated Incident Candidates Console (Human-in-the-Loop)
              </span>
              All entries represent automated detection candidates from edge multi-signal analytics (neural classification, pairwise kinematics, optical flow burst, and ANPR temporal voting). Mandatory human review is required before legal or municipal enforcement.
            </div>
          </div>
          <button
            onClick={() => setShowAnalysisPanel(!showAnalysisPanel)}
            className="flex items-center gap-1.5 shrink-0 rounded-md bg-[#26352E] text-white px-3 py-1.5 text-xs font-semibold hover:bg-black transition-colors"
          >
            {showAnalysisPanel ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showAnalysisPanel ? "Hide Video Analyzer" : "Upload Video to Analyze"}
          </button>
        </div>

        {/* Collapsible Incident Analysis Panel */}
        {showAnalysisPanel && (
          <div className="animate-in fade-in duration-200">
            <IncidentAnalysisPanel
              onAnalysisComplete={() => {
                fetchAlerts();
              }}
            />
          </div>
        )}

        {/* Summary Count Badges */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <button
            onClick={() => setStatusFilter(statusFilter === "human_review" ? "all" : "human_review")}
            className={cn(
              "rounded-lg border p-4 text-left shadow-[var(--shadow-panel)] transition-all cursor-pointer",
              statusFilter === "human_review" ? "border-amber-400 bg-amber-50/50 ring-2 ring-amber-400/20" : "border-[#DCE9E1] bg-white hover:bg-slate-50/50"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#64736B]">Awaiting Review</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-[#FBF6E3] text-[#E1BE63]">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-data text-2xl font-bold text-[#26352E]">{awaitingReviewCount}</span>
              <span className="text-xs font-medium text-[#E1BE63]">Candidates</span>
            </div>
            <p className="mt-1 text-[11px] text-[#91A099]">Pending human verification</p>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === "confirmed" ? "all" : "confirmed")}
            className={cn(
              "rounded-lg border p-4 text-left shadow-[var(--shadow-panel)] transition-all cursor-pointer",
              statusFilter === "confirmed" ? "border-emerald-400 bg-emerald-50/50 ring-2 ring-emerald-400/20" : "border-[#DCE9E1] bg-white hover:bg-slate-50/50"
            )}
          >
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
            <p className="mt-1 text-[11px] text-[#91A099]">Operator confirmed</p>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === "dismissed" ? "all" : "dismissed")}
            className={cn(
              "rounded-lg border p-4 text-left shadow-[var(--shadow-panel)] transition-all cursor-pointer",
              statusFilter === "dismissed" ? "border-red-400 bg-red-50/50 ring-2 ring-red-400/20" : "border-[#DCE9E1] bg-white hover:bg-slate-50/50"
            )}
          >
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
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === "closed" ? "all" : "closed")}
            className={cn(
              "rounded-lg border p-4 text-left shadow-[var(--shadow-panel)] transition-all cursor-pointer",
              statusFilter === "closed" ? "border-blue-400 bg-blue-50/50 ring-2 ring-blue-400/20" : "border-[#DCE9E1] bg-white hover:bg-slate-50/50"
            )}
          >
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
          </button>
        </div>

        {/* Main Incident Candidates Table */}
        <div className="rounded-lg border border-[#DCE9E1] bg-white shadow-[var(--shadow-panel)] overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DCE9E1] px-5 py-3 bg-[#F7FAF8]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#26352E]">
                Incident Candidates Table ({filteredIncidents.length} shown)
              </span>
              {liveAlerts.length > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold">
                  {liveAlerts.length} Live Runs Active
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchAlerts}
                disabled={isLoadingAlerts}
                className="flex items-center gap-1 text-[11px] text-[#64736B] hover:text-[#26352E] px-2 py-1 rounded border border-[#DCE9E1] bg-white transition-colors"
                title="Refresh live alerts from backend"
              >
                <RefreshCw className={cn("h-3 w-3", isLoadingAlerts && "animate-spin")} />
                Refresh
              </button>
              <div className="flex items-center gap-1 text-[11px] text-[#91A099]">
                <Filter className="h-3 w-3" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded border border-[#DCE9E1] bg-white px-2 py-1 text-xs text-[#26352E] focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="human_review">Awaiting Review</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#DCE9E1] bg-[#F0F7F3] text-[11px] font-semibold text-[#64736B] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5">Source / ID</th>
                  <th className="px-4 py-2.5">Candidate Type</th>
                  <th className="px-4 py-2.5">Location / GPS</th>
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">Track / Class</th>
                  <th className="px-4 py-2.5">ANPR Observation</th>
                  <th className="px-4 py-2.5">Review Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE9E1] text-[#26352E]">
                {filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground text-xs">
                      No incident candidates matching filter '{statusFilter}'.
                    </td>
                  </tr>
                ) : (
                  filteredIncidents.map((inc) => {
                    const isLive = (inc as any).isLiveRun;
                    return (
                      <tr
                        key={inc.id}
                        onClick={() => setActiveDrawerIncident(inc)}
                        className="hover:bg-[#F7FAF8] cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-mono font-bold text-[#26352E]">
                          <div className="flex items-center gap-1.5">
                            <span>{inc.id}</span>
                            {isLive ? (
                              <span className="text-[9px] font-sans uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Live AI
                              </span>
                            ) : (
                              <span className="text-[9px] font-sans uppercase font-medium tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-300">
                                Sample
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-[#26352E] block">{inc.type}</span>
                          <span className="text-[10px] text-[#91A099] font-mono">
                            {(inc.confidence * 100).toFixed(0)}% AI confidence
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#64736B] font-mono text-[11px]">{inc.location}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-[#91A099]">{inc.at}</td>
                        <td className="px-4 py-3 text-[#64736B]">{inc.vehicleType}</td>
                        <td className="px-4 py-3 font-mono font-bold text-[#4BAF7C]">
                          {inc.plateCandidate || "Plate not readable"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase",
                              inc.status === "human_review"
                                ? "border-[#F0DCA0] bg-[#FBF6E3] text-[#26352E]"
                                : inc.status === "confirmed"
                                ? "border-[#CBEBDD] bg-[#E4F5EC] text-[#26352E]"
                                : "border-[#DCE9E1] bg-[#F0F7F3] text-[#64736B]"
                            )}
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
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
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
