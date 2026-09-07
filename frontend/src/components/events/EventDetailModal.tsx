import { useState } from "react";
import {
  X,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
  Shield,
  Layers,
  FileText,
  Activity,
  Maximize2,
} from "lucide-react";
import { toast } from "sonner";
import type { BackendUrbanEvent } from "@/types/api";
import {
  getEventTypeLabel,
  getEventCategoryLabel,
  getSeverityClasses,
  getCategoryClasses,
} from "@/utils/eventUtils";
import { formatCoordinates, formatConfidence, formatDuration, formatDate } from "@/utils/formatters";
import { resolveMediaUrl } from "@/services/storage/storageService";

interface EventDetailModalProps {
  event: BackendUrbanEvent | null;
  onClose: () => void;
}

export function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  const [imageError, setImageError] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 1920, height: 1080 });
  const [showRawJson, setShowRawJson] = useState(false);

  if (!event) return null;

  const severityClasses = getSeverityClasses(event.severity);
  const evidencePath =
    (event.extra_metadata?.evidence_path as string) ||
    (event.extra_metadata?.snapshot_url as string) ||
    (event.extra_metadata?.image_url as string) ||
    `evidence/ev_${event.job_id}_frame_${event.frame_number}.jpg`;

  const mediaUrl = evidencePath ? resolveMediaUrl(evidencePath) : null;

  const copyId = () => {
    navigator.clipboard.writeText(event.id);
    toast.success("Event ID copied to clipboard");
  };

  const hasBbox =
    event.bbox_x1 !== undefined &&
    event.bbox_x1 !== null &&
    event.bbox_y1 !== undefined &&
    event.bbox_y1 !== null &&
    event.bbox_x2 !== undefined &&
    event.bbox_x2 !== null &&
    event.bbox_y2 !== undefined &&
    event.bbox_y2 !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-secondary/30">
          <div className="flex items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${severityClasses.badge}`}
            >
              <span className={`h-2 w-2 rounded-full ${severityClasses.dot}`} />
              {event.severity}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider border ${getCategoryClasses(
                event.category
              )}`}
            >
              {getEventCategoryLabel(event.category)}
            </span>
            <h2 className="text-[15px] font-semibold text-foreground">
              {getEventTypeLabel(event.event_type)}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Left: Evidence Frame / Image */}
            <div className="lg:col-span-7 flex flex-col gap-2">
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black/90 flex items-center justify-center">
                {mediaUrl && !imageError ? (
                  <div className="relative h-full w-full">
                    <img
                      src={mediaUrl}
                      alt={event.description || "Event Evidence Frame"}
                      onLoad={(loadedEvent) => {
                        setImageSize({
                          width: loadedEvent.currentTarget.naturalWidth || 1920,
                          height: loadedEvent.currentTarget.naturalHeight || 1080,
                        });
                      }}
                      onError={() => setImageError(true)}
                      className="h-full w-full object-contain"
                    />
                    {/* Visual Bounding Box indicator if pixel/relative dimensions available */}
                    {hasBbox && (
                      <div
                        className="absolute border-2 border-primary bg-primary/20 pointer-events-none rounded-xs"
                        style={{
                          left: `${(event.bbox_x1! / imageSize.width) * 100}%`,
                          top: `${(event.bbox_y1! / imageSize.height) * 100}%`,
                          width: `${((event.bbox_x2! - event.bbox_x1!) / imageSize.width) * 100}%`,
                          height: `${((event.bbox_y2! - event.bbox_y1!) / imageSize.height) * 100}%`,
                        }}
                      >
                        <span className="absolute -top-4 left-0 rounded bg-primary px-1 py-0.2 text-[9px] font-bold text-primary-foreground">
                          {getEventTypeLabel(event.event_type)}
                        </span>
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 rounded bg-black/80 px-2 py-0.5 text-[10px] font-mono text-white/90">
                      Frame #{event.frame_number} · T+{formatDuration(event.timestamp)}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                    <Activity className="h-10 w-10 text-muted-foreground/40 mb-2 animate-pulse" />
                    <p className="text-[13px] font-medium text-foreground">Evidence Telemetry Frame</p>
                    <p className="text-[11px] text-muted-foreground max-w-xs mt-1">
                      Target detection captured at frame #{event.frame_number} (T+{formatDuration(event.timestamp)}).
                    </p>
                    {hasBbox && (
                      <div className="mt-2 text-[10px] font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                        Bounding Box: [{event.bbox_x1}, {event.bbox_y1}] - [{event.bbox_x2}, {event.bbox_y2}]
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Confidence Meter */}
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-muted-foreground">AI Detection Confidence</span>
                  <span className="font-bold text-foreground">{formatConfidence(event.confidence)}</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full ${
                      event.confidence >= 0.8
                        ? "bg-emerald-500"
                        : event.confidence >= 0.5
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${Math.round(event.confidence * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Right: Detailed Metadata */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Incident Intelligence
                </span>
                <p className="text-[13px] text-foreground font-medium leading-snug">
                  {event.description || "No algorithmic description provided."}
                </p>

                <div className="divide-y divide-border/60 pt-2 text-[12px]">
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> Event ID
                    </span>
                    <button
                      onClick={copyId}
                      className="font-mono text-[11px] text-primary hover:underline flex items-center gap-1"
                    >
                      {event.id.substring(0, 10)}... <Copy className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Video Timestamp
                    </span>
                    <span className="font-mono font-medium text-foreground">
                      T+{formatDuration(event.timestamp)} ({event.timestamp.toFixed(2)}s)
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" /> Video Frame
                    </span>
                    <span className="font-mono font-medium text-foreground">
                      #{event.frame_number}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> Location (GPS)
                    </span>
                    <span className="font-mono font-medium text-foreground">
                      {event.latitude && event.longitude
                        ? formatCoordinates(event.latitude, event.longitude)
                        : "Extrapolated from Route"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> Detected At
                    </span>
                    <span className="text-foreground">{formatDate(event.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Extra Metadata Inspection */}
              <div className="rounded-lg border border-border bg-card p-3">
                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  <span>Sensor & Tracking Telemetry</span>
                  <span className="text-primary text-[11px]">
                    {showRawJson ? "Hide Data" : "View Raw Telemetry"}
                  </span>
                </button>
                {showRawJson && (
                  <pre className="mt-2 max-h-44 overflow-y-auto rounded bg-secondary/50 p-2 font-mono text-[10px] text-muted-foreground">
                    {JSON.stringify(event.extra_metadata || {}, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 bg-secondary/20">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Shield className="h-3.5 w-3.5 text-primary" />
            Corroborated by UrbanEye AI Computer Vision Pipeline
          </div>
          <button
            onClick={onClose}
            className="rounded border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
