import { AlertTriangle, CheckCircle2, CircleDot, Clock, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITY_META, SEVERITY_META, STATUS_META } from "@/lib/domain";
import type { IssueStatus, Priority, Severity } from "@/types";

const toneClasses: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-info-soft text-info border-info/20",
  warn: "bg-warn-soft text-[oklch(0.5_0.12_75)] border-warn/30",
  ok: "bg-ok-soft text-ok border-ok/25",
  critical: "bg-critical-soft text-critical border-critical/25",
};

export function StatusBadge({ status, className }: { status: IssueStatus; className?: string }) {
  const meta = STATUS_META[status];
  const Icon =
    meta.tone === "ok" ? CheckCircle2 : meta.tone === "critical" ? ShieldAlert : CircleDot;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium",
        toneClasses[meta.tone],
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {meta.label}
    </span>
  );
}

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const meta = SEVERITY_META[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        meta.bg,
        className,
      )}
      style={{ color: meta.color }}
    >
      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
      {meta.label}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const styles: Record<Priority, string> = {
    P1: "bg-critical text-white",
    P2: "bg-major text-white",
    P3: "bg-secondary text-secondary-foreground border border-border",
  };
  return (
    <span
      title={PRIORITY_META[priority].hint}
      className={cn(
        "num inline-flex h-5 min-w-[26px] items-center justify-center rounded px-1 text-[11px] font-bold",
        styles[priority],
        className,
      )}
    >
      {priority}
    </span>
  );
}

export function SlaBadge({ hours }: { hours: number }) {
  const critical = hours <= 6;
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-1 text-[11px] font-medium",
        critical ? "text-critical" : "text-muted-foreground",
      )}
    >
      <Clock className="h-3 w-3" aria-hidden />
      {hours > 0 ? `${hours}h remaining` : "Closed"}
    </span>
  );
}

export function ConfidenceBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="num text-[11px] font-semibold text-foreground">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}
