/**
 * UrbanEye AI — Axios API Client
 *
 * Configures base URL, timeout, headers, and centralizes error normalization.
 */

import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import { env } from "@/config/env";
import type { ApiError } from "@/types/api";

export const apiClient: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

export function normalizeApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<{ message?: string; detail?: unknown }>;
    const status = axiosErr.response?.status;
    const data = axiosErr.response?.data;

    let message = "An error occurred while connecting to the backend.";
    if (data?.message) {
      message = data.message;
    } else if (typeof data?.detail === "string") {
      message = data.detail;
    } else if (axiosErr.message) {
      message = axiosErr.message;
    }

    return {
      message,
      status,
      details: data?.detail,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }

  return {
    message: "An unexpected error occurred.",
    details: error,
  };
}

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    return Promise.reject(normalizeApiError(error));
  }
);
