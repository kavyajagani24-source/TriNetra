/**
 * TriNetra — Safety Intelligence API Service
 */

import { apiClient } from "./client";
import type { ApiResponse, PaginatedResponse } from "@/types/api";
import type {
  SafetyEventDetail,
  SafetyEventListItem,
  SafetyRun,
} from "@/types/safety";

export interface SafetyEventFilterParams {
  risk_level?: string | undefined;
  event_type?: string | undefined;
  min_score?: number | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

// ── Runs ──────────────────────────────────────────────────────────────────────

export async function getSafetyRuns(
  page = 1,
  limit = 20
): Promise<PaginatedResponse<SafetyRun>> {
  const response = await apiClient.get<PaginatedResponse<SafetyRun>>(
    "/safety/runs",
    { params: { page, limit } }
  );
  return response.data;
}

export async function getSafetyRunSummary(runId: string): Promise<SafetyRun> {
  const response = await apiClient.get<ApiResponse<SafetyRun>>(
    `/safety/runs/${runId}/summary`
  );
  return response.data.data;
}

export async function getSafetyRunForVideo(videoId: string): Promise<SafetyRun> {
  const response = await apiClient.get<ApiResponse<SafetyRun>>(
    `/safety/videos/${videoId}/run`
  );
  return response.data.data;
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function getSafetyRunEvents(
  runId: string,
  filters?: SafetyEventFilterParams
): Promise<PaginatedResponse<SafetyEventListItem>> {
  const response = await apiClient.get<PaginatedResponse<SafetyEventListItem>>(
    `/safety/runs/${runId}/events`,
    { params: filters }
  );
  return response.data;
}

export async function getSafetyVideoEvents(
  videoId: string,
  filters?: SafetyEventFilterParams
): Promise<PaginatedResponse<SafetyEventListItem>> {
  const response = await apiClient.get<PaginatedResponse<SafetyEventListItem>>(
    `/safety/videos/${videoId}/events`,
    { params: filters }
  );
  return response.data;
}

export async function getSafetyEventDetail(
  eventId: string
): Promise<SafetyEventDetail> {
  const response = await apiClient.get<ApiResponse<SafetyEventDetail>>(
    `/safety/events/${eventId}`
  );
  return response.data.data;
}
