
import { apiClient } from "./client";

export interface RoadMetrics {
  model: string;
  frames_sampled: number;
}

export interface RoadAnalysisResponse {
  run_id: string;
  module: string;
  source: string;
  status: "completed" | "failed";
  video: {
    annotated_url?: string | null;
  };
  metrics: RoadMetrics;
  error?: string | null;
}


// ============================================================================
// Types — Traffic AI
// ============================================================================

export interface VehicleTrack {
  track_id: number;
  class_name: "car" | "bus" | "truck" | "motorcycle" | "auto_rickshaw" | "bicycle" | "pedestrian" | string;
  classification_source: "DETECTED" | "INFERRED";
  first_seen_frame: number;
  last_seen_frame: number;
  first_seen_ts: number;
  last_seen_ts: number;
  age_frames: number;
  detection_count: number;
  confirmed: boolean;
  latest_confidence: number;
}

export interface TrafficSummary {
  total_vehicles: number;
  cars: number;
  buses: number;
  trucks: number;
  motorcycles: number;
  auto_rickshaws: number;
  bicycles: number;
  pedestrians: number;
  congestion_level: "LOW" | "MEDIUM" | "HIGH" | "SEVERE" | string;
  frames_processed: number;
  video_duration_sec: number;
}

export interface TrafficMetrics {
  model: string;
  model_checkpoint: string;
  inference_device: string;
  frames_sampled: number;
  target_fps: number;
  processing_time_sec: number;
  unique_tracks: number;
}

export interface TrafficAnalysisResponse {
  run_id: string;
  module: string;
  source: string;
  status: "completed" | "failed";
  video: {
    annotated_url?: string | null;
  };
  detections: VehicleTrack[];
  summary: TrafficSummary;
  metrics: TrafficMetrics;
  error?: string | null;
}

export interface AiHealthResponse {
  status: "ready" | "degraded";
  engine: string;
  sixth_sense_root?: string | null;
  device: string;
  gpu_name?: string | null;
  models: {
    road_model_yolo12s: {
      available: boolean;
      model_file: string;
    };
    traffic_model_yolo11x: {
      available: boolean;
      note: string;
    };
  };
}

// ============================================================================
// API Methods
// ============================================================================

export async function analyzeRoadVideo(
  videoFile: File,
  profile: string = "urban_mvp",
  runId?: string
): Promise<RoadAnalysisResponse> {
  const formData = new FormData();
  formData.append("video", videoFile);
  formData.append("profile", profile);
  if (runId) {
    formData.append("run_id", runId);
  }

  // Uses baseURL/api/road/analyze via baseURL replacement or absolute path
  const response = await apiClient.post<RoadAnalysisResponse>("/api/road/analyze", formData, {
    baseURL: (import.meta.env.VITE_BACKEND_URL as string) || "http://localhost:8000",
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 300000, // 5 min timeout for video inference
  });

  return response.data;
}

export async function getRoadRunResult(runId: string): Promise<RoadAnalysisResponse> {
  const response = await apiClient.get<RoadAnalysisResponse>(`/api/road/runs/${runId}`, {
    baseURL: (import.meta.env.VITE_BACKEND_URL as string) || "http://localhost:8000",
  });
  return response.data;
}

export async function analyzeTrafficVideo(
  videoFile: File,
  profile: string = "urban_mvp",
  runId?: string
): Promise<TrafficAnalysisResponse> {
  const formData = new FormData();
  formData.append("video", videoFile);
  formData.append("profile", profile);
  if (runId) {
    formData.append("run_id", runId);
  }

  const response = await apiClient.post<TrafficAnalysisResponse>("/api/traffic/analyze", formData, {
    baseURL: (import.meta.env.VITE_BACKEND_URL as string) || "http://localhost:8000",
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 300000, // 5 min timeout for video inference
  });

  return response.data;
}

export async function getTrafficRunResult(runId: string): Promise<TrafficAnalysisResponse> {
  const response = await apiClient.get<TrafficAnalysisResponse>(`/api/traffic/runs/${runId}`, {
    baseURL: (import.meta.env.VITE_BACKEND_URL as string) || "http://localhost:8000",
  });
  return response.data;
}

export async function getAiHealth(): Promise<AiHealthResponse> {
  const response = await apiClient.get<{ success: boolean; data: AiHealthResponse }>("/health/ai");
  return response.data.data;
}

