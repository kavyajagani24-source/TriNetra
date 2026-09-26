/**
 * TriNetra — Safety Intelligence API Types (schema v1.0)
 *
 * Mirror of the backend SafetyEvent schema v1.0 as produced by Module 3.
 *
 * NOTE: risk.score is an EXPLAINABLE HEURISTIC (0.0–1.0), NOT a probability.
 * Never display it as "X% probability" in the UI.
 */

// ── Risk types ────────────────────────────────────────────────────────────────

export type RiskLevel = "high" | "medium" | "low";

export interface SafetyRiskBadgeConfig {
  label: string;
  tone: "critical" | "warn" | "ok";
  colorClass: string;
  bgClass: string;
}

export const RISK_LEVEL_CONFIG: Record<RiskLevel, SafetyRiskBadgeConfig> = {
  high: {
    label: "High Risk",
    tone: "critical",
    colorClass: "text-critical",
    bgClass: "bg-critical-soft border-critical/25",
  },
  medium: {
    label: "Medium Risk",
    tone: "warn",
    colorClass: "text-warn",
    bgClass: "bg-warn-soft border-warn/30",
  },
  low: {
    label: "Low Risk",
    tone: "ok",
    colorClass: "text-ok",
    bgClass: "bg-ok-soft border-ok/25",
  },
};

// ── Safety Run ────────────────────────────────────────────────────────────────

export interface SafetyRun {
  id: string;
  job_id: string;
  video_id: string;
  source_video_path: string | null;
  total_frames: number;
  processed_frames: number;
  elapsed_seconds: number;
  processing_fps: number;
  total_events: number;
  events_by_type: Record<string, number> | null;
  annotated_video_path: string | null;
  safety_output_dir: string | null;
  video_fps: number;
  created_at: string;
  updated_at: string;
}

// ── Safety Event (list item — compact) ───────────────────────────────────────

export interface SafetyEventListItem {
  id: string;
  run_id: string;
  video_id: string;
  source_event_id: string;
  event_type: string;
  event_timestamp: string | null;

  frame_index: number;
  start_frame: number;
  end_frame: number;
  duration_frames: number;

  bus_id: string | null;
  camera_id: string | null;

  latitude: number | null;
  longitude: number | null;

  track_id: number | null;
  object_type: string | null;

  risk_level: RiskLevel;
  /** Heuristic risk score 0.0–1.0. NOT a probability. */
  risk_score: number;
  risk_confidence: number;
  risk_reasons: string[] | null;

  in_school_zone: boolean;
  in_crossing_zone: boolean;
  road_entry: boolean;

  trigger_frame_index: number | null;
  peak_frame_index: number | null;

  evidence_frame_urls: string[];
  created_at: string;
}

// ── Safety Event (full detail) ────────────────────────────────────────────────

export interface TrajectoryPoint {
  frame_index: number;
  x: number;
  y: number;
  timestamp_ms?: number | null;
}

export interface SafetyEventDetail extends SafetyEventListItem {
  job_id: string;
  schema_version: string;
  source_video_path: string | null;
  gps_accuracy_m: number | null;
  track_first_frame: number | null;
  track_last_frame: number | null;
  track_age_frames: number | null;

  bbox_x1: number | null;
  bbox_y1: number | null;
  bbox_x2: number | null;
  bbox_y2: number | null;
  bbox_confidence: number | null;

  risk_explanation: string | null;
  /** Raw context flags from the CV module */
  context: Record<string, unknown> | null;

  evidence_frames: string[] | null;
  evidence_clip: string | null;
  trajectory_snapshot: TrajectoryPoint[] | null;

  updated_at: string;
}

// ── Convenience helpers ───────────────────────────────────────────────────────

/** Convert a frame index to a wall-clock timestamp string (mm:ss.fff) */
export function frameToTime(frame: number, fps: number): string {
  const totalSeconds = frame / Math.max(1, fps);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(1);
  return `${String(minutes).padStart(2, "0")}:${seconds.padStart(4, "0")}`;
}

/** Seek position in seconds for a given frame */
export function frameToSeekSeconds(frame: number, fps: number): number {
  return frame / Math.max(1, fps);
}

/** Human-readable event_type label */
export function formatEventType(eventType: string): string {
  return eventType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Consolidated Safety Incident (Official Review Mode) ──────────────────────

export interface SafetyIncident {
  id: string;
  track_id: number | null;
  object_type: string;
  event_type: string;
  title: string;
  issue_description: string;
  action_recommendation: string;

  // Timing
  start_frame: number;
  end_frame: number;
  duration_seconds: number;
  start_time: string;
  end_time: string;

  // Risk
  risk_level: RiskLevel;
  peak_risk_score: number;
  risk_reasons: string[];

  // Context flags
  in_school_zone: boolean;
  in_crossing_zone: boolean;
  road_entry: boolean;

  // Evidence
  primary_evidence_url?: string;
  evidence_frame_urls: string[];
  total_detections: number;

  // Underlying primary event
  primary_event: SafetyEventListItem;
  events: SafetyEventListItem[];
}

/**
 * Consolidates hundreds of raw frame-level CV detections into distinct,
 * actionable VRU incidents grouped by pedestrian track.
 */
export function aggregateEventsToIncidents(
  events: SafetyEventListItem[],
  fps: number = 30
): SafetyIncident[] {
  if (!events || events.length === 0) return [];

  // Group by track_id
  const groups = new Map<string, SafetyEventListItem[]>();

  for (const ev of events) {
    const key = ev.track_id != null ? `track_${ev.track_id}` : `event_${ev.id}`;
    const list = groups.get(key) ?? [];
    list.push(ev);
    groups.set(key, list);
  }

  const incidents: SafetyIncident[] = [];

  for (const [, evList] of groups.entries()) {
    // Peak risk event in group
    const sortedByScore = [...evList].sort((a, b) => b.risk_score - a.risk_score);
    const primary = sortedByScore[0];

    const hasHigh = evList.some((e) => e.risk_level === "high");
    const hasMed = evList.some((e) => e.risk_level === "medium");
    const risk_level: RiskLevel = hasHigh ? "high" : hasMed ? "medium" : "low";

    const peak_risk_score = primary.risk_score;

    const start_frame = Math.min(
      ...evList.map((e) => (e.start_frame > 0 ? e.start_frame : e.frame_index))
    );
    const end_frame = Math.max(
      ...evList.map((e) => (e.end_frame > 0 ? e.end_frame : e.frame_index))
    );
    const duration_frames = Math.max(1, end_frame - start_frame + 1);
    const duration_seconds = duration_frames / Math.max(1, fps);

    const in_school_zone = evList.some((e) => e.in_school_zone);
    const in_crossing_zone = evList.some((e) => e.in_crossing_zone);
    const road_entry = evList.some((e) => e.road_entry);

    // Merge unique risk reasons
    const reasonSet = new Set<string>();
    for (const e of evList) {
      for (const r of e.risk_reasons || []) {
        reasonSet.add(r.replace(/_/g, " "));
      }
    }

    // Merge unique evidence URLs
    const evidenceUrls: string[] = [];
    const seenUrls = new Set<string>();
    for (const e of evList) {
      for (const u of e.evidence_frame_urls || []) {
        if (!seenUrls.has(u)) {
          seenUrls.add(u);
          evidenceUrls.push(u);
        }
      }
    }

    // Clear Plain-English Problem Identification & Action
    let title = "Vulnerable Road User Alert";
    let issue_description = "Pedestrian detected in close proximity to bus transit corridor.";
    let action_recommendation = "Review driver approach speed & braking readiness.";

    if (in_school_zone && in_crossing_zone) {
      title = "School Zone Crosswalk Hazard";
      issue_description = "Pedestrian actively crossing road inside designated school corridor.";
      action_recommendation = "Verify bus yielded right-of-way and adhered to 25 km/h school limit.";
    } else if (in_school_zone) {
      title = "School Zone Pedestrian Proximity";
      issue_description = "Pedestrian moving along roadway edge within school zone perimeter.";
      action_recommendation = "Ensure driver maintained heightened vigilance and adequate curb buffer.";
    } else if (in_crossing_zone) {
      title = "Pedestrian Crosswalk Crossing";
      issue_description = "Pedestrian traversing crosswalk corridor with active bus approach.";
      action_recommendation = "Confirm vehicle was brought to safe speed prior to crosswalk zone.";
    } else if (road_entry) {
      title = "Unscheduled Roadway Entry";
      issue_description = "Pedestrian stepped off sidewalk directly into bus trajectory.";
      action_recommendation = "Inspect emergency braking reaction time and evasive maneuvering.";
    }

    incidents.push({
      id: primary.id,
      track_id: primary.track_id,
      object_type: primary.object_type || "pedestrian",
      event_type: primary.event_type,
      title,
      issue_description,
      action_recommendation,
      start_frame,
      end_frame,
      duration_seconds,
      start_time: frameToTime(start_frame, fps),
      end_time: frameToTime(end_frame, fps),
      risk_level,
      peak_risk_score,
      risk_reasons: Array.from(reasonSet),
      in_school_zone,
      in_crossing_zone,
      road_entry,
      primary_evidence_url: evidenceUrls[0],
      evidence_frame_urls: evidenceUrls,
      total_detections: evList.length,
      primary_event: primary,
      events: evList,
    });
  }

  // Sort: High risk first, then by peak risk score descending
  const rank = { high: 0, medium: 1, low: 2 };
  return incidents.sort((a, b) => {
    if (rank[a.risk_level] !== rank[b.risk_level]) {
      return rank[a.risk_level] - rank[b.risk_level];
    }
    return b.peak_risk_score - a.peak_risk_score;
  });
}
