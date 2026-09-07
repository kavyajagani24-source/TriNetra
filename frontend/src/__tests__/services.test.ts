import { describe, it, expect } from "vitest";
import { resolveMediaUrl } from "../services/storage/storageService";
import { MOCK_BUSES } from "../mocks/buses";
import { MOCK_VIDEOS } from "../mocks/videos";
import { MOCK_EVENTS } from "../mocks/events";
import { MOCK_TRAFFIC_SERIES, MOCK_JOB_RESULTS } from "../mocks/analytics";

describe("Storage Media URL Resolution Suite", () => {
  it("resolves null and undefined paths to fallback placeholder", () => {
    expect(resolveMediaUrl(null)).toBe("");
    expect(resolveMediaUrl(undefined)).toBe("");
  });

  it("leaves absolute http/https URLs intact", () => {
    const external = "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957";
    expect(resolveMediaUrl(external)).toBe(external);
  });

  it("prefixes relative storage paths with backend storage URL", () => {
    const relative = "evidence/frame_100.jpg";
    const resolved = resolveMediaUrl(relative);
    expect(resolved).toContain("/storage/evidence/frame_100.jpg");
  });

  it("handles leading slashes gracefully", () => {
    const relative = "/storage/evidence/frame_200.jpg";
    const resolved = resolveMediaUrl(relative);
    expect(resolved).toContain("/storage/evidence/frame_200.jpg");
  });
});

describe("Demo Mode Mock Data Integrity Suite", () => {
  it("contains valid mock buses with expected schema", () => {
    expect(MOCK_BUSES.length).toBeGreaterThan(0);
    const bus = MOCK_BUSES[0];
    expect(bus).toHaveProperty("id");
    expect(bus).toHaveProperty("bus_number");
    expect(bus).toHaveProperty("status");
  });

  it("contains rich mock events covering diverse categories", () => {
    expect(MOCK_EVENTS.length).toBeGreaterThanOrEqual(10);
    const categories = new Set(MOCK_EVENTS.map((e) => e.category));
    expect(categories.has("HAZARD")).toBe(true);
    expect(categories.has("SAFETY")).toBe(true);

    for (const event of MOCK_EVENTS) {
      expect(event.confidence).toBeGreaterThan(0);
      expect(event.confidence).toBeLessThanOrEqual(1);
      expect(event.severity).toBeDefined();
    }
  });

  it("contains mock videos with complete metadata", () => {
    expect(MOCK_VIDEOS.length).toBeGreaterThan(0);
    const video = MOCK_VIDEOS[0];
    expect(video.filename).toBeDefined();
    expect(video.duration).toBeGreaterThan(0);
  });

  it("contains traffic analytics time-series and job results", () => {
    expect(MOCK_TRAFFIC_SERIES.length).toBeGreaterThan(0);
    const item = MOCK_TRAFFIC_SERIES[0];
    expect(item.active_vehicle_count).toBeGreaterThanOrEqual(0);
    expect(item.traffic_density).toBeDefined();

    expect(MOCK_JOB_RESULTS).toBeDefined();
    expect(MOCK_JOB_RESULTS.job_id).toBe("job-001");
    expect(MOCK_JOB_RESULTS.total_unique_vehicles).toBeGreaterThan(0);
  });
});
