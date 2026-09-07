/**
 * UrbanEye AI — Centralized Environment Configuration
 *
 * Single source of truth for runtime frontend configuration.
 * Avoids direct un-typed calls to `import.meta.env` across components.
 */

export interface AppEnv {
  apiBaseUrl: string;
  backendUrl: string;
  appName: string;
  appVersion: string;
  demoModeDefault: boolean;
}

export const env: AppEnv = {
  apiBaseUrl:
    (import.meta.env.VITE_API_BASE_URL as string) ||
    "http://localhost:8000/api/v1",
  backendUrl:
    (import.meta.env.VITE_BACKEND_URL as string) ||
    "http://localhost:8000",
  appName:
    (import.meta.env.VITE_APP_NAME as string) || "UrbanEye AI",
  appVersion:
    (import.meta.env.VITE_APP_VERSION as string) || "2.0.0",
  demoModeDefault:
    (import.meta.env.VITE_DEMO_MODE as string) === "true",
};

export const API_BASE_URL = env.apiBaseUrl;
export const BACKEND_URL = env.backendUrl;
export const APP_NAME = env.appName;
export const APP_VERSION = env.appVersion;
