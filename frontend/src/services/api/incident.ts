/**
 * TriNetra — Incident & ANPR AI Service (Person 4)
 * SIH 2026 | PS 26125
 *
 * Client for interacting with the 9-stage Incident & ANPR AI inference pipeline.
 */

import { apiClient } from "./client";

// ============================================================================
// Types
// ============================================================================

export interface CollisionCandidate {
  detected: boolean;
  confidence: number;
  peak_timestamp_sec?: number | null;
  involved_track_ids?: number[];
  operational_tier?: "TIER_1_AUTO_NOTIFY" | "TIER_2_HUMAN_REVIEW" | "TIER_3_BENIGN" | string;
  fused_incident_score?: number;
  pairwise_interaction_score?: number;
  optical_flow_magnitude?: number;
  kinematic_corroboration?: boolean;
  reasoning?: string;
}

export interface AbnormalDrivingEvent {
  track_id: number;
  class_name: string;
  behavior_label: string;
  confidence: number;
  peak_timestamp_sec: number;
  anomalies: string[];
  jerk_mag?: number;
  lateral_swerve_deg?: number;
  max_decel_mps2?: number;
  verdict_explanation?: string;
}

export interface HitAndRunCandidate {
  is_hit_and_run_candidate: boolean;
  fsm_state: string;
  offending_track_id?: number | null;
  victim_track_id?: number | null;
  collision_timestamp?: number;
  departure_timestamp?: number | null;
  departure_velocity_px_s?: number;
  departure_heading?: string | null;
  departure_evidence_summary?: string;
}

export interface PlateInfo {
  track_id: number;
  class_name: string;
  plate_text: string;
  confidence: number;
  status: "DETECTED" | "UNREADABLE" | string;
  best_frame_idx: number;
  crop_path?: string | null;
}

export interface EvidencePacket {
  before_frame?: string;
  during_frame?: string;
  after_frame?: string;
  annotated_video?: string | null;
  annotated_video_url?: string | null;
  manifest_sha256?: string;
  evidence_files?: Record<string, string>;
}

export interface IncidentAlertSummary {
  incident_id: string;
  incident_type: "COLLISION_CANDIDATE" | "HIT_AND_RUN_CANDIDATE" | "ABNORMAL_DRIVING_CANDIDATE" | "NONE" | string;
  status: "REVIEW_REQUIRED" | "NO_INCIDENT" | "CONFIRMED" | "DISMISSED" | "CLOSED" | string;
  confidence: number;
  timestamp: string;
  gps?: { latitude: number; longitude: number } | null;
  vehicle?: { track_id?: number; role?: string; class_name?: string } | null;
  anpr?: { plate_number: string; plate_confidence: number; status: string } | null;
  evidence?: {
    before?: string;
    during?: string;
    after?: string;
    annotated_video?: string;
    manifest?: string;
  };
}

export interface IncidentAnalysisResponse {
  run_id: string;
  timestamp: string;
  gps_coordinates?: { latitude: number; longitude: number } | null;
  collision?: CollisionCandidate;
  abnormal_driving: AbnormalDrivingEvent[];
  hit_and_run?: HitAndRunCandidate;
  anpr: PlateInfo[];
  evidence?: EvidencePacket;
  incident_summary?: IncidentAlertSummary;
  metrics: {
    total_frames: number;
    fps: number;
    duration_s: number;
    processing_time_s: number;
    fps_processing: number;
    device: string;
    tracks_analyzed: number;
    stages_executed: number;
  };
  disclaimer: string;
}

// ============================================================================
// API Methods
// ============================================================================

const BACKEND_BASE = (import.meta.env["VITE_BACKEND_URL"] as string) || "http://localhost:8000";

export async function analyzeIncidentVideo(
  videoFile: File,
  options?: {
    runId?: string;
    gpsLat?: number;
    gpsLon?: number;
    renderVideo?: boolean;
  }
): Promise<IncidentAnalysisResponse> {
  const formData = new FormData();
  formData.append("video", videoFile);
  if (options?.runId) formData.append("run_id", options.runId);
  if (options?.gpsLat != null) formData.append("gps_lat", String(options.gpsLat));
  if (options?.gpsLon != null) formData.append("gps_lon", String(options.gpsLon));
  formData.append("render_video", String(options?.renderVideo ?? true));

  const response = await apiClient.post<IncidentAnalysisResponse>(
    "/api/v1/incident/analyze",
    formData,
    {
      baseURL: BACKEND_BASE,
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 300000, // 5 min timeout for neural inference
    }
  );

  return response.data;
}

export async function getIncidentRun(runId: string): Promise<IncidentAnalysisResponse> {
  const response = await apiClient.get<IncidentAnalysisResponse>(
    `/api/v1/incident/runs/${runId}`,
    { baseURL: BACKEND_BASE }
  );
  return response.data;
}

export async function getIncidentAlerts(): Promise<IncidentAlertSummary[]> {
  const response = await apiClient.get<IncidentAlertSummary[]>(
    "/api/v1/incident/alerts",
    { baseURL: BACKEND_BASE }
  );
  return response.data;
}

export async function getIncidentAlert(runId: string): Promise<IncidentAlertSummary> {
  const response = await apiClient.get<IncidentAlertSummary>(
    `/api/v1/incident/alerts/${runId}`,
    { baseURL: BACKEND_BASE }
  );
  return response.data;
}

export function getIncidentVideoUrl(runId: string): string {
  return `${BACKEND_BASE}/api/v1/incident/runs/${runId}/video`;
}

export function getIncidentArtifactUrl(runId: string, filename: string): string {
  return `${BACKEND_BASE}/api/v1/incident/runs/${runId}/evidence/${filename}`;
}
