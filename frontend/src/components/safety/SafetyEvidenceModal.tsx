/**
 * TriNetra — SafetyEvidenceModal
 *
 * Full-screen lightbox for browsing evidence keyframes for a safety event.
 * Keyboard navigable (← → Escape), accessible labels.
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { SafetyEventDetail } from "@/types/safety";
import { formatEventType, frameToTime } from "@/types/safety";
import { RiskLevelBadge } from "./SafetyShared";

interface SafetyEvidenceModalProps {
  event: SafetyEventDetail;
  fps: number;
  initialIndex?: number;
  onClose: () => void;
}

export function SafetyEvidenceModal({
  event,
  fps,
  initialIndex = 0,
  onClose,
}: SafetyEvidenceModalProps) {
  const urls = event.evidence_frame_urls ?? [];
  const [idx, setIdx] = useState(
    Math.min(initialIndex, Math.max(0, urls.length - 1))
  );

  const prev = useCallback(() => {
    setIdx((i) => (i > 0 ? i - 1 : urls.length - 1));
  }, [urls.length]);

  const next = useCallback(() => {
    setIdx((i) => (i < urls.length - 1 ? i + 1 : 0));
  }, [urls.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  if (urls.length === 0) return null;

  const currentUrl = urls[idx];

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={`Evidence for ${formatEventType(event.event_type)}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex max-h-[92vh] max-w-5xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground">
              {formatEventType(event.event_type)}
            </span>
            <RiskLevelBadge level={event.risk_level} />
          </div>
          <div className="flex items-center gap-2">
            <span className="num text-[11px] text-muted-foreground">
              {idx + 1} / {urls.length}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onClose}
              aria-label="Close evidence viewer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main image */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black/60 p-2">
          <img
            key={currentUrl}
            src={currentUrl}
            alt={`Evidence frame ${idx + 1} of ${urls.length}`}
            className="max-h-[60vh] max-w-full rounded object-contain"
          />

          {urls.length > 1 && (
            <>
              <button
                onClick={prev}
                aria-label="Previous frame"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white transition hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={next}
                aria-label="Next frame"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white transition hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          {/* Open in new tab */}
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open full-resolution frame in new tab"
            className="absolute right-3 top-3 rounded bg-black/50 p-1.5 text-white transition hover:bg-black/80"
          >
            <ZoomIn className="h-4 w-4" />
          </a>
        </div>

        {/* Thumbnail strip */}
        {urls.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto border-t border-border bg-card/80 p-2">
            {urls.map((url, i) => (
              <button
                key={url}
                onClick={() => setIdx(i)}
                aria-label={`Frame ${i + 1}`}
                aria-pressed={i === idx}
                className={cn(
                  "h-12 w-16 shrink-0 overflow-hidden rounded border-2 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  i === idx ? "border-primary" : "border-transparent opacity-60 hover:opacity-90"
                )}
              >
                <img
                  src={url}
                  alt={`Thumbnail ${i + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}

        {/* Meta footer */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-card/90 px-4 py-2">
          <span className="num text-[11px] text-muted-foreground">
            ID: {event.source_event_id}
          </span>
          {event.trigger_frame_index != null && (
            <span className="num text-[11px] text-muted-foreground">
              Trigger:{" "}
              <strong className="text-foreground">
                {frameToTime(event.trigger_frame_index, fps)}
              </strong>
            </span>
          )}
          {event.peak_frame_index != null && (
            <span className="num text-[11px] text-muted-foreground">
              Peak:{" "}
              <strong className="text-foreground">
                {frameToTime(event.peak_frame_index, fps)}
              </strong>
            </span>
          )}
          {event.risk_explanation && (
            <p className="w-full text-[11px] italic text-muted-foreground">
              {event.risk_explanation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
