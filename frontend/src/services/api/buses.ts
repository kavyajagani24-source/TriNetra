/**
 * UrbanEye AI — Bus API Service
 */

import { apiClient } from "./client";
import type {
  ApiResponse,
  BackendBus,
  BusCreatePayload,
  BusUpdatePayload,
  PaginatedResponse,
} from "@/types/api";

export async function getBuses(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<PaginatedResponse<BackendBus>> {
  const response = await apiClient.get<PaginatedResponse<BackendBus>>("/buses", {
    params,
  });
  return response.data;
}

export async function getBus(id: string): Promise<BackendBus> {
  const response = await apiClient.get<ApiResponse<BackendBus>>(`/buses/${id}`);
  return response.data.data;
}

export async function createBus(payload: BusCreatePayload): Promise<BackendBus> {
  const response = await apiClient.post<ApiResponse<BackendBus>>("/buses", payload);
  return response.data.data;
}

export async function updateBus(
  id: string,
  payload: BusUpdatePayload
): Promise<BackendBus> {
  const response = await apiClient.put<ApiResponse<BackendBus>>(
    `/buses/${id}`,
    payload
  );
  return response.data.data;
}

export async function deleteBus(id: string): Promise<void> {
  await apiClient.delete<ApiResponse<null>>(`/buses/${id}`);
}
