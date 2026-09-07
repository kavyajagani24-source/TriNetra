import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Film,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { useBuses } from "@/hooks/useBuses";
import { useProcessing } from "@/hooks/useProcessing";
import { useVideos } from "@/hooks/useVideos";
import { formatDateTime, formatDuration, formatFileSize } from "@/utils/formatters";
import type { BackendVideo } from "@/types/api";

export function VideoManagement() {
  const { videos, loading, error, refresh, uploadVideo, startProcessing, deleteVideo } =
    useVideos();
  const { buses } = useBuses();

  const [selectedVideo, setSelectedVideo] = useState<BackendVideo | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBusId, setUploadBusId] = useState("");
  const [uploadLat, setUploadLat] = useState("");
  const [uploadLng, setUploadLng] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Active processing hook for selected video
  const activeProcessing = useProcessing(selectedVideo?.id);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
    }
  };

  const submitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setUploadError(null);
    setUploadProgress(10);

    try {
      await uploadVideo(uploadFile, {
        bus_id: uploadBusId || undefined,
        latitude: uploadLat ? parseFloat(uploadLat) : undefined,
        longitude: uploadLng ? parseFloat(uploadLng) : undefined,
        onUploadProgress: (evt) => {
          if (evt.total) {
            setUploadProgress(Math.round((evt.loaded * 100) / evt.total));
          }
        },
      });
      setUploadModalOpen(false);
      setUploadFile(null);
      setUploadBusId("");
      setUploadLat("");
      setUploadLng("");
      setUploadProgress(0);
    } catch (err: unknown) {
      setUploadError(
        (err as { message?: string })?.message || "Upload failed. Check format (.mp4/.avi/.mov/.mkv)."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleStartAI = async (videoId: string) => {
    setActionError(null);
    try {
      await startProcessing(videoId);
      refresh();
    } catch (err: unknown) {
      setActionError((err as { message?: string })?.message || "Failed to start processing.");
    }
  };

  const handleDelete = async (videoId: string) => {
    if (!window.confirm("Are you sure you want to delete this video and all associated detections?")) {
      return;
    }
    setActionError(null);
    try {
      await deleteVideo(videoId);
      if (selectedVideo?.id === videoId) setSelectedVideo(null);
      refresh();
    } catch (err: unknown) {
      setActionError((err as { message?: string })?.message || "Failed to delete video.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden p-3 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Film className="h-4 w-4 text-primary" />
            Video Ingestion & AI Processing
          </h2>
          <p className="text-xs text-muted-foreground">
            Upload bus dashcam footage, trigger YOLO & Phase 3 intelligence pipeline, and inspect progress.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-border rounded bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Upload Video
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-2 text-xs bg-red-950/50 border border-red-800 text-red-300 rounded flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {actionError}
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 min-h-0 flex-1 overflow-hidden">
        {/* Videos Table (2 cols) */}
        <div className="lg:col-span-2 border border-border rounded bg-card flex flex-col min-h-0 overflow-hidden">
          <div className="p-2 border-b border-border bg-secondary/30 flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Uploaded Footage ({videos.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {videos.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No videos uploaded yet. Click &quot;Upload Video&quot; to begin.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-secondary/60 text-muted-foreground border-b border-border sticky top-0">
                  <tr>
                    <th className="p-2 font-medium">Video</th>
                    <th className="p-2 font-medium">Bus</th>
                    <th className="p-2 font-medium">Duration</th>
                    <th className="p-2 font-medium">Status</th>
                    <th className="p-2 font-medium">Uploaded</th>
                    <th className="p-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {videos.map((vid) => {
                    const isSelected = selectedVideo?.id === vid.id;
                    return (
                      <tr
                        key={vid.id}
                        onClick={() => setSelectedVideo(vid)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-secondary/40"
                        }`}
                      >
                        <td className="p-2">
                          <div className="font-medium text-foreground truncate max-w-[180px]">
                            {vid.original_filename}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {formatFileSize(vid.file_size)} · {vid.width || 1920}x{vid.height || 1080}
                          </div>
                        </td>
                        <td className="p-2 text-muted-foreground">
                          {buses.find((b) => b.id === vid.bus_id)?.bus_number || "Unassigned"}
                        </td>
                        <td className="p-2 font-mono text-[11px] text-foreground">
                          {formatDuration(vid.duration)}
                        </td>
                        <td className="p-2">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              vid.status === "READY" || vid.status === "COMPLETED"
                                ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800"
                                : vid.status === "PROCESSING"
                                ? "bg-amber-950/60 text-amber-300 border border-amber-800 animate-pulse"
                                : vid.status === "FAILED"
                                ? "bg-red-950/60 text-red-400 border border-red-800"
                                : "bg-blue-950/60 text-blue-400 border border-blue-800"
                            }`}
                          >
                            {vid.status}
                          </span>
                        </td>
                        <td className="p-2 text-[10px] text-muted-foreground">
                          {formatDateTime(vid.created_at)}
                        </td>
                        <td className="p-2 text-right space-x-1">
                          {(vid.status === "UPLOADED" || vid.status === "FAILED") && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartAI(vid.id);
                              }}
                              className="px-2 py-0.5 text-[10px] bg-primary text-primary-foreground rounded hover:bg-primary/90"
                            >
                              Run AI
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(vid.id);
                            }}
                            className="p-1 text-muted-foreground hover:text-red-400 rounded"
                            title="Delete video"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Video Detail & Processing Inspector (1 col) */}
        <div className="border border-border rounded bg-card flex flex-col p-3 gap-3 overflow-y-auto">
          {selectedVideo ? (
            <>
              <div className="border-b border-border pb-2">
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                  Video Inspector
                </span>
                <h3 className="text-xs font-semibold text-foreground truncate mt-0.5">
                  {selectedVideo.original_filename}
                </h3>
                <span className="text-[10px] text-muted-foreground font-mono">
                  ID: {selectedVideo.id}
                </span>
              </div>

              {/* Technical Telemetry */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-secondary/50 border border-border">
                  <span className="text-[10px] text-muted-foreground block">Resolution</span>
                  <span className="font-semibold text-foreground">
                    {selectedVideo.width || 1920} x {selectedVideo.height || 1080}
                  </span>
                </div>
                <div className="p-2 rounded bg-secondary/50 border border-border">
                  <span className="text-[10px] text-muted-foreground block">FPS / Frames</span>
                  <span className="font-semibold text-foreground">
                    {selectedVideo.fps || 30} fps ({selectedVideo.frame_count || 0} f)
                  </span>
                </div>
                <div className="p-2 rounded bg-secondary/50 border border-border">
                  <span className="text-[10px] text-muted-foreground block">File Size</span>
                  <span className="font-semibold text-foreground">
                    {formatFileSize(selectedVideo.file_size)}
                  </span>
                </div>
                <div className="p-2 rounded bg-secondary/50 border border-border">
                  <span className="text-[10px] text-muted-foreground block">Duration</span>
                  <span className="font-semibold text-foreground">
                    {formatDuration(selectedVideo.duration)}
                  </span>
                </div>
              </div>

              {/* Processing Status Block */}
              <div className="border border-border rounded p-2.5 bg-secondary/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    Processing Telemetry
                  </span>
                  <span className="text-[10px] uppercase font-bold text-primary">
                    {activeProcessing.status?.job_status || selectedVideo.status}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full bg-secondary h-2 rounded overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300"
                      style={{
                        width: `${
                          activeProcessing.status?.progress_percentage ??
                          (selectedVideo.status === "COMPLETED" || selectedVideo.status === "READY" ? 100 : 0)
                        }%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>
                      {activeProcessing.status?.frames_processed ?? 0} /{" "}
                      {activeProcessing.status?.total_frames || selectedVideo.frame_count || 0} frames
                    </span>
                    <span>
                      {activeProcessing.status?.progress_percentage ??
                        (selectedVideo.status === "COMPLETED" || selectedVideo.status === "READY" ? 100 : 0)}
                      %
                    </span>
                  </div>
                </div>

                {/* Events detected counter */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                  <span className="text-muted-foreground">Urban Events Detected:</span>
                  <span className="font-bold text-foreground font-mono">
                    {activeProcessing.status?.events_detected ?? 0}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2">
                {selectedVideo.status === "UPLOADED" || selectedVideo.status === "FAILED" ? (
                  <button
                    onClick={() => handleStartAI(selectedVideo.id)}
                    className="w-full py-1.5 text-xs bg-primary text-primary-foreground font-medium rounded hover:bg-primary/90 flex items-center justify-center gap-1.5"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Start AI Processing
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground text-xs">
              <Film className="h-8 w-8 text-border mb-2" />
              Select a video from the list to inspect AI processing progress and telemetry.
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Upload className="h-4 w-4 text-primary" />
                Upload Dashcam Video
              </h3>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            {uploadError && (
              <div className="p-2 text-xs bg-red-950/60 border border-red-800 text-red-300 rounded">
                {uploadError}
              </div>
            )}

            <form onSubmit={submitUpload} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1">
                  Video File (.mp4, .avi, .mov, .mkv) *
                </label>
                <input
                  type="file"
                  accept=".mp4,.avi,.mov,.mkv"
                  required
                  onChange={handleFileChange}
                  className="w-full text-xs text-foreground file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Bus Unit</label>
                <select
                  value={uploadBusId}
                  onChange={(e) => setUploadBusId(e.target.value)}
                  className="w-full p-1.5 rounded bg-background border border-border text-foreground"
                >
                  <option value="">Unassigned</option>
                  {buses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bus_number} — {b.route_number}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-muted-foreground mb-1">Latitude (optional)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="12.9784"
                    value={uploadLat}
                    onChange={(e) => setUploadLat(e.target.value)}
                    className="w-full p-1.5 rounded bg-background border border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Longitude (optional)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="77.6380"
                    value={uploadLng}
                    onChange={(e) => setUploadLng(e.target.value)}
                    className="w-full p-1.5 rounded bg-background border border-border text-foreground"
                  />
                </div>
              </div>

              {uploading && (
                <div className="space-y-1">
                  <div className="w-full bg-secondary h-1.5 rounded overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground text-right font-mono">
                    Uploading {uploadProgress}%
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setUploadModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-border text-muted-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : "Upload & Ingest"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
