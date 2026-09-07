/**
 * UrbanEye AI — EventPopup Component
 */

import { AlertTriangle, Clock, Eye, FileText, Layers, Shield } from "lucide-react";
import type { EventMapProperties } from "@/types/map";
import {
  getEventTypeLabel,
  getEventCategoryLabel,
  getSeverityClasses,
  getCategoryClasses,
} from "@/utils/eventUtils";
import { formatConfidence, formatDuration } from "@/utils/formatters";

interface EventPopupProps {
  event: EventMapProperties;
  onClose: () => void;
  onInspectEvidence?: (event: EventMapProperties) => void;
}

export function EventPopup({ event, onClose, onInspectEvidence }: EventPopupProps) {
  const sev = getSeverityClasses(event.severity);

  return (
    <div className="w-80 rounded-lg border border-border bg-card p-3 shadow-2xl text-[12px]">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${sev.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
            {event.severity}
          </span>
          <span className={`rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${getCategoryClasses(event.category)}`}>
            {getEventCategoryLabel(event.category)}
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatConfidence(event.confidence)}
        </span>
      </div>

      <div className="mt-2">
        <h4 className="font-bold text-foreground text-[13px] leading-snug">
          {getEventTypeLabel(event.event_type)}
        </h4>
        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
          {event.description}
        </p>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-1 rounded bg-secondary/40 p-2 text-[10px] text-muted-foreground">
        <div>
          <span className="block text-[9px] uppercase tracking-wider text-muted-foreground/70">Frame</span>
          <span className="font-mono font-medium text-foreground">#{event.frame_number}</span>
        </div>
        <div>
          <span className="block text-[9px] uppercase tracking-wider text-muted-foreground/70">Video Run</span>
          <span className="font-mono font-medium text-foreground">T+{formatDuration(event.timestamp)}</span>
        </div>
        {event.bus_id && (
          <div className="col-span-2 mt-1">
            <span className="block text-[9px] uppercase tracking-wider text-muted-foreground/70">Sensing Unit</span>
            <span className="font-mono font-medium text-primary">{event.bus_id}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
        <button
          onClick={onClose}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
        {onInspectEvidence && (
          <button
            onClick={() => onInspectEvidence(event)}
            className="inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
          >
            <Eye className="h-3 w-3" />
            Inspect Evidence
          </button>
        )}
      </div>
    </div>
  );
}
