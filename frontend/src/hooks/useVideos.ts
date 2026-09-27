import { useCallback, useEffect, useState } from "react";
import { deleteVideo, getVideos, startProcessing, uploadVideo } from "@/services/api/videos";
import { useAppStore } from "@/store/appStore";
import type { BackendVideo } from "@/types/api";

export function useVideos(busIdFilter?: string) {
  const { setBackendOnline } = useAppStore();
  const [videos, setVideos] = useState<BackendVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await getVideos({ bus_id: busIdFilter, limit: 100 });
      setVideos(res.data || []);
      setBackendOnline(true);
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        "Failed to load videos from backend database.";
      setError(msg);
      setBackendOnline(false);
      // No silent mock fallback on error — report real error
    } finally {
      setLoading(false);
    }
  }, [busIdFilter, setBackendOnline]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleUpload = async (
    file: File,
    options?: {
      bus_id?: string;
      latitude?: number;
      longitude?: number;
      onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void;
    }
  ): Promise<BackendVideo> => {
    setError(null);
    try {
      const uploaded = await uploadVideo(file, options);
      await fetchVideos();
      return uploaded;
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message || "Failed to upload video to backend storage.";
      setError(msg);
      throw err;
    }
  };

  const handleStartProcessing = async (videoId: string) => {
    setError(null);
    try {
      const result = await startProcessing(videoId);
      await fetchVideos();
      return result;
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message || "Failed to trigger processing job on backend.";
      setError(msg);
      throw err;
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteVideo(id);
      await fetchVideos();
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message || "Failed to delete video from backend.";
      setError(msg);
      throw err;
    }
  };

  return {
    videos,
    loading,
    error,
    refresh: fetchVideos,
    uploadVideo: handleUpload,
    startProcessing: handleStartProcessing,
    deleteVideo: handleDelete,
  };
}
