import { useState } from "react";
import {
  AlertOctagon,
  Bus,
  ChevronLeft,
  Flame,
  Layers,
  PersonStanding,
  Route as RouteIcon,
  TrafficCone,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_META, DEPARTMENTS } from "@/lib/domain";
import type { LayerState, MapFilters } from "@/state/app-store";
import type { IssueCategory, IssueStatus, Severity } from "@/types";
import { BUS_ROUTES } from "@/data/geo";

const LAYER_ITEMS: { key: keyof LayerState; label: string; icon: typeof Layers }[] = [
  { key: "defects", label: "Defects", icon: TriangleAlert },
  { key: "traffic", label: "Traffic", icon: TrafficCone },
  { key: "safety", label: "Safety", icon: PersonStanding },
  { key: "incidents", label: "Incidents", icon: AlertOctagon },
  { key: "buses", label: "Buses", icon: Bus },
  { key: "heatmap", label: "Heatmap", icon: Flame },
  { key: "roadCondition", label: "Road Condition", icon: RouteIcon },
];

export function MapToolbar({
  layers,
  onToggle,
  className,
}: {
  layers: LayerState;
  onToggle: (k: keyof LayerState) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded border border-white/10 bg-map-panel/95 p-1.5 shadow-float backdrop-blur",
        className,
      )}
    >
      <p className="label-xs px-1 pb-1 text-map-muted">Layers</p>
      <div className="flex flex-col gap-0.5">
        {LAYER_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onToggle(key)}
            aria-pressed={layers[key]}
            className={cn(
              "flex items-center gap-2 rounded px-2 py-1 text-[11px] font-medium transition-colors",
              layers[key]
                ? "bg-primary/25 text-map-foreground"
                : "text-map-muted hover:bg-white/5 hover:text-map-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
            <span
              className={cn(
                "ml-auto h-1.5 w-1.5 rounded-full",
                layers[key] ? "bg-ok" : "bg-white/20",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

const CATEGORIES: IssueCategory[] = [
  "pothole",
  "crack",
  "missing_divider",
  "zebra_crossing",
  "traffic_sign",
  "waterlogging",
  "debris",
  "traffic",
  "safety",
  "incident",
];

const STATUSES: IssueStatus[] = [
  "new",
  "confirming",
  "confirmed",
  "assigned",
  "under_repair",
  "verification_pending",
  "resolved",
  "reopened",
];

const SEVERITIES: (Severity | "all")[] = ["all", "minor", "moderate", "major", "critical"];

export function MapFilterPanel({
  filters,
  onChange,
  className,
}: {
  filters: MapFilters;
  onChange: (f: MapFilters) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const toggleCategory = (c: IssueCategory) =>
    onChange({
      ...filters,
      categories: filters.categories.includes(c)
        ? filters.categories.filter((x) => x !== c)
        : [...filters.categories, c],
    });

  const toggleStatus = (s: IssueStatus) =>
    onChange({
      ...filters,
      statuses: filters.statuses.includes(s)
        ? filters.statuses.filter((x) => x !== s)
        : [...filters.statuses, s],
    });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "grid h-8 w-8 place-items-center rounded border border-white/10 bg-map-panel/95 text-map-foreground shadow-float",
          className,
        )}
        aria-label="Show filters"
      >
        <Layers className="h-3.5 w-3.5" aria-hidden />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "scroll-thin w-[212px] overflow-y-auto rounded border border-white/10 bg-map-panel/95 shadow-float backdrop-blur",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-2.5 py-1.5">
        <p className="label-xs text-map-muted">Filters</p>
        <button
          onClick={() => setOpen(false)}
          aria-label="Hide filters"
          className="text-map-muted hover:text-map-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <div className="space-y-3 p-2.5">
        <fieldset>
          <legend className="label-xs mb-1 text-map-muted">Issue type</legend>
          <div className="space-y-0.5">
            {CATEGORIES.map((c) => (
              <label
                key={c}
                className="flex cursor-pointer items-center gap-2 text-[11px] text-map-foreground/90"
              >
                <input
                  type="checkbox"
                  className="h-3 w-3 accent-[#5b9bd5]"
                  checked={filters.categories.includes(c)}
                  onChange={() => toggleCategory(c)}
                />
                {CATEGORY_META[c].label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label-xs mb-1 text-map-muted">Severity</legend>
          <div className="flex flex-wrap gap-1">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                onClick={() => onChange({ ...filters, severity: s })}
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[10px] capitalize",
                  filters.severity === s
                    ? "border-primary/60 bg-primary/25 text-map-foreground"
                    : "border-white/10 text-map-muted hover:text-map-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label-xs mb-1 text-map-muted">Status</legend>
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[10px] capitalize",
                  filters.statuses.includes(s)
                    ? "border-primary/60 bg-primary/25 text-map-foreground"
                    : "border-white/10 text-map-muted hover:text-map-foreground",
                )}
              >
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label-xs mb-1 text-map-muted">Time</legend>
          <div className="flex flex-wrap gap-1">
            {(["1h", "today", "7d", "custom"] as const).map((t) => (
              <button
                key={t}
                onClick={() => onChange({ ...filters, timeWindow: t })}
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[10px]",
                  filters.timeWindow === t
                    ? "border-primary/60 bg-primary/25 text-map-foreground"
                    : "border-white/10 text-map-muted hover:text-map-foreground",
                )}
              >
                {t === "1h" ? "Last 1 hour" : t === "7d" ? "Last 7 days" : t}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="label-xs mb-1 block text-map-muted">Department</span>
          <select
            value={filters.department}
            onChange={(e) => onChange({ ...filters, department: e.target.value })}
            className="w-full rounded border border-white/10 bg-map-deep px-1.5 py-1 text-[11px] text-map-foreground"
          >
            <option value="all">All departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label-xs mb-1 block text-map-muted">Bus route</span>
          <select
            value={filters.route}
            onChange={(e) => onChange({ ...filters, route: e.target.value })}
            className="w-full rounded border border-white/10 bg-map-deep px-1.5 py-1 text-[11px] text-map-foreground"
          >
            <option value="all">All routes</option>
            {BUS_ROUTES.map((r) => (
              <option key={r.id} value={r.id}>
                Route {r.id}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
