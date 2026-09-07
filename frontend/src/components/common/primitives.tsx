import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-card px-4 py-2.5 sm:flex sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-semibold text-foreground">{title}</h1>
        {subtitle ? (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("panel flex min-w-0 flex-col", className)}>
      {title ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-3 py-2">
          <div className="min-w-0">
            <h2 className="truncate text-[12px] font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="truncate text-[11px] text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("p-3", bodyClassName)}>{children}</div>
    </section>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "ok" | "warn" | "critical" | "info";
  onClick?: () => void;
}) {
  const toneColor: Record<string, string> = {
    neutral: "text-muted-foreground",
    ok: "text-ok",
    warn: "text-warn",
    critical: "text-critical",
    info: "text-info",
  };
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "panel flex min-w-0 items-start gap-2.5 px-3 py-2.5 text-left",
        onClick && "transition-colors hover:border-primary/40 hover:bg-accent/40",
      )}
    >
      {Icon ? (
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded bg-secondary">
          <Icon className={cn("h-3.5 w-3.5", toneColor[tone])} aria-hidden />
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="label-xs block truncate">{label}</span>
        <span className="num block text-[19px] font-semibold leading-6 text-foreground">
          {value}
        </span>
        {hint ? (
          <span className={cn("block truncate text-[11px]", toneColor[tone])}>{hint}</span>
        ) : null}
      </span>
    </Wrapper>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

export function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,110px)_minmax(0,1fr)] gap-2 py-1">
      <dt className="truncate text-[11px] text-muted-foreground">{label}</dt>
      <dd className="num min-w-0 break-words text-[12px] font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function Donut({
  value,
  label,
  color,
  size = 44,
}: {
  value: number;
  label: string;
  color: string;
  size?: number;
}) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth="4" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="52%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="num"
        fontSize="10"
        fontWeight="600"
        fill="var(--foreground)"
      >
        {value}%
      </text>
    </svg>
  );
}
