/**
 * UrbanEye AI — Video API Service
 */

import { apiClient } from "./client";
import type {
  ApiResponse,
  BackendVideo,
  PaginatedResponse,
  VideoProcessingStatusResponse,
} from "@/types/api";

export async function getVideos(params?: {
  page?: number;
  limit?: number;
  status?: string;
  bus_id?: string;
}): Promise<PaginatedResponse<BackendVideo>> {
  const response = await apiClient.get<PaginatedResponse<BackendVideo>>("/videos", {
    params,
  });
  return response.data;
}

export async function getVideo(id: string): Promise<BackendVideo> {
  const response = await apiClient.get<ApiResponse<BackendVideo>>(`/videos/${id}`);
  return response.data.data;
}

export async function uploadVideo(
  file: File,
  options?: {
    bus_id?: string;
    latitude?: number;
    longitude?: number;
    onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void;
  }
): Promise<BackendVideo> {
  const formData = new FormData();
  formData.append("file", file);
  if (options?.bus_id) {
    formData.append("bus_id", options.bus_id);
  }
  if (options?.latitude !== undefined && options.latitude !== null) {
    formData.append("latitude", options.latitude.toString());
  }
  if (options?.longitude !== undefined && options.longitude !== null) {
    formData.append("longitude", options.longitude.toString());
  }

  const response = await apiClient.post<ApiResponse<BackendVideo>>(
    "/videos/upload",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: options?.onUploadProgress,
    }
  );
  return response.data.data;
}

export async function deleteVideo(id: string): Promise<void> {
  await apiClient.delete<ApiResponse<null>>(`/videos/${id}`);
}

export async function startProcessing(
  videoId: string
): Promise<{ job_id: string; video_id: string; status: string; progress_percentage: number }> {
  const response = await apiClient.post<
    ApiResponse<{ job_id: string; video_id: string; status: string; progress_percentage: number }>
  >(`/videos/${videoId}/process`);
  return response.data.data;
}

export async function getVideoStatus(
  videoId: string
): Promise<VideoProcessingStatusResponse> {
  const response = await apiClient.get<ApiResponse<VideoProcessingStatusResponse>>(
    `/videos/${videoId}/status`
  );
  return response.data.data;
}
