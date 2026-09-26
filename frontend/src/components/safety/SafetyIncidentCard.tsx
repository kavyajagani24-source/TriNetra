import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Flag,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SafetyIncident } from "@/types/safety";
import { RISK_LEVEL_CONFIG } from "@/types/safety";

export type OfficialIncidentStatus =
  | "pending"
  | "reviewed_safe"
  | "flagged_coaching"
  | "escalated";

interface SafetyIncidentCardProps {
  incident: SafetyIncident;
  isSelected?: boolean;
  status?: OfficialIncidentStatus;
  onSelect: (incident: SafetyIncident) => void;
  onUpdateStatus?: (
    incidentId: string,
    status: OfficialIncidentStatus,
    e: React.MouseEvent
  ) => void;
}

export function SafetyIncidentCard({
  incident,
  isSelected = false,
  status = "pending",
  onSelect,
  onUpdateStatus,
}: SafetyIncidentCardProps) {
  const cfg = RISK_LEVEL_CONFIG[incident.risk_level] ?? RISK_LEVEL_CONFIG.low;
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div
      onClick={() => onSelect(incident)}
      className={cn(
        "group relative w-full cursor-pointer rounded-xl border text-left transition-all overflow-hidden p-3.5 select-none",
        isSelected
          ? "border-primary bg-primary/[0.04] shadow-md ring-1 ring-primary/40"
          : "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/20 hover:shadow-sm"
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(incident);
        }
      }}
      aria-pressed={isSelected}
      aria-label={`Safety Incident: ${incident.title}, ${cfg.label}`}
    >
      {/* Left colored risk bar */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1.5",
          incident.risk_level === "high"
            ? "bg-critical"
            : incident.risk_level === "medium"
              ? "bg-warn"
              : "bg-ok"
        )}
        aria-hidden
      />

      <div className="flex flex-col gap-2.5 pl-1.5">
        {/* Top Header: Title, Risk Badge & Official Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[13px] font-bold text-foreground leading-snug">
                {incident.title}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3 opacity-70" />
                {incident.start_time} → {incident.end_time}
              </span>
              <span className="opacity-40">·</span>
              <span>{incident.duration_seconds.toFixed(1)}s duration</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                cfg.bgClass,
                cfg.colorClass
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {incident.risk_level === "high"
                ? "Critical Risk"
                : incident.risk_level === "medium"
                  ? "Medium Risk"
                  : "Low Risk"}
            </span>

            {/* Official Review Status Pill */}
            {status === "reviewed_safe" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ok/15 text-ok px-2 py-0.5 text-[9px] font-bold">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Reviewed (Safe)
              </span>
            )}
            {status === "flagged_coaching" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 text-warn px-2 py-0.5 text-[9px] font-bold">
                <Flag className="h-2.5 w-2.5" />
                Flagged (Coaching)
              </span>
            )}
            {status === "escalated" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-critical/15 text-critical px-2 py-0.5 text-[9px] font-bold">
                <ShieldAlert className="h-2.5 w-2.5" />
                Escalated
              </span>
            )}
            {status === "pending" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-1.5 py-0.5 text-[9px] font-medium">
                Pending Action
              </span>
            )}
          </div>
        </div>

        {/* Thumbnail + Core Issue Description */}
        <div className="flex gap-3">
          {/* Evidence Keyframe Thumbnail */}
          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-muted/60">
            {incident.primary_evidence_url && !imgError ? (
              <img
                src={incident.primary_evidence_url}
                alt=""
                className={cn(
                  "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
                  !imgLoaded && "opacity-0"
                )}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
                loading="lazy"
              />
            ) : null}

            {(!incident.primary_evidence_url || imgError || !imgLoaded) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/40 text-muted-foreground/60 p-1">
                <Eye className="h-5 w-5 mb-1 opacity-60" />
                <span className="text-[9px] font-mono tracking-tight opacity-75">
                  Track #{incident.track_id ?? "?"}
                </span>
              </div>
            )}

            {/* Pedestrian Track tag */}
            <span className="absolute bottom-1 left-1 rounded bg-black/80 px-1 py-0.2 text-[8px] font-mono font-bold text-white shadow-sm">
              Pedestrian #{incident.track_id ?? "?"}
            </span>
          </div>

          {/* Issue Statement & Action Advice */}
          <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
            <div>
              <div className="text-[11px] font-semibold text-foreground/90 leading-tight">
                {incident.issue_description}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground leading-tight flex items-start gap-1">
                <span className="text-primary font-bold shrink-0">Action:</span>
                <span>{incident.action_recommendation}</span>
              </div>
            </div>

            {/* Quick Context Tags */}
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              {incident.in_school_zone && (
                <span className="rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 text-[9px] font-semibold">
                  School Zone
                </span>
              )}
              {incident.in_crossing_zone && (
                <span className="rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 text-[9px] font-semibold">
                  Crosswalk Corridor
                </span>
              )}
              {incident.road_entry && (
                <span className="rounded bg-critical/10 text-critical px-1.5 py-0.2 text-[9px] font-semibold">
                  Roadway Entry
                </span>
              )}
              <span className="text-[9px] text-muted-foreground/70 ml-auto font-mono">
                {incident.total_detections} frames tracked
              </span>
            </div>
          </div>
        </div>

        {/* Quick Review Action Bar for Officials */}
        {onUpdateStatus && (
          <div
            className="flex items-center justify-between border-t border-border/50 pt-2 mt-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[10px] font-medium text-muted-foreground">
              Official Verdict:
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => onUpdateStatus(incident.id, "reviewed_safe", e)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition",
                  status === "reviewed_safe"
                    ? "bg-ok text-white shadow-sm"
                    : "bg-muted/70 text-muted-foreground hover:bg-ok/15 hover:text-ok"
                )}
                title="Mark incident as reviewed and compliant"
              >
                <CheckCircle2 className="h-3 w-3" />
                Safe
              </button>

              <button
                type="button"
                onClick={(e) => onUpdateStatus(incident.id, "flagged_coaching", e)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition",
                  status === "flagged_coaching"
                    ? "bg-warn text-white shadow-sm"
                    : "bg-muted/70 text-muted-foreground hover:bg-warn/15 hover:text-warn"
                )}
                title="Flag for driver coaching session"
              >
                <Flag className="h-3 w-3" />
                Flag Driver
              </button>

              <button
                type="button"
                onClick={(e) => onUpdateStatus(incident.id, "escalated", e)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition",
                  status === "escalated"
                    ? "bg-critical text-white shadow-sm"
                    : "bg-muted/70 text-muted-foreground hover:bg-critical/15 hover:text-critical"
                )}
                title="Escalate incident to safety director"
              >
                <ShieldAlert className="h-3 w-3" />
                Escalate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
