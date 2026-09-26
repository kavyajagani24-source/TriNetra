import { useState } from "react";
import { Clock, Film, MapPin, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SafetyEventListItem } from "@/types/safety";
import {
  frameToTime,
  formatEventType,
  RISK_LEVEL_CONFIG,
} from "@/types/safety";
import {
  ContextFlags,
  RiskLevelBadge,
  RiskScoreBar,
} from "./SafetyShared";

interface SafetyEventCardProps {
  event: SafetyEventListItem;
  fps: number;
  isSelected?: boolean;
  onSelect: (event: SafetyEventListItem) => void;
}

export function SafetyEventCard({
  event,
  fps,
  isSelected = false,
  onSelect,
}: SafetyEventCardProps) {
  const cfg = RISK_LEVEL_CONFIG[event.risk_level] ?? RISK_LEVEL_CONFIG.low;
  const startTime = frameToTime(event.start_frame, fps);
  const endTime = frameToTime(event.end_frame, fps);
  const thumbUrl = event.evidence_frame_urls?.[0];
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const hasLocation = event.latitude != null && event.longitude != null;

  return (
    <button
      onClick={() => onSelect(event)}
      className={cn(
        "group relative w-full rounded-lg border text-left transition-all p-2.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring overflow-hidden",
        isSelected
          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
          : "border-border/60 bg-card hover:border-primary/40 hover:bg-muted/30"
      )}
      aria-pressed={isSelected}
      aria-label={`Safety event: ${formatEventType(event.event_type)}, ${cfg.label}`}
    >
      {/* Left accent indicator */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1",
          event.risk_level === "high"
            ? "bg-critical"
            : event.risk_level === "medium"
              ? "bg-warn"
              : "bg-ok"
        )}
        aria-hidden
      />

      <div className="flex gap-2.5 pl-1">
        {/* Evidence thumbnail or sleek fallback */}
        <div className="relative h-14 w-[80px] shrink-0 overflow-hidden rounded-md border border-border/50 bg-muted/60">
          {thumbUrl && !imgError ? (
            <img
              src={thumbUrl}
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

          {(!thumbUrl || imgError || !imgLoaded) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/40 text-muted-foreground/60 p-1">
              <ShieldAlert className="h-4 w-4 mb-0.5 opacity-60" aria-hidden />
              <span className="text-[8px] font-mono tracking-tight opacity-75">
                F#{event.trigger_frame_index ?? event.start_frame}
              </span>
            </div>
          )}

          {/* Multi-frame counter bubble */}
          {event.evidence_frame_urls && event.evidence_frame_urls.length > 1 && (
            <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 py-0.2 text-[8px] font-bold text-white shadow-sm">
              +{event.evidence_frame_urls.length - 1}
            </span>
          )}
        </div>

        {/* Content Details */}
        <div className="min-w-0 flex-1 space-y-1">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-1.5">
            <span
              className="truncate text-[11px] font-semibold text-foreground"
              title={formatEventType(event.event_type)}
            >
              {formatEventType(event.event_type)}
            </span>
            <RiskLevelBadge level={event.risk_level} className="text-[9px] px-1.5 py-0.2 shrink-0 font-bold" />
          </div>

          {/* Compact Heuristic Score */}
          <RiskScoreBar score={event.risk_score} level={event.risk_level} compact />

          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-mono">
              <Clock className="h-2.5 w-2.5 shrink-0 opacity-70" aria-hidden />
              <span>{startTime}</span>
              <span className="opacity-50">→</span>
              <span>{endTime}</span>
            </span>

            {event.track_id != null && (
              <span className="rounded bg-muted/70 px-1 py-0.2 font-mono text-[9px] text-foreground/80">
                Track #{event.track_id}
              </span>
            )}

            {event.object_type && (
              <span className="capitalize text-[10px]">
                {event.object_type}
              </span>
            )}

            {hasLocation && (
              <span className="inline-flex items-center gap-0.5 font-mono text-[9px]">
                <MapPin className="h-2 w-2 opacity-60" aria-hidden />
                {event.latitude!.toFixed(3)},{event.longitude!.toFixed(3)}
              </span>
            )}
          </div>

          {/* Context Flags */}
          <ContextFlags event={event} />
        </div>
      </div>
    </button>
  );
}
