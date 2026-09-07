/**
 * UrbanEye AI — Backend API Contracts & Data Models
 *
 * Types mapping directly to the FastAPI responses:
 * Buses, Videos, Processing Jobs, Detections, Trajectories,
 * Analytics, and Urban Events.
 */

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message?: string;
  data: T[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ApiError {
  message: string;
  status?: number;
  details?: unknown;
}

// ── Bus Entity ────────────────────────────────────────────────────────────────

export type BusStatus = "ACTIVE" | "INACTIVE" | "OFFLINE";

export interface BackendBus {
  id: string;
  bus_number: string;
  registration_number: string;
  route_number: string;
  status: BusStatus;
  created_at: string;
  updated_at: string;
}

export interface BusCreatePayload {
  bus_number: string;
  registration_number: string;
  route_number: string;
  status?: BusStatus;
}

export interface BusUpdatePayload {
  bus_number?: string;
  registration_number?: string;
  route_number?: string;
  status?: BusStatus;
}

// ── Video Entity ──────────────────────────────────────────────────────────────

export type VideoStatus =
  | "UPLOADED"
  | "QUEUED"
  | "PROCESSING"
  | "READY"
  | "COMPLETED"
  | "FAILED";

export interface BackendVideo {
  id: string;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  format?: string | null;
  fps?: number | null;
  frame_count?: number | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  status: VideoStatus;
  bus_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
  updated_at: string;
}

// ── Processing Job Entity ─────────────────────────────────────────────────────

export type ProcessingStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface BackendProcessingJob {
  id: string;
  video_id: string;
  status: ProcessingStatus;
  progress_percentage: number;
  frames_processed: number;
  total_frames: number;
  events_detected: number;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoProcessingStatusResponse {
  video_id: string;
  video_status: VideoStatus;
  active_job_id?: string | null;
  job_status?: ProcessingStatus | null;
  progress_percentage: number;
  frames_processed: number;
  total_frames: number;
  events_detected: number;
  error_message?: string | null;
}

// ── Urban Event Entity (Phase 3) ──────────────────────────────────────────────

export type EventCategory =
  | "HAZARD"
  | "INFRASTRUCTURE"
  | "SAFETY"
  | "BEHAVIOR"
  | "INCIDENT";

export type EventSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface BackendUrbanEvent {
  id: string;
  video_id: string;
  job_id: string;
  event_type: string;
  category: EventCategory | string;
  severity: EventSeverity;
  confidence: number;
  frame_number: number;
  timestamp: number;
  bbox_x1?: number | null;
  bbox_y1?: number | null;
  bbox_x2?: number | null;
  bbox_y2?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  description: string;
  extra_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BackendEventStatistics {
  total_events: number;
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
  by_event_type: Record<string, number>;
}

// ── Traffic Analytics ─────────────────────────────────────────────────────────

export interface BackendTrafficAnalytics {
  id: string;
  video_id: string;
  job_id: string;
  timestamp: number;
  frame_number: number;
  active_vehicle_count: number;
  car_count: number;
  motorcycle_count: number;
  bus_count: number;
  truck_count: number;
  person_count: number;
  average_pixel_speed: number;
  traffic_density: "LOW" | "MEDIUM" | "HIGH" | "SEVERE";
  congestion_level: "LOW" | "MODERATE" | "HIGH" | "SEVERE";
  created_at: string;
}

export interface BackendJobResults {
  job_id: string;
  video_id: string;
  status: string;
  total_unique_vehicles: number;
  vehicle_counts_by_class: Record<string, number>;
  peak_density: string;
  avg_congestion_level: string;
  total_detections: number;
  annotated_video_url?: string | null;
  evidence_images: string[];
}

// ── Health ────────────────────────────────────────────────────────────────────

export interface BackendHealthResponse {
  status: string;
  service: string;
  version: string;
  environment: string;
}
