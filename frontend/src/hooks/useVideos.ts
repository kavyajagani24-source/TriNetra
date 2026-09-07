import { useCallback, useEffect, useState } from "react";
import { deleteVideo, getVideos, startProcessing, uploadVideo } from "@/services/api/videos";
import { MOCK_VIDEOS } from "@/mocks/videos";
import { useAppStore } from "@/store/appStore";
import type { BackendVideo } from "@/types/api";

export function useVideos(busIdFilter?: string) {
  const { demoMode, setBackendOnline } = useAppStore();
  const [videos, setVideos] = useState<BackendVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (demoMode) {
      setTimeout(() => {
        const filtered = busIdFilter
          ? MOCK_VIDEOS.filter((v) => v.bus_id === busIdFilter)
          : MOCK_VIDEOS;
        setVideos(filtered);
        setLoading(false);
      }, 150);
      return;
    }

    try {
      const res = await getVideos({ bus_id: busIdFilter, limit: 100 });
      setVideos(res.data);
      setBackendOnline(true);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || "Failed to load videos from backend.";
      setError(msg);
      setBackendOnline(false);
      const filtered = busIdFilter
        ? MOCK_VIDEOS.filter((v) => v.bus_id === busIdFilter)
        : MOCK_VIDEOS;
      setVideos(filtered);
    } finally {
      setLoading(false);
    }
  }, [demoMode, busIdFilter, setBackendOnline]);

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
  ) => {
    if (demoMode) {
      const mockVid: BackendVideo = {
        id: `demo-vid-${Date.now()}`,
        filename: file.name,
        original_filename: file.name,
        file_path: `storage/uploads/${file.name}`,
        file_size: file.size,
        format: `.${file.name.split(".").pop() || "mp4"}`,
        fps: 30.0,
        frame_count: 600,
        duration: 20.0,
        width: 1920,
        height: 1080,
        status: "UPLOADED",
        bus_id: options?.bus_id || null,
        latitude: options?.latitude || null,
        longitude: options?.longitude || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setVideos((prev) => [mockVid, ...prev]);
      return mockVid;
    }
    const uploaded = await uploadVideo(file, options);
    await fetchVideos();
    return uploaded;
  };

  const handleStartProcessing = async (videoId: string) => {
    if (demoMode) {
      setVideos((prev) =>
        prev.map((v) => (v.id === videoId ? { ...v, status: "PROCESSING" } : v))
      );
      // Simulate completion after 3 seconds in demo mode
      setTimeout(() => {
        setVideos((prev) =>
          prev.map((v) => (v.id === videoId ? { ...v, status: "READY" } : v))
        );
      }, 3000);
      return { job_id: `demo-job-${Date.now()}`, video_id: videoId, status: "PROCESSING", progress_percentage: 0 };
    }
    const result = await startProcessing(videoId);
    await fetchVideos();
    return result;
  };

  const handleDelete = async (id: string) => {
    if (demoMode) {
      setVideos((prev) => prev.filter((v) => v.id !== id));
      return;
    }
    await deleteVideo(id);
    await fetchVideos();
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
