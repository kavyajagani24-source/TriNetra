import {
  AlertTriangle,
  Bus,
  Flame,
  MapPin,
  School,
  ShieldAlert,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PedestrianHotspot } from "@/types/safetyHotspots";

interface SafetyHotspotCardProps {
  hotspot: PedestrianHotspot;
  isSelected?: boolean;
  onSelect: (hotspot: PedestrianHotspot) => void;
}

export function SafetyHotspotCard({
  hotspot,
  isSelected = false,
  onSelect,
}: SafetyHotspotCardProps) {
  const isHigh = hotspot.movement_density === "high";
  const isMed = hotspot.movement_density === "medium";

  return (
    <div
      onClick={() => onSelect(hotspot)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(hotspot);
        }
      }}
      className={cn(
        "group relative w-full cursor-pointer rounded-xl border text-left transition-all overflow-hidden p-3 select-none",
        isSelected
          ? "border-primary bg-primary/[0.05] shadow-md ring-1 ring-primary/40"
          : "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/20 hover:shadow-sm"
      )}
      aria-pressed={isSelected}
      aria-label={`Hotspot: ${hotspot.name}, ${hotspot.movement_density} movement`}
    >
      {/* Left Accent Color Indicator */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1.5",
          isHigh ? "bg-critical" : isMed ? "bg-warn" : "bg-ok"
        )}
        aria-hidden
      />

      <div className="flex flex-col gap-2 pl-1.5">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-bold text-foreground leading-snug truncate">
              {hotspot.name}
            </h3>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono mt-0.5">
              <MapPin className="h-2.5 w-2.5 opacity-60" />
              <span className="capitalize">{hotspot.zone_type.replace(/_/g, " ")}</span>
            </div>
          </div>

          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0",
              isHigh
                ? "bg-critical/15 text-critical border border-critical/30"
                : isMed
                  ? "bg-warn/15 text-warn border border-warn/30"
                  : "bg-ok/15 text-ok border border-ok/30"
            )}
          >
            <Flame className="h-2.5 w-2.5" />
            {hotspot.movement_density}
          </span>
        </div>

        {/* Footfall & Conflicts stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-md bg-muted/30 px-2 py-1">
            <Users className="h-3 w-3 text-primary opacity-80" />
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold text-foreground font-mono">
                {hotspot.pedestrians_per_hour.toLocaleString()}
              </div>
              <div className="text-[8px] uppercase tracking-tight text-muted-foreground font-semibold">
                Peds / Hour
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-md bg-muted/30 px-2 py-1">
            <ShieldAlert className="h-3 w-3 text-critical opacity-80" />
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold text-critical font-mono">
                {hotspot.near_miss_count}
              </div>
              <div className="text-[8px] uppercase tracking-tight text-muted-foreground font-semibold">
                Near-Misses
              </div>
            </div>
          </div>
        </div>

        {/* Tags footer */}
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          {hotspot.active_school_zone && (
            <span className="rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 text-[9px] font-semibold flex items-center gap-0.5">
              <School className="h-2.5 w-2.5" />
              School Zone
            </span>
          )}

          {hotspot.bus_routes_affected.slice(0, 2).map((r) => (
            <span
              key={r}
              className="rounded bg-primary/10 text-primary px-1.5 py-0.2 text-[9px] font-mono font-semibold"
            >
              {r}
            </span>
          ))}

          {hotspot.bus_routes_affected.length > 2 && (
            <span className="text-[9px] text-muted-foreground font-mono">
              +{hotspot.bus_routes_affected.length - 2} routes
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
