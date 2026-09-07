/**
 * UrbanEye AI — MapControls Component
 */

import { Plus, Minus, Compass, Maximize, Crosshair, Map as MapIcon, Globe } from "lucide-react";
import { useMapStore } from "@/store/mapStore";

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetNorth: () => void;
  onFitFleet: () => void;
  onToggleFullscreen?: () => void;
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onResetNorth,
  onFitFleet,
  onToggleFullscreen,
}: MapControlsProps) {
  const { mapStyle, setMapStyle } = useMapStore();

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-md p-1 shadow-xl">
      {/* Zoom In */}
      <button
        onClick={onZoomIn}
        aria-label="Zoom in"
        title="Zoom In"
        className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
      >
        <Plus className="h-4 w-4" />
      </button>

      {/* Zoom Out */}
      <button
        onClick={onZoomOut}
        aria-label="Zoom out"
        title="Zoom Out"
        className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
      >
        <Minus className="h-4 w-4" />
      </button>

      <div className="my-0.5 h-px bg-border/60" />

      {/* Fit Fleet */}
      <button
        onClick={onFitFleet}
        aria-label="Fit map to active fleet"
        title="Fit Map to Fleet"
        className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
      >
        <Crosshair className="h-4 w-4" />
      </button>

      {/* Reset Compass */}
      <button
        onClick={onResetNorth}
        aria-label="Reset orientation to north"
        title="Reset North"
        className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
      >
        <Compass className="h-4 w-4" />
      </button>

      <div className="my-0.5 h-px bg-border/60" />

      {/* Style Toggle (Streets / Satellite) */}
      <button
        onClick={() => setMapStyle(mapStyle === "streets" ? "satellite" : "streets")}
        aria-label="Toggle between dark streets and satellite imagery"
        title={mapStyle === "streets" ? "Switch to Satellite" : "Switch to Streets"}
        className={`grid h-7 w-7 place-items-center rounded transition-colors ${
          mapStyle === "satellite"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        {mapStyle === "streets" ? <Globe className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}
      </button>

      {/* Fullscreen */}
      {onToggleFullscreen && (
        <button
          onClick={onToggleFullscreen}
          aria-label="Toggle fullscreen view"
          title="Toggle Fullscreen"
          className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Maximize className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
