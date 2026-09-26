import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Film,
  Flag,
  Info,
  MapPin,
  Play,
  Route,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { SafetyEventDetail, SafetyIncident } from "@/types/safety";
import { RISK_LEVEL_CONFIG } from "@/types/safety";
import { RiskScoreBar } from "./SafetyShared";
import { SafetyEvidenceModal } from "./SafetyEvidenceModal";
import type { OfficialIncidentStatus } from "./SafetyIncidentCard";

interface SafetyIncidentInspectorProps {
  incident: SafetyIncident;
  detail?: SafetyEventDetail | null;
  fps: number;
  status: OfficialIncidentStatus;
  notes?: string;
  onUpdateStatus: (status: OfficialIncidentStatus, notes?: string) => void;
  onSeekToIncident: (incident: SafetyIncident) => void;
  onLocateOnMap?: () => void;
  onClose?: () => void;
}

export function SafetyIncidentInspector({
  incident,
  detail,
  fps,
  status,
  notes = "",
  onUpdateStatus,
  onSeekToIncident,
  onLocateOnMap,
  onClose,
}: SafetyIncidentInspectorProps) {
  const cfg = RISK_LEVEL_CONFIG[incident.risk_level] ?? RISK_LEVEL_CONFIG.low;
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceStartIdx, setEvidenceStartIdx] = useState(0);
  const [showTechnical, setShowTechnical] = useState(false);
  const [reviewNotes, setReviewNotes] = useState(notes);
  const [isSaved, setIsSaved] = useState(false);

  const openEvidence = (idx = 0) => {
    setEvidenceStartIdx(idx);
    setEvidenceOpen(true);
  };

  const handleSaveVerdict = (newStatus: OfficialIncidentStatus) => {
    onUpdateStatus(newStatus, reviewNotes);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <>
      <div className="flex flex-col divide-y divide-border text-foreground">
        {/* ── Top Header ─────────────────────────────────────────────────── */}
        <div className="p-4 bg-muted/10 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider mb-1",
                  cfg.bgClass,
                  cfg.colorClass
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {cfg.label} Priority
              </span>
              <h2 className="text-base font-bold text-foreground leading-tight">
                {incident.title}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-mono">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3 opacity-70" />
                  {incident.start_time} → {incident.end_time}
                </span>
                <span className="opacity-40">·</span>
                <span>{incident.duration_seconds.toFixed(1)}s interaction</span>
                <span className="opacity-40">·</span>
                <span>Pedestrian #{incident.track_id ?? "?"}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {onLocateOnMap && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs font-semibold text-muted-foreground border-border hover:bg-muted"
                  onClick={onLocateOnMap}
                  title="View corridor on pedestrian hotspot map"
                >
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  Map
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10"
                onClick={() => onSeekToIncident(incident)}
                title="Jump to incident in video"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Video
              </Button>
            </div>
          </div>

          {/* Peak Risk Score Bar */}
          <div className="pt-1">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-semibold text-muted-foreground">
                Peak Risk Heuristic Score:
              </span>
              <span className="font-mono font-bold text-foreground">
                {incident.peak_risk_score.toFixed(2)} / 1.00
              </span>
            </div>
            <RiskScoreBar
              score={incident.peak_risk_score}
              level={incident.risk_level}
            />
          </div>
        </div>

        {/* ── Official Action & Review Decision ─────────────────────────── */}
        <div className="p-4 space-y-3 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Official Verification & Action
            </span>
            {isSaved && (
              <span className="text-[11px] font-bold text-ok flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Decision Logged
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleSaveVerdict("reviewed_safe")}
              className={cn(
                "flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition",
                status === "reviewed_safe"
                  ? "border-ok bg-ok/10 text-ok font-bold shadow-sm"
                  : "border-border bg-muted/30 text-muted-foreground hover:border-ok/50 hover:bg-ok/5 hover:text-ok"
              )}
            >
              <CheckCircle2 className="h-4 w-4 mb-1" />
              <span className="text-[11px] leading-tight font-semibold">Compliant</span>
              <span className="text-[9px] opacity-75 mt-0.5">Safe Yield</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveVerdict("flagged_coaching")}
              className={cn(
                "flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition",
                status === "flagged_coaching"
                  ? "border-warn bg-warn/10 text-warn font-bold shadow-sm"
                  : "border-border bg-muted/30 text-muted-foreground hover:border-warn/50 hover:bg-warn/5 hover:text-warn"
              )}
            >
              <Flag className="h-4 w-4 mb-1" />
              <span className="text-[11px] leading-tight font-semibold">Flag Coaching</span>
              <span className="text-[9px] opacity-75 mt-0.5">Driver Briefing</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveVerdict("escalated")}
              className={cn(
                "flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition",
                status === "escalated"
                  ? "border-critical bg-critical/10 text-critical font-bold shadow-sm"
                  : "border-border bg-muted/30 text-muted-foreground hover:border-critical/50 hover:bg-critical/5 hover:text-critical"
              )}
            >
              <ShieldAlert className="h-4 w-4 mb-1" />
              <span className="text-[11px] leading-tight font-semibold">Escalate</span>
              <span className="text-[9px] opacity-75 mt-0.5">Supervisor Review</span>
            </button>
          </div>

          {/* Official Notes Textarea */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-semibold text-muted-foreground">
              Official Review Notes (Optional):
            </label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="e.g. Bus driver braked smoothly before pedestrian reached transit lane. No further action needed."
              rows={2}
              className="w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* ── Problem Identification & Recommended Action ───────────────── */}
        <div className="p-4 space-y-3 bg-muted/5">
          <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-warn" />
              Detected Issue
            </div>
            <p className="text-xs font-semibold text-foreground leading-relaxed">
              {incident.issue_description}
            </p>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-primary" />
              Recommended Official Action
            </div>
            <p className="text-xs text-foreground leading-relaxed">
              {incident.action_recommendation}
            </p>
          </div>

          {/* Hazard Tags */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {incident.in_school_zone && (
              <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                School Corridor Active
              </span>
            )}
            {incident.in_crossing_zone && (
              <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                Designated Pedestrian Crossing
              </span>
            )}
            {incident.road_entry && (
              <span className="rounded-md border border-critical/30 bg-critical/10 px-2 py-0.5 text-[10px] font-semibold text-critical">
                Pedestrian Stepped Into Roadway
              </span>
            )}
            {incident.risk_reasons.map((r, i) => (
              <span
                key={i}
                className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground capitalize"
              >
                {r}
              </span>
            ))}
          </div>
        </div>

        {/* ── Keyframe Evidence Gallery ─────────────────────────────────── */}
        {incident.evidence_frame_urls.length > 0 && (
          <div className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Film className="h-3.5 w-3.5 text-primary" />
                Evidence Keyframes ({incident.evidence_frame_urls.length})
              </span>
              <span className="text-[10px] text-muted-foreground">
                Click to inspect high-res
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {incident.evidence_frame_urls.map((url, i) => (
                <button
                  key={url}
                  onClick={() => openEvidence(i)}
                  aria-label={`View evidence keyframe ${i + 1}`}
                  className="group relative h-16 w-24 overflow-hidden rounded-lg border border-border bg-muted transition hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <img
                    src={url}
                    alt={`Evidence keyframe ${i + 1}`}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 text-[8px] font-mono font-bold text-white">
                    #{i + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Technical CV Telemetry (Collapsible for Officials) ─────────── */}
        <div className="p-4 space-y-2">
          <button
            type="button"
            onClick={() => setShowTechnical(!showTechnical)}
            className="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground transition"
          >
            <span className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              Technical CV Details ({incident.total_detections} frames consolidated)
            </span>
            {showTechnical ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showTechnical && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5 text-xs text-muted-foreground font-mono animate-in fade-in">
              <div className="flex justify-between">
                <span>Object Type:</span>
                <span className="text-foreground capitalize">{incident.object_type}</span>
              </div>
              <div className="flex justify-between">
                <span>Start Frame:</span>
                <span className="text-foreground">#{incident.start_frame} ({incident.start_time})</span>
              </div>
              <div className="flex justify-between">
                <span>End Frame:</span>
                <span className="text-foreground">#{incident.end_frame} ({incident.end_time})</span>
              </div>
              <div className="flex justify-between">
                <span>Total Monitored Frames:</span>
                <span className="text-foreground">{incident.total_detections} frames</span>
              </div>
              <div className="flex justify-between">
                <span>Track ID:</span>
                <span className="text-foreground">#{incident.track_id}</span>
              </div>
              {detail?.latitude != null && detail?.longitude != null && (
                <div className="flex justify-between">
                  <span>GPS Coordinates:</span>
                  <span className="text-foreground">{detail.latitude.toFixed(6)}, {detail.longitude.toFixed(6)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* High-res modal */}
      {evidenceOpen && detail && (
        <SafetyEvidenceModal
          event={detail}
          fps={fps}
          initialIndex={evidenceStartIdx}
          onClose={() => setEvidenceOpen(false)}
        />
      )}
    </>
  );
}
