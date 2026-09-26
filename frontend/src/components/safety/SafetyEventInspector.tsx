/**
 * TriNetra — SafetyEventInspector
 *
 * Right-side detail panel opened when a user selects an event from the feed.
 * Shows full metadata, risk breakdown, trajectory mini-map, and evidence gallery.
 */

import { useState } from "react";
import {
  ChevronRight,
  Film,
  Info,
  MapPin,
  Route,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MetaRow, Panel } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import type { SafetyEventDetail } from "@/types/safety";
import { formatEventType, frameToTime } from "@/types/safety";
import {
  ContextFlags,
  EventTypeTag,
  RiskLevelBadge,
  RiskScoreBar,
} from "./SafetyShared";
import { SafetyEvidenceModal } from "./SafetyEvidenceModal";

interface SafetyEventInspectorProps {
  event: SafetyEventDetail;
  fps: number;
  onClose?: () => void;
  className?: string;
}

export function SafetyEventInspector({
  event,
  fps,
  onClose,
  className,
}: SafetyEventInspectorProps) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceStartIdx, setEvidenceStartIdx] = useState(0);

  const openEvidence = (idx = 0) => {
    setEvidenceStartIdx(idx);
    setEvidenceOpen(true);
  };

  return (
    <>
      <div className={cn("flex flex-col divide-y divide-border", className)}>
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-2 px-3 py-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <EventTypeTag eventType={event.event_type} />
              <RiskLevelBadge level={event.risk_level} />
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {event.source_event_id}
            </p>
          </div>
          {onClose && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-[11px]"
              onClick={onClose}
            >
              Close
            </Button>
          )}
        </div>

        {/* ── Risk Analysis ─────────────────────────────────────────────── */}
        <div className="px-3 py-2.5 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Risk Assessment
          </p>
          <RiskScoreBar score={event.risk_score} level={event.risk_level} />

          {event.risk_reasons && event.risk_reasons.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {event.risk_reasons.map((r, i) => (
                <li
                  key={i}
                  className="flex items-start gap-1 text-[11px] text-foreground"
                >
                  <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                  {r}
                </li>
              ))}
            </ul>
          )}

          {event.risk_explanation && (
            <p className="mt-1 rounded bg-muted/50 px-2 py-1.5 text-[11px] italic text-muted-foreground">
              "{event.risk_explanation}"
            </p>
          )}

          <ContextFlags event={event} />
        </div>

        {/* ── Evidence Frames ───────────────────────────────────────────── */}
        {event.evidence_frame_urls.length > 0 && (
          <div className="px-3 py-2.5 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Film className="h-3 w-3" aria-hidden />
              Evidence Frames ({event.evidence_frame_urls.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {event.evidence_frame_urls.map((url, i) => (
                <button
                  key={url}
                  onClick={() => openEvidence(i)}
                  aria-label={`View evidence frame ${i + 1}`}
                  className="h-16 w-[84px] overflow-hidden rounded border border-border bg-muted transition hover:border-primary hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <img
                    src={url}
                    alt={`Evidence frame ${i + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Timing metadata ───────────────────────────────────────────── */}
        <div className="px-3 py-2.5 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" aria-hidden />
            Timing & Tracking
          </p>
          <dl>
            <MetaRow label="Start frame" value={`#${event.start_frame} (${frameToTime(event.start_frame, fps)})`} />
            <MetaRow label="End frame" value={`#${event.end_frame} (${frameToTime(event.end_frame, fps)})`} />
            <MetaRow label="Duration" value={`${event.duration_frames} frames`} />
            {event.trigger_frame_index != null && (
              <MetaRow label="Trigger frame" value={`#${event.trigger_frame_index} (${frameToTime(event.trigger_frame_index, fps)})`} />
            )}
            {event.peak_frame_index != null && (
              <MetaRow label="Peak frame" value={`#${event.peak_frame_index} (${frameToTime(event.peak_frame_index, fps)})`} />
            )}
            {event.track_id != null && (
              <MetaRow label="Track ID" value={`#${event.track_id}${event.object_type ? ` (${event.object_type})` : ""}`} />
            )}
            {event.track_age_frames != null && (
              <MetaRow label="Track age" value={`${event.track_age_frames} frames`} />
            )}
            {event.bus_id && <MetaRow label="Bus" value={event.bus_id} />}
            {event.camera_id && <MetaRow label="Camera" value={event.camera_id} />}
          </dl>
        </div>

        {/* ── Location ──────────────────────────────────────────────────── */}
        {(event.latitude != null || event.longitude != null) && (
          <div className="px-3 py-2.5 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden />
              Location
            </p>
            <dl>
              {event.latitude != null && (
                <MetaRow label="Latitude" value={event.latitude.toFixed(6)} />
              )}
              {event.longitude != null && (
                <MetaRow label="Longitude" value={event.longitude.toFixed(6)} />
              )}
              {event.gps_accuracy_m != null && (
                <MetaRow label="GPS accuracy" value={`±${event.gps_accuracy_m}m`} />
              )}
            </dl>
          </div>
        )}

        {/* ── Trajectory Snapshot ───────────────────────────────────────── */}
        {event.trajectory_snapshot && event.trajectory_snapshot.length > 0 && (
          <div className="px-3 py-2.5 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Route className="h-3 w-3" aria-hidden />
              Trajectory ({event.trajectory_snapshot.length} points)
            </p>
            <TrajectorySVG
              points={event.trajectory_snapshot as { x: number; y: number; frame_index: number }[]}
            />
          </div>
        )}
      </div>

      {/* Evidence modal */}
      {evidenceOpen && (
        <SafetyEvidenceModal
          event={event}
          fps={fps}
          initialIndex={evidenceStartIdx}
          onClose={() => setEvidenceOpen(false)}
        />
      )}
    </>
  );
}

// ── Tiny trajectory SVG mini-map ──────────────────────────────────────────────

function TrajectorySVG({
  points,
}: {
  points: { x: number; y: number; frame_index: number }[];
}) {
  if (points.length < 2) return null;

  const W = 200;
  const H = 100;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const pad = 8;

  const scale = (v: number, min: number, range: number, dim: number) =>
    pad + ((v - min) / range) * (dim - pad * 2);

  const pathD = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${scale(p.x, minX, rangeX, W).toFixed(1)} ${scale(p.y, minY, rangeY, H).toFixed(1)}`
    )
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;

  const lastX = scale(last.x, minX, rangeX, W);
  const lastY = scale(last.y, minY, rangeY, H);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      className="rounded border border-border bg-muted/30"
      role="img"
      aria-label="Object trajectory path"
    >
      <path
        d={pathD}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      {/* Start dot */}
      <circle
        cx={scale(first.x, minX, rangeX, W)}
        cy={scale(first.y, minY, rangeY, H)}
        r={3}
        fill="var(--ok)"
      />
      {/* End dot */}
      <circle cx={lastX} cy={lastY} r={3} fill="var(--critical)" />
    </svg>
  );
}
