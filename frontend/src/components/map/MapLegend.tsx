/**
 * UrbanEye AI — MapLegend Component
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, Layers, Info } from "lucide-react";
import { useMapStore } from "@/store/mapStore";

export function MapLegend() {
  const [collapsed, setCollapsed] = useState(false);
  const { visibleLayers } = useMapStore();

  return (
    <div className="rounded-lg border border-border bg-card/90 backdrop-blur-md shadow-xl text-[11px] overflow-hidden w-56">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-3 py-2 text-foreground font-semibold border-b border-border/50 hover:bg-secondary/40"
      >
        <span className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" />
          Map Operational Legend
        </span>
        {collapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {!collapsed && (
        <div className="p-2.5 space-y-3">
          {/* Fleet Status */}
          {visibleLayers.buses && (
            <div>
              <span className="block font-medium text-muted-foreground uppercase text-[9px] tracking-wider mb-1">
                Fleet Units
              </span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-foreground">Active Sensing Bus</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-foreground">Standby / Maintenance</span>
                </div>
              </div>
            </div>
          )}

          {/* Event Severity */}
          {visibleLayers.events && (
            <div>
              <span className="block font-medium text-muted-foreground uppercase text-[9px] tracking-wider mb-1">
                Urban Events Severity
              </span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-foreground">Critical Hazard / Near-Miss</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  <span className="text-foreground">High Severity Defect</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-foreground">Medium Severity Issue</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-foreground">Low / Infrastructure</span>
                </div>
              </div>
            </div>
          )}

          {/* Traffic Heatmap */}
          {visibleLayers.congestion && (
            <div>
              <span className="block font-medium text-muted-foreground uppercase text-[9px] tracking-wider mb-1">
                Traffic Congestion Heatmap
              </span>
              <div className="h-2 w-full rounded-full bg-linear-to-r from-blue-500 via-yellow-500 via-orange-500 to-red-600 mb-1" />
              <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                <span>Free Flow</span>
                <span>Severe Delay</span>
              </div>
            </div>
          )}

          {/* Routes */}
          {visibleLayers.routes && (
            <div>
              <span className="block font-medium text-muted-foreground uppercase text-[9px] tracking-wider mb-1">
                Transit Corridors
              </span>
              <div className="flex items-center gap-2">
                <span className="h-0.5 w-4 bg-cyan-400 rounded-full" />
                <span className="text-foreground">Bus Route LineString</span>
              </div>
            </div>
          )}

          {/* Road Conditions */}
          {visibleLayers.roadConditions && (
            <div>
              <span className="block font-medium text-muted-foreground uppercase text-[9px] tracking-wider mb-1">
                Surface Condition
              </span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-3 rounded-xs bg-emerald-500" />
                  <span className="text-foreground">Good Condition (&gt;85%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-3 rounded-xs bg-amber-500" />
                  <span className="text-foreground">Fair / Minor Cracks</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-3 rounded-xs bg-red-500" />
                  <span className="text-foreground">Critical Road Defects</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
