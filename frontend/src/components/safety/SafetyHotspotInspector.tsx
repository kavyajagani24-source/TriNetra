import { useState } from "react";
import {
  AlertTriangle,
  Bus,
  CheckCircle2,
  Clock,
  Eye,
  Flame,
  Info,
  Layers,
  MapPin,
  Play,
  Route,
  School,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PedestrianHotspot } from "@/types/safetyHotspots";
import type { SafetyIncident } from "@/types/safety";

interface SafetyHotspotInspectorProps {
  hotspot: PedestrianHotspot;
  linkedIncidents?: SafetyIncident[];
  onViewIncidentInVideo?: (incident: SafetyIncident) => void;
  onClose?: () => void;
}

export function SafetyHotspotInspector({
  hotspot,
  linkedIncidents = [],
  onViewIncidentInVideo,
  onClose,
}: SafetyHotspotInspectorProps) {
  const isHigh = hotspot.movement_density === "high";
  const isMed = hotspot.movement_density === "medium";

  return (
    <div className="flex flex-col divide-y divide-border text-foreground">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="p-4 bg-muted/10 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  isHigh
                    ? "bg-critical/15 text-critical border border-critical/30"
                    : isMed
                      ? "bg-warn/15 text-warn border border-warn/30"
                      : "bg-ok/15 text-ok border border-ok/30"
                )}
              >
                <Flame className="h-3 w-3" />
                {hotspot.movement_density} Movement Density
              </span>

              {hotspot.active_school_zone && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold">
                  <School className="h-3 w-3" />
                  School Zone Active
                </span>
              )}
            </div>

            <h2 className="text-base font-bold text-foreground leading-snug">
              {hotspot.name}
            </h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <MapPin className="h-3 w-3 opacity-70" />
              <span>
                {hotspot.coordinates[1].toFixed(4)}°N, {hotspot.coordinates[0].toFixed(4)}°E
              </span>
              <span className="opacity-40">·</span>
              <span className="capitalize">{hotspot.zone_type.replace(/_/g, " ")}</span>
            </div>
          </div>

          {onClose && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
              onClick={onClose}
              aria-label="Close hotspot inspector"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed pt-1">
          {hotspot.description}
        </p>
      </div>

      {/* ── Key Movement & Conflict Metrics ──────────────────────────────── */}
      <div className="p-4 grid grid-cols-2 gap-2.5 bg-card">
        <div className="rounded-lg border border-border bg-muted/20 p-2.5 space-y-0.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3 text-primary" />
            Pedestrian Flow
          </div>
          <div className="text-lg font-extrabold text-foreground">
            {hotspot.pedestrians_per_hour.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground">pedestrians / hour (peak)</div>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-2.5 space-y-0.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <ShieldAlert className="h-3 w-3 text-critical" />
            Near-Misses Logged
          </div>
          <div className="text-lg font-extrabold text-critical">
            {hotspot.near_miss_count}
          </div>
          <div className="text-[10px] text-muted-foreground">conflicts recorded</div>
        </div>
      </div>

      {/* ── Peak Hours & Bus Transit Exposure ────────────────────────────── */}
      <div className="p-4 space-y-3 bg-muted/5">
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-primary" />
            Peak Density Windows
          </span>
          <p className="text-xs font-mono font-semibold text-foreground bg-muted/40 rounded px-2 py-1">
            {hotspot.peak_hours}
          </p>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Bus className="h-3.5 w-3.5 text-primary" />
            Affected Bus Fleet Routes
          </span>
          <div className="flex flex-wrap gap-1.5">
            {hotspot.bus_routes_affected.map((rt) => (
              <span
                key={rt}
                className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-bold font-mono text-primary"
              >
                Route {rt}
              </span>
            ))}
          </div>
        </div>

        {/* Hazard Conflict Factors */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-warn" />
            Identified Conflict Patterns
          </span>
          <ul className="space-y-1">
            {hotspot.conflict_types.map((c, i) => (
              <li
                key={i}
                className="text-[11px] text-foreground/90 flex items-start gap-1.5 leading-snug"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-warn mt-1 shrink-0" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Recommended Municipal Action ─────────────────────────────────── */}
      <div className="p-4 space-y-2 bg-card">
        <div className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Recommended Safety Engineering Mitigation
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground leading-relaxed">
          {hotspot.recommended_action}
        </div>
      </div>

      {/* ── Correlated Video Incidents (if any) ───────────────────────────── */}
      {linkedIncidents.length > 0 && (
        <div className="p-4 space-y-2.5 bg-muted/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-primary" />
              Linked Video Incidents ({linkedIncidents.length})
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              From Active Run
            </span>
          </div>

          <div className="space-y-2">
            {linkedIncidents.map((inc) => (
              <div
                key={inc.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2.5 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground truncate">
                    {inc.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {inc.start_time} · Pedestrian #{inc.track_id}
                  </div>
                </div>

                {onViewIncidentInVideo && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-[11px] font-semibold text-primary border-primary/40 hover:bg-primary/10 shrink-0"
                    onClick={() => onViewIncidentInVideo(inc)}
                  >
                    <Play className="h-3 w-3 fill-current" />
                    Inspect Video
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
