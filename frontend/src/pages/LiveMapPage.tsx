import { MapPinned, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/primitives";
import { MapContainer } from "@/components/map/MapContainer";

export function LiveMapPage() {
  return (
    <AppShell>
      <PageHeader
        title="GIS Operations Command Center"
        subtitle="Live telemetry, WebGL fleet clustering, road hazard geospatial analytics, and congestion corridor monitoring."
        actions={
          <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground md:inline-flex">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            Powered by Mapbox GL JS & PostGIS Spatial Engine
          </span>
        }
      />
      <div className="min-h-0 flex-1 overflow-hidden bg-background">
        <MapContainer />
      </div>
    </AppShell>
  );
}
