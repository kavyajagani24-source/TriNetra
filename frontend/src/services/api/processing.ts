/**
 * UrbanEye AI — Processing Job API Service
 */

import { apiClient } from "./client";
import type {
  ApiResponse,
  BackendJobResults,
  BackendProcessingJob,
  VideoProcessingStatusResponse,
} from "@/types/api";

export async function getProcessingJob(jobId: string): Promise<BackendProcessingJob> {
  const response = await apiClient.get<ApiResponse<BackendProcessingJob>>(
    `/processing/${jobId}`
  );
  return response.data.data;
}

export async function getProcessingResults(jobId: string): Promise<BackendJobResults> {
  const response = await apiClient.get<ApiResponse<BackendJobResults>>(
    `/processing/${jobId}/results`
  );
  return response.data.data;
}

export async function getVideoProcessingStatus(
  videoId: string
): Promise<VideoProcessingStatusResponse> {
  const response = await apiClient.get<ApiResponse<VideoProcessingStatusResponse>>(
    `/videos/${videoId}/status`
  );
  return response.data.data;
}
