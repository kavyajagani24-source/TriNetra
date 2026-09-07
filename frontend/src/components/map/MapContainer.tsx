/**
 * UrbanEye AI — MapContainer Component
 *
 * Command-center container assembling the Master UrbanMap,
 * operational filter bar, map controls, legend, and event evidence viewer.
 */

import { useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { UrbanMap } from "./UrbanMap";
import { MapControls } from "./MapControls";
import { MapFilters } from "./MapFilters";
import { MapLegend } from "./MapLegend";
import { useMapData } from "@/hooks/useMapData";
import { useMapRealtime } from "@/hooks/useMapRealtime";
import { useMapStore } from "@/store/mapStore";
import { EventDetailModal } from "@/components/events/EventDetailModal";
import type { EventMapProperties } from "@/types/map";
import type { BackendUrbanEvent } from "@/types/api";
import { Activity, RefreshCw } from "lucide-react";

export function MapContainer() {
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);

  const {
    busesData,
    eventsData,
    routesData,
    segmentsData,
    heatmapData,
    loading,
    refreshMapData,
  } = useMapData();

  const { realtimeStatus } = useMapStore();
  const [selectedEvidenceEvent, setSelectedEvidenceEvent] = useState<BackendUrbanEvent | null>(null);

  // Realtime WebSocket subscriber
  useMapRealtime({
    onBusUpdate: (busPayload) => {
      // Refresh on real-time update
      refreshMapData();
    },
    onEventCreated: (eventPayload) => {
      refreshMapData();
    },
  });

  // Map Camera Controls
  const handleZoomIn = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn({ duration: 300 });
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut({ duration: 300 });
    }
  }, []);

  const handleResetNorth = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.resetNorthPitch({ duration: 500 });
    }
  }, []);

  const handleFitFleet = useCallback(() => {
    if (!mapInstanceRef.current || !busesData.features.length) return;
    const bounds = new mapboxgl.LngLatBounds();
    busesData.features.forEach((f) => {
      bounds.extend(f.geometry.coordinates as [number, number]);
    });
    mapInstanceRef.current.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 1000 });
  }, [busesData]);

  // Inspect Evidence Package handler
  const handleInspectEvidence = useCallback((eventProps: EventMapProperties) => {
    // Transform to BackendUrbanEvent format for EventDetailModal
    const backendEv: BackendUrbanEvent = {
      id: eventProps.event_id,
      video_id: eventProps.video_id,
      job_id: eventProps.job_id,
      event_type: eventProps.event_type,
      category: eventProps.category,
      severity: eventProps.severity as any,
      confidence: eventProps.confidence,
      frame_number: eventProps.frame_number,
      timestamp: eventProps.timestamp,
      description: eventProps.description,
      extra_metadata: {
        ...(eventProps.extra_metadata || {}),
        evidence_path: eventProps.evidence_url,
      },
      created_at: eventProps.created_at,
      updated_at: eventProps.created_at,
    };
    setSelectedEvidenceEvent(backendEv);
  }, []);

  const criticalCount = eventsData.features.filter(
    (f) => f.properties.severity === "CRITICAL"
  ).length;

  return (
    <div className="relative flex h-full w-full flex-col gap-2 p-2">
      {/* Top Filter & Metric Control Bar */}
      <div className="z-10">
        <MapFilters
          busCount={busesData.features.length}
          eventCount={eventsData.features.length}
          criticalCount={criticalCount}
        />
      </div>

      {/* Main Map Surface */}
      <div className="relative min-h-[480px] flex-1 overflow-hidden rounded-lg border border-border bg-card">
        <UrbanMap
          busesData={busesData}
          eventsData={eventsData}
          routesData={routesData}
          segmentsData={segmentsData}
          heatmapData={heatmapData}
          onMapReady={(m) => {
            mapInstanceRef.current = m;
          }}
          onInspectEvidence={handleInspectEvidence}
        />

        {/* Floating Map Controls (Top Left) */}
        <div className="absolute left-3 top-3 z-20">
          <MapControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetNorth={handleResetNorth}
            onFitFleet={handleFitFleet}
          />
        </div>

        {/* Floating Map Legend (Bottom Left) */}
        <div className="absolute bottom-3 left-3 z-20">
          <MapLegend />
        </div>

        {/* Realtime Status Indicator (Bottom Right) */}
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 rounded-md border border-border bg-card/90 backdrop-blur-md px-2.5 py-1 text-[10px] shadow-lg">
          <div className="flex items-center gap-1.5 font-medium">
            <span
              className={`h-2 w-2 rounded-full ${
                realtimeStatus === "LIVE"
                  ? "bg-emerald-500 animate-pulse"
                  : realtimeStatus === "RECONNECTING"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-muted-foreground"
              }`}
            />
            <span className="text-foreground font-mono font-semibold">
              {realtimeStatus}
            </span>
          </div>
          <span className="text-muted-foreground">·</span>
          <button
            onClick={() => refreshMapData()}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            title="Refresh Data"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Event Detail Evidence Modal */}
      {selectedEvidenceEvent && (
        <EventDetailModal
          event={selectedEvidenceEvent}
          onClose={() => setSelectedEvidenceEvent(null)}
        />
      )}
    </div>
  );
}
