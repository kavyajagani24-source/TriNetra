/**
 * UrbanEye AI — Common Formatters
 */

export function formatDate(dateString?: string | null): string {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(dateString);
  }
}

export function formatDateTime(dateString?: string | null): string {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(dateString);
  }
}

export function formatDuration(seconds?: number | null): string {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function formatPercentage(value?: number | null, decimals = 1): string {
  if (value === undefined || value === null || isNaN(value)) return "0%";
  return `${value.toFixed(decimals)}%`;
}

export function formatConfidence(confidence?: number | null): string {
  if (confidence === undefined || confidence === null || isNaN(confidence)) return "0.0%";
  const pct = confidence <= 1.0 ? confidence * 100 : confidence;
  return `${pct.toFixed(1)}%`;
}

export function formatCoordinates(lat?: number | null, lng?: number | null): string {
  if (lat === undefined || lat === null || lng === undefined || lng === null) {
    return "GPS unavailable";
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
