import { useState } from "react";
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  MapPin,
  ShieldAlert,
  Truck,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DetectionOverlay } from "@/components/evidence/DetectionOverlay";
import { useStore } from "@/state/app-store";
import type { IncidentCandidate } from "@/types";

interface IncidentDetailDrawerProps {
  incident: IncidentCandidate | null;
  onClose: () => void;
}

export function IncidentDetailDrawer({ incident, onClose }: IncidentDetailDrawerProps) {
  const { setIncidentStatus } = useStore();

  if (!incident) return null;

  const handleAction = (status: IncidentCandidate["status"], label: string) => {
    setIncidentStatus(incident.id, status);
    toast.success(`Incident ${incident.id} marked as ${label}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl animate-in slide-in-from-right duration-250">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">{incident.type}</h2>
                <span className="font-mono text-xs text-slate-300">({incident.id})</span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {incident.location}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Close incident drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* AI Disclaimer Banner */}
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertOctagon className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">AI-Generated Incident Candidate</span>
            This incident was flagged automatically by on-bus AI video analytics. Human operator verification is required before taking enforcement action.
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Review Status:</span>
              <span className={`font-semibold uppercase px-2 py-0.5 rounded text-[11px] ${
                incident.status === "human_review"
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : incident.status === "confirmed"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : incident.status === "flagged"
                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                  : "bg-slate-100 text-slate-700 border border-slate-300"
              }`}>
                {incident.status === "human_review" ? "Awaiting Review" : incident.status}
              </span>
            </div>
            <div className="text-xs font-mono text-slate-600">
              Confidence: <span className="font-bold text-slate-900">{(incident.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* Video Frame Evidence */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-blue-600" />
              Evidence Frame & Track Bounding
            </h3>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
              <DetectionOverlay
                frame={incident.evidence}
                options={{ boxes: true, segmentation: true, trackIds: true, privacyMask: true }}
                className="aspect-[16/9] w-full"
              />
            </div>
          </div>

          {/* Telemetry & ANPR Information */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-slate-600" />
              Vehicle & ANPR License Plate Telemetry
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">Vehicle Classification</span>
                <span className="font-semibold text-slate-800">{incident.vehicleType}</span>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">ANPR Plate Candidate</span>
                <span className="font-mono font-bold text-blue-700">{incident.plateCandidate || "MH01AB1234"}</span>
                {incident.plateConfidence && (
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    ({(incident.plateConfidence * 100).toFixed(0)}% OCR match)
                  </span>
                )}
              </div>
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">Tracking ID</span>
                <span className="font-mono text-slate-800">{incident.trackId}</span>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">Supporting Keyframes</span>
                <span className="font-semibold text-slate-800">{incident.supportingFrames} frames</span>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">Ingesting Bus</span>
                <span className="font-mono text-slate-800">{incident.evidence.busId}</span>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">Timestamp</span>
                <span className="font-semibold text-slate-800">{incident.at}</span>
              </div>
            </div>
          </div>

          {/* Event Signal Timeline */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-slate-500" />
              Signal Detection Sequence
            </h3>
            <div className="space-y-2 text-xs border-l-2 border-slate-200 pl-3 py-1 ml-1">
              <div className="relative">
                <span className="font-semibold text-slate-800">10:32:00</span>
                <span className="text-slate-600 block">Bus front camera captures rapid lateral velocity change.</span>
              </div>
              <div className="relative">
                <span className="font-semibold text-slate-800">10:32:01</span>
                <span className="text-slate-600 block">Edge AI model flags {incident.type} ({incident.trackId}).</span>
              </div>
              <div className="relative">
                <span className="font-semibold text-slate-800">10:32:04</span>
                <span className="text-slate-600 block">ANPR module extracts plate {incident.plateCandidate}. Evidence package uploaded.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <footer className="border-t border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-3 gap-2">
            <Button
              size="sm"
              onClick={() => handleAction("confirmed", "Confirmed")}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs flex items-center justify-center gap-1"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Confirm Incident
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction("flagged", "Flagged for Review")}
              className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs flex items-center justify-center gap-1"
            >
              <FileText className="h-3.5 w-3.5 text-blue-600" />
              Flag for Review
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleAction("dismissed" as any, "Dismissed")}
              className="text-rose-600 hover:bg-rose-50 text-xs flex items-center justify-center gap-1"
            >
              <XCircle className="h-3.5 w-3.5" />
              Dismiss
            </Button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
