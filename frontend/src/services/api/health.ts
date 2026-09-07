/**
 * UrbanEye AI — Health Check API Service
 */

import { apiClient } from "./client";
import type { ApiResponse, BackendHealthResponse } from "@/types/api";

export async function checkHealth(): Promise<BackendHealthResponse> {
  const response = await apiClient.get<ApiResponse<BackendHealthResponse>>("/health");
  return response.data.data;
}

export async function checkDatabaseHealth(): Promise<{ status: string; database: string }> {
  const response = await apiClient.get<ApiResponse<{ status: string; database: string }>>(
    "/health/database"
  );
  return response.data.data;
}
