/**
 * TriNetra — Safety UI Shared Components
 *
 * Risk level badge, heuristic score bar, context flags.
 * IMPORTANT: risk_score is an EXPLAINABLE HEURISTIC, NOT a probability.
 */

import { AlertTriangle, CheckCircle2, ShieldAlert, MapPin, School, CrosshairIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiskLevel, SafetyEventListItem } from "@/types/safety";
import { RISK_LEVEL_CONFIG, formatEventType } from "@/types/safety";

// ── Risk Level Badge ──────────────────────────────────────────────────────────

export function RiskLevelBadge({
  level,
  className,
}: {
  level: RiskLevel;
  className?: string;
}) {
  const cfg = RISK_LEVEL_CONFIG[level] ?? RISK_LEVEL_CONFIG.low;
  const Icon =
    level === "high"
      ? ShieldAlert
      : level === "medium"
        ? AlertTriangle
        : CheckCircle2;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        cfg.bgClass,
        cfg.colorClass,
        className
      )}
    >
      <Icon className="h-2.5 w-2.5 shrink-0" aria-hidden />
      {cfg.label}
    </span>
  );
}

// ── Heuristic Score Bar ───────────────────────────────────────────────────────
// NOTE: score is a rule-based heuristic (0.0–1.0). NOT a probability.

export function RiskScoreBar({
  score,
  level,
  compact = false,
  className,
}: {
  score: number;
  level: RiskLevel;
  compact?: boolean;
  className?: string;
}) {
  const cfg = RISK_LEVEL_CONFIG[level] ?? RISK_LEVEL_CONFIG.low;
  const barColor =
    level === "high"
      ? "bg-critical"
      : level === "medium"
        ? "bg-warn"
        : "bg-ok";
  const pct = Math.round(Math.min(1, Math.max(0, score)) * 100);

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <span className="text-[10px] text-muted-foreground font-medium shrink-0">
          Risk Index:
        </span>
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted/80 shrink-0">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${pct}%` }}
            role="meter"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <span className={cn("num text-[10px] font-bold", cfg.colorClass)}>
          {score.toFixed(2)}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-0.5", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          Risk score (heuristic)
        </span>
        <span className={cn("num text-[11px] font-bold", cfg.colorClass)}>
          {score.toFixed(2)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${pct}%` }}
          role="meter"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Risk heuristic score ${score.toFixed(2)}`}
        />
      </div>
    </div>
  );
}

// ── Event Type Tag ────────────────────────────────────────────────────────────

export function EventTypeTag({
  eventType,
  className,
}: {
  eventType: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block truncate rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground",
        className
      )}
      title={eventType}
    >
      {formatEventType(eventType)}
    </span>
  );
}

// ── Context Flags ─────────────────────────────────────────────────────────────

export function ContextFlags({
  event,
  className,
}: {
  event: Pick<
    SafetyEventListItem,
    "in_school_zone" | "in_crossing_zone" | "road_entry"
  >;
  className?: string;
}) {
  const flags = [
    {
      key: "school",
      active: event.in_school_zone,
      icon: School,
      label: "School zone",
    },
    {
      key: "crossing",
      active: event.in_crossing_zone,
      icon: CrosshairIcon,
      label: "Crossing zone",
    },
    {
      key: "road_entry",
      active: event.road_entry,
      icon: MapPin,
      label: "Road entry",
    },
  ].filter((f) => f.active);

  if (flags.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {flags.map(({ key, icon: Icon, label }) => (
        <span
          key={key}
          className="inline-flex items-center gap-0.5 rounded bg-info-soft px-1 py-0.5 text-[10px] font-medium text-info"
        >
          <Icon className="h-2.5 w-2.5 shrink-0" aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}
