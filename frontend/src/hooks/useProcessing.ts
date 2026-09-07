import { useCallback, useEffect, useRef, useState } from "react";
import { getVideoProcessingStatus } from "@/services/api/processing";
import { useAppStore } from "@/store/appStore";
import type { VideoProcessingStatusResponse } from "@/types/api";

export function useProcessing(videoId?: string | null) {
  const { demoMode } = useAppStore();
  const [status, setStatus] = useState<VideoProcessingStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!videoId) return null;
    setLoading(true);
    setError(null);

    if (demoMode) {
      const mockStatus: VideoProcessingStatusResponse = {
        video_id: videoId,
        video_status: "READY",
        active_job_id: "demo-job-001",
        job_status: "COMPLETED",
        progress_percentage: 100.0,
        frames_processed: 900,
        total_frames: 900,
        events_detected: 14,
        error_message: null,
      };
      setStatus(mockStatus);
      setLoading(false);
      return mockStatus;
    }

    try {
      const res = await getVideoProcessingStatus(videoId);
      setStatus(res);
      return res;
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || "Failed to fetch processing status.";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [videoId, demoMode]);

  useEffect(() => {
    if (!videoId) return;

    fetchStatus();

    // Start polling if processing is active
    const startPolling = () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        const res = await fetchStatus();
        if (
          res &&
          res.job_status !== "PROCESSING" &&
          res.job_status !== "QUEUED" &&
          res.video_status !== "PROCESSING"
        ) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        }
      }, 2500);
    };

    startPolling();

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [videoId, fetchStatus]);

  return {
    status,
    loading,
    error,
    refresh: fetchStatus,
  };
}
