/**
 * UrbanEye AI — Traffic Analytics API Service
 */

import { apiClient } from "./client";
import type {
  ApiResponse,
  BackendJobResults,
  BackendTrafficAnalytics,
  PaginatedResponse,
} from "@/types/api";

export async function getVideoAnalytics(
  videoId: string,
  params?: { page?: number; limit?: number }
): Promise<PaginatedResponse<BackendTrafficAnalytics>> {
  const response = await apiClient.get<PaginatedResponse<BackendTrafficAnalytics>>(
    `/videos/${videoId}/analytics`,
    { params }
  );
  return response.data;
}

export async function getJobResults(jobId: string): Promise<BackendJobResults> {
  const response = await apiClient.get<ApiResponse<BackendJobResults>>(
    `/processing/${jobId}/results`
  );
  return response.data.data;
}
