/**
 * UrbanEye AI — Events API Service
 */

import { apiClient } from "./client";
import type {
  ApiResponse,
  BackendEventStatistics,
  BackendUrbanEvent,
  PaginatedResponse,
} from "@/types/api";

export interface EventFilterParams {
  video_id?: string;
  category?: string;
  event_type?: string;
  severity?: string;
  page?: number;
  limit?: number;
}

export async function getEvents(
  filters?: EventFilterParams
): Promise<PaginatedResponse<BackendUrbanEvent>> {
  const response = await apiClient.get<PaginatedResponse<BackendUrbanEvent>>("/events", {
    params: filters,
  });
  return response.data;
}

export async function getVideoEvents(
  videoId: string,
  filters?: Omit<EventFilterParams, "video_id">
): Promise<PaginatedResponse<BackendUrbanEvent>> {
  const response = await apiClient.get<PaginatedResponse<BackendUrbanEvent>>(
    `/videos/${videoId}/events`,
    { params: filters }
  );
  return response.data;
}

export async function getEvent(id: string): Promise<BackendUrbanEvent> {
  const response = await apiClient.get<ApiResponse<BackendUrbanEvent>>(`/events/${id}`);
  return response.data.data;
}

export async function getEventStatistics(
  videoId?: string
): Promise<BackendEventStatistics> {
  const url = videoId ? `/videos/${videoId}/events/statistics` : "/events/statistics";
  const response = await apiClient.get<ApiResponse<BackendEventStatistics>>(url);
  return response.data.data;
}
