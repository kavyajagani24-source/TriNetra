import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatDuration,
  formatConfidence,
  formatPercentage,
  formatCoordinates,
  formatFileSize,
} from "../utils/formatters";
import {
  getEventTypeLabel,
  getEventCategoryLabel,
  getSeverityClasses,
  getCategoryClasses,
} from "../utils/eventUtils";

describe("Formatters Utility Suite", () => {
  it("formats date strings correctly", () => {
    expect(formatDate(null)).toBe("N/A");
    expect(formatDate(undefined)).toBe("N/A");
    const formatted = formatDate("2026-09-07T12:00:00Z");
    expect(formatted).not.toBe("N/A");
    expect(formatted.length).toBeGreaterThan(0);
  });

  it("formats durations in seconds to mm:ss", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(65)).toBe("01:05");
    expect(formatDuration(3600)).toBe("60:00");
    expect(formatDuration(125.7)).toBe("02:05");
  });

  it("formats confidence scores as percentages", () => {
    expect(formatConfidence(0.954)).toBe("95.4%");
    expect(formatConfidence(0)).toBe("0.0%");
    expect(formatConfidence(1.0)).toBe("100.0%");
  });

  it("formats integers as percentages", () => {
    expect(formatPercentage(85)).toBe("85.0%");
    expect(formatPercentage(null)).toBe("0%");
  });

  it("formats latitude and longitude coordinates", () => {
    expect(formatCoordinates(12.9716, 77.5946)).toBe("12.97160, 77.59460");
    expect(formatCoordinates(null, null)).toBe("GPS unavailable");
  });

  it("formats file sizes cleanly", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1048576)).toBe("1 MB");
  });
});

describe("Event Utilities Suite", () => {
  it("maps known event types to friendly labels", () => {
    expect(getEventTypeLabel("POTHOLE")).toBe("Pothole");
    expect(getEventTypeLabel("NEAR_MISS")).toBe("Near-Miss Hazard");
    expect(getEventTypeLabel("WATERLOGGING")).toBe("Waterlogging");
    expect(getEventTypeLabel("UNKNOWN")).toBe("Unknown Event");
    expect(getEventTypeLabel(null)).toBe("Unknown Event");
  });

  it("maps categories and provides semantic CSS styles", () => {
    expect(getEventCategoryLabel("HAZARD")).toBe("Road Hazard");
    expect(getEventCategoryLabel("SAFETY")).toBe("Pedestrian Safety");
    expect(getEventCategoryLabel(null)).toBe("Incident");

    const crit = getSeverityClasses("CRITICAL");
    expect(crit.badge).toContain("red");
    expect(crit.dot).toContain("animate-pulse");

    const high = getSeverityClasses("HIGH");
    expect(high.badge).toContain("orange");

    const catStyle = getCategoryClasses("HAZARD");
    expect(catStyle).toContain("amber");
  });
});
