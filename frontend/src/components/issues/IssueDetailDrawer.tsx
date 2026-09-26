import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  MapPin,
  Send,
  ShieldCheck,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PriorityBadge, SeverityBadge, StatusBadge } from "@/components/common/badges";
import { DetectionOverlay } from "@/components/evidence/DetectionOverlay";
import { BeforeAfterSlider } from "@/components/evidence/EvidenceViewer";
import { DEPARTMENTS } from "@/lib/domain";
import { useStore } from "@/state/app-store";
import type { Issue, IssueStatus } from "@/types";

interface IssueDetailDrawerProps {
  issue: Issue | null;
  onClose: () => void;
}

export function IssueDetailDrawer({ issue, onClose }: IssueDetailDrawerProps) {
  const { observations, setStatus, assignIssue } = useStore();
  const [activeTab, setActiveTab] = useState<"current" | "before" | "verification">("current");
  const [selectedDept, setSelectedDept] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  if (!issue) return null;

  const issueObservations = observations.filter((o) => o.issueId === issue.id);

  const handleAssign = () => {
    if (!selectedDept) {
      toast.error("Please select a department or ward");
      return;
    }
    assignIssue(issue.id, selectedDept);
    setIsAssigning(false);
    toast.success(`Issue ${issue.id} assigned to ${selectedDept}`);
  };

  const handleStatusChange = (newStatus: IssueStatus, label: string) => {
    setStatus(issue.id, newStatus);
    toast.success(`Issue ${issue.id} marked as ${label}`);
  };

  // Workflow steps status calculation
  const workflowSteps = [
    { label: "Detect", done: true, time: issue.firstObserved },
    { label: "Corroborate", done: issue.observationCount > 1, count: `${issue.busCount} buses` },
    { label: "Review", done: issue.status !== "new", current: issue.status === "confirming" },
    { label: "Assign", done: Boolean(issue.assignedTo), current: issue.status === "assigned" },
    { label: "Resolve", done: issue.status === "resolved", current: issue.status === "under_repair" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Main Drawer Container */}
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl animate-in slide-in-from-right duration-250">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded bg-blue-600/30 text-blue-400 border border-blue-500/30">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">{issue.title}</h2>
                <span className="font-mono text-xs text-slate-300">({issue.id})</span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {issue.road} · {issue.ward}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Workflow Progress Bar */}
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase mb-2">
            Operational Lifecycle: Detect → Corroborate → Review → Assign → Resolve
          </div>
          <div className="grid grid-cols-5 gap-1">
            {workflowSteps.map((step, idx) => (
              <div
                key={step.label}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded border text-center text-[10px] font-medium transition-colors ${
                  step.done
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : step.current
                    ? "bg-blue-50 border-blue-400 text-blue-800 font-semibold"
                    : "bg-white border-slate-200 text-slate-400"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span>{step.label}</span>
                  {step.done && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                </div>
                {step.count && <span className="text-[9px] opacity-75">{step.count}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Key Badges Summary */}
          <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <PriorityBadge priority={issue.priority} />
            <SeverityBadge severity={issue.severity} />
            <StatusBadge status={issue.status} />
            {issue.persistent && (
              <span className="inline-flex items-center rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                Persistent Hotspot
              </span>
            )}
            {issue.contractorId && (
              <span className="inline-flex items-center rounded border border-purple-300 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-800">
                Warranty Active (DLP)
              </span>
            )}
          </div>

          {/* Evidence Package */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-blue-600" />
                Bus Vision Evidence Package
              </h3>
              <div className="flex gap-1 rounded bg-slate-100 p-0.5 text-xs">
                <button
                  onClick={() => setActiveTab("current")}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    activeTab === "current" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Latest Pass
                </button>
                <button
                  onClick={() => setActiveTab("before")}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    activeTab === "before" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  First Detected
                </button>
                {issue.evidence.verification && (
                  <button
                    onClick={() => setActiveTab("verification")}
                    className={`px-2.5 py-1 rounded font-medium transition-all ${
                      activeTab === "verification" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Verification
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
              {activeTab === "current" && (
                <DetectionOverlay
                  frame={issue.evidence.current}
                  options={{ boxes: true, segmentation: true, trackIds: false, privacyMask: true }}
                  className="aspect-[16/9] w-full"
                />
              )}
              {activeTab === "before" && (
                <DetectionOverlay
                  frame={issue.evidence.before}
                  options={{ boxes: true, segmentation: true, trackIds: false, privacyMask: true }}
                  className="aspect-[16/9] w-full"
                />
              )}
              {activeTab === "verification" && issue.evidence.verification && (
                <BeforeAfterSlider
                  before={issue.evidence.before}
                  after={issue.evidence.verification}
                  className="aspect-[16/9] w-full"
                />
              )}
            </div>
            <p className="text-[11px] text-slate-500 italic">
              * Automatically processed with privacy masking (face & license plate blurring).
            </p>
          </div>

          {/* Details Metadata Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Technical Telemetry & Observations
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">Detection Source</span>
                <span className="font-semibold text-slate-800">{issue.model}</span>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">Model Confidence</span>
                <span className="font-semibold text-slate-800">{(issue.confidence * 100).toFixed(1)}%</span>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">Corroborating Buses</span>
                <span className="font-semibold text-slate-800">{issue.busCount} active buses</span>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">Total Observations</span>
                <span className="font-semibold text-slate-800">{issue.observationCount} passes</span>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">Assigned Department</span>
                <span className="font-semibold text-slate-800">{issue.assignedTo || issue.department || "Unassigned"}</span>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">SLA Remaining</span>
                <span className="font-semibold text-slate-800">{issue.slaHoursRemaining} hours</span>
              </div>
            </div>
          </div>

          {/* Reason Flagged */}
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-900">
            <span className="font-bold block mb-1">Reason Flagged:</span>
            Pothole detected with {(issue.confidence * 100).toFixed(0)}% confidence across {issue.busCount} independent public bus passes. Marked {issue.priority} due to road segment traffic volume.
          </div>

          {/* Bus Observation History Timeline */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-slate-500" />
              Corroborating Bus Pass Log
            </h3>
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {issueObservations.length > 0 ? (
                issueObservations.map((obs) => (
                  <div key={obs.id} className="flex items-center justify-between border-b border-slate-100 py-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[11px]">
                        {obs.busId}
                      </span>
                      <span className="text-slate-600">{obs.note}</span>
                    </div>
                    <span className="text-slate-400 font-mono text-[11px]">{obs.at}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 py-2">
                  First detected on {issue.firstObserved}. Last pass on {issue.lastObserved}.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <footer className="border-t border-slate-200 bg-slate-50 p-4 space-y-3">
          {/* Assignment UI */}
          {isAssigning ? (
            <div className="space-y-2 rounded-md border border-slate-300 bg-white p-3">
              <label className="text-xs font-semibold text-slate-700 block">Select Department / Ward</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-800 outline-none focus:border-blue-500"
              >
                <option value="">Select ward or authority...</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                <option value="PWD Ward 4">PWD Ward 4</option>
                <option value="PWD Ward 15">PWD Ward 15</option>
                <option value="Traffic South Zone">Traffic South Zone</option>
                <option value="Sanitation Zone 2">Sanitation Zone 2</option>
              </select>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAssign} className="flex-1 bg-blue-700 hover:bg-blue-800 text-xs">
                  Confirm Assignment
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsAssigning(false)} className="text-xs">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAssigning(true)}
                className="flex items-center justify-center gap-1 text-xs border-slate-300 hover:bg-slate-100"
              >
                <Send className="h-3.5 w-3.5 text-blue-600" />
                Assign
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange("confirmed", "Verified")}
                className="flex items-center justify-center gap-1 text-xs border-slate-300 hover:bg-emerald-50 text-emerald-700"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Verify
              </Button>
              <Button
                size="sm"
                onClick={() => handleStatusChange("resolved", "Resolved")}
                className="flex items-center justify-center gap-1 text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Resolve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleStatusChange("dismissed" as any, "Dismissed")}
                className="flex items-center justify-center gap-1 text-xs text-slate-500 hover:bg-rose-50 hover:text-rose-700"
              >
                <XCircle className="h-3.5 w-3.5 text-rose-500" />
                Dismiss
              </Button>
            </div>
          )}
        </footer>
      </aside>
    </div>
  );
}
