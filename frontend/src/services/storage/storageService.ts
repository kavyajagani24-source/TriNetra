/**
 * UrbanEye AI — Storage Service
 *
 * Resolves local file paths or server-relative storage paths
 * (e.g., storage/evidence/ev_xxx.jpg) to full accessible HTTP URLs.
 */

import { env } from "@/config/env";

export function resolveMediaUrl(path?: string | null): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }

  // Normalize Windows backslashes
  const normalized = path.replace(/\\/g, "/");

  // If path starts with /storage or storage, append to backend base URL
  if (normalized.startsWith("/storage")) {
    return `${env.backendUrl}${normalized}`;
  }
  if (normalized.startsWith("storage/")) {
    return `${env.backendUrl}/${normalized}`;
  }

  // Otherwise assume it's relative to storage root
  return `${env.backendUrl}/storage/${normalized}`;
}
