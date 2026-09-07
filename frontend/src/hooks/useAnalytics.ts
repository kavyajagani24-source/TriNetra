import { useCallback, useEffect, useState } from "react";
import { getJobResults, getVideoAnalytics } from "@/services/api/analytics";
import { MOCK_JOB_RESULTS, MOCK_TRAFFIC_SERIES } from "@/mocks/analytics";
import { useAppStore } from "@/store/appStore";
import type { BackendJobResults, BackendTrafficAnalytics } from "@/types/api";

export function useAnalytics(videoId?: string | null, jobId?: string | null) {
  const { demoMode } = useAppStore();
  const [telemetry, setTelemetry] = useState<BackendTrafficAnalytics[]>([]);
  const [jobResults, setJobResults] = useState<BackendJobResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (demoMode || !videoId) {
      setTimeout(() => {
        setTelemetry(MOCK_TRAFFIC_SERIES);
        setJobResults(MOCK_JOB_RESULTS);
        setLoading(false);
      }, 150);
      return;
    }

    try {
      const telRes = await getVideoAnalytics(videoId, { limit: 100 });
      setTelemetry(telRes.data);

      if (jobId) {
        const jobRes = await getJobResults(jobId);
        setJobResults(jobRes);
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || "Failed to load traffic analytics.";
      setError(msg);
      // Fallback
      setTelemetry(MOCK_TRAFFIC_SERIES);
      setJobResults(MOCK_JOB_RESULTS);
    } finally {
      setLoading(false);
    }
  }, [demoMode, videoId, jobId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    telemetry,
    jobResults,
    loading,
    error,
    refresh: fetchAnalytics,
  };
}
