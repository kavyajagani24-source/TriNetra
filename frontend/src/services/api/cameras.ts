/**
 * UrbanEye AI — Camera Safety Profiles Service
 *
 * Client for managing camera-specific zone configurations (Module 3 Safety AI).
 */

import { apiClient } from "./client";
import type { CameraSafetyProfile } from "@/types/api";

export async function listCameraSafetyProfiles(
  limit: number = 50,
  offset: number = 0
): Promise<CameraSafetyProfile[]> {
  const res = await apiClient.get<CameraSafetyProfile[]>("/cameras/safety-profiles", {
    params: { limit, offset },
  });
  return res.data;
}

export async function getCameraSafetyProfile(
  cameraId: string
): Promise<CameraSafetyProfile> {
  const res = await apiClient.get<CameraSafetyProfile>(
    `/cameras/${encodeURIComponent(cameraId)}/safety-profile`
  );
  return res.data;
}

export async function upsertCameraSafetyProfile(
  cameraId: string,
  payload: {
    camera_id: string;
    resolution_width?: number;
    resolution_height?: number;
    zones: any[];
    enabled?: boolean;
    extra_metadata?: Record<string, any>;
  }
): Promise<CameraSafetyProfile> {
  const res = await apiClient.put<CameraSafetyProfile>(
    `/cameras/${encodeURIComponent(cameraId)}/safety-profile`,
    payload
  );
  return res.data;
}

export async function deleteCameraSafetyProfile(
  cameraId: string
): Promise<void> {
  await apiClient.delete(`/cameras/${encodeURIComponent(cameraId)}/safety-profile`);
}
