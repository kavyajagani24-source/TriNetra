/**
 * UrbanEye AI — BusPopup Component
 */

import { Bus, Navigation, Gauge, Radio, Calendar, ExternalLink } from "lucide-react";
import type { BusMapProperties } from "@/types/map";
import { formatCoordinates } from "@/utils/formatters";

interface BusPopupProps {
  bus: BusMapProperties;
  onClose: () => void;
  onViewFleet?: (busId: string) => void;
}

export function BusPopup({ bus, onClose, onViewFleet }: BusPopupProps) {
  return (
    <div className="w-72 rounded-lg border border-border bg-card p-3 shadow-2xl text-[12px]">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded bg-primary/20 text-primary">
            <Bus className="h-3.5 w-3.5" />
          </span>
          <div>
            <h4 className="font-bold text-foreground leading-tight">{bus.bus_number}</h4>
            <span className="text-[10px] text-muted-foreground font-mono">
              {bus.registration_number || "No Plate Recorded"}
            </span>
          </div>
        </div>
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
            bus.status === "ACTIVE"
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
          }`}
        >
          {bus.status}
        </span>
      </div>

      <div className="mt-2.5 space-y-1.5 text-muted-foreground">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px]">
            <Radio className="h-3 w-3" /> Route Corridor
          </span>
          <span className="font-medium text-foreground">
            {bus.route_number ? `Route ${bus.route_number}` : "Unassigned"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px]">
            <Gauge className="h-3 w-3" /> Ground Velocity
          </span>
          <span className="font-mono font-medium text-foreground">{bus.speed.toFixed(1)} km/h</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px]">
            <Navigation className="h-3 w-3" /> Heading Vector
          </span>
          <span className="font-mono font-medium text-foreground">{Math.round(bus.heading)}°</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px]">GPS Fix</span>
          <span className="font-mono text-[10px] text-foreground">
            {formatCoordinates(bus.latitude, bus.longitude)}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
        <button
          onClick={onClose}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
        {onViewFleet && (
          <button
            onClick={() => onViewFleet(bus.bus_id)}
            className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20"
          >
            Open Fleet <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
