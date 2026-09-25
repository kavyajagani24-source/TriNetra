import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Cpu,
  Eye,
  Film,
  Play,
  Plus,
  RefreshCw,
  Search,
  Upload,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { VideoJobDetailDrawer } from "@/components/videos/VideoJobDetailDrawer";
import { useVideos } from "@/hooks/useVideos";
import { useBuses } from "@/hooks/useBuses";
import { formatDateTime, formatDuration, formatFileSize } from "@/utils/formatters";
import type { BackendVideo } from "@/types/api";

export function VideosPage() {
  const { videos, loading, refresh, uploadVideo, startProcessing } = useVideos();
  const { buses } = useBuses();

  const [activeJobDrawer, setActiveJobDrawer] = useState<BackendVideo | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Upload modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busId, setBusId] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Summary Metrics
  const processingNow = videos.filter((v) => v.status === "PROCESSING").length;
  const queuedCount = videos.filter((v) => v.status === "UPLOADED").length;
  const completedCount = videos.filter((v) => v.status === "COMPLETED" || v.status === "READY").length;
  const failedCount = videos.filter((v) => v.status === "FAILED").length;

  const activeProcessingJobs = videos.filter((v) => v.status === "PROCESSING" || v.status === "UPLOADED");

  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!v.id.toLowerCase().includes(q) && !v.original_filename.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [videos, statusFilter, searchQuery]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setIsUploading(true);
    try {
      await uploadVideo(file, { bus_id: busId });
      setUploadOpen(false);
      setFile(null);
      setBusId("");
      refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Top KPI Cards Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Processing Now</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-amber-50 text-amber-600">
                <Cpu className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{processingNow}</div>
            <p className="mt-1 text-[11px] text-amber-600 font-medium">YOLO inference active</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Queued</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-blue-50 text-blue-600">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{queuedCount}</div>
            <p className="mt-1 text-[11px] text-slate-500">Uploaded & awaiting dispatch</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Completed</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{completedCount}</div>
            <p className="mt-1 text-[11px] text-emerald-600 font-medium">Events generated</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Failed</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-rose-50 text-rose-600">
                <XCircle className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{failedCount}</div>
            <p className="mt-1 text-[11px] text-slate-500">Pipeline warnings</p>
          </div>
        </div>

        {/* Active Processing Section */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-blue-600" />
                Active Processing Jobs ({activeProcessingJobs.length})
              </h2>
              <p className="text-[11px] text-slate-500">
                Pipeline: Uploaded → Frame Extraction → Detection → Tracking → Event Generation → Completed
              </p>
            </div>
            <button
              onClick={() => setUploadOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Upload Video
            </button>
          </div>

          {activeProcessingJobs.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-500">
              No active processing jobs at the moment.
            </div>
          ) : (
            <div className="space-y-2">
              {activeProcessingJobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => setActiveJobDrawer(job)}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100 cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{job.original_filename}</span>
                      <span className="font-mono text-[10px] text-slate-500">({job.id})</span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Bus: <span className="font-semibold text-slate-800">{job.bus_id || "BUS-042"}</span> · Duration: {formatDuration(job.duration)}
                    </div>
                  </div>

                  {/* Stage Flow Indicator */}
                  <div className="flex items-center gap-1 text-[10px] font-mono">
                    <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300">
                      Uploaded
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300">
                      Extraction
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300 font-bold animate-pulse">
                      Detection
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                      Completed
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {job.status === "UPLOADED" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startProcessing(job.id);
                        }}
                        className="inline-flex items-center gap-1 rounded bg-blue-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-800"
                      >
                        <Play className="h-3 w-3" /> Run AI
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveJobDrawer(job);
                      }}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <Eye className="h-3 w-3" /> Inspect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Jobs Table */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 px-5 py-3 bg-slate-50 gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Recent Video Processing Log ({filteredVideos.length} jobs)
            </span>

            {/* Filter controls */}
            <div className="flex items-center gap-2">
              <div className="relative w-48">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by filename..."
                  className="h-7 w-full rounded border border-slate-200 bg-white pl-7 pr-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-7 rounded border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="PROCESSING">Processing</option>
                <option value="UPLOADED">Uploaded</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5">Video ID</th>
                  <th className="px-4 py-2.5">Bus Unit</th>
                  <th className="px-4 py-2.5">Duration</th>
                  <th className="px-4 py-2.5">File Size</th>
                  <th className="px-4 py-2.5">Uploaded</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredVideos.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => setActiveJobDrawer(job)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      <div>{job.original_filename}</div>
                      <div className="text-[10px] text-slate-400">{job.id}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">{job.bus_id || "BUS-042"}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{formatDuration(job.duration)}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{formatFileSize(job.file_size)}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                      {formatDateTime(job.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          job.status === "COMPLETED" || job.status === "READY"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : job.status === "PROCESSING"
                            ? "border-amber-300 bg-amber-50 text-amber-800 animate-pulse"
                            : job.status === "FAILED"
                            ? "border-rose-300 bg-rose-50 text-rose-800"
                            : "border-blue-300 bg-blue-50 text-blue-800"
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveJobDrawer(job);
                        }}
                        className="inline-flex items-center gap-1 rounded border border-blue-600 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-600 hover:text-white transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Inspect Job
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Video Job Detail Drawer */}
      <VideoJobDetailDrawer
        job={activeJobDrawer}
        onClose={() => setActiveJobDrawer(null)}
      />

      {/* Upload Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
              <Upload className="h-4 w-4 text-blue-600" />
              Upload Bus Dashcam Footage
            </h3>
            <form onSubmit={handleUploadSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select Video File (.mp4, .mov)</label>
                <input
                  type="file"
                  accept="video/*"
                  required
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Assign Bus Unit</label>
                <select
                  value={busId}
                  onChange={(e) => setBusId(e.target.value)}
                  className="w-full rounded border border-slate-300 p-2 text-xs text-slate-800"
                >
                  <option value="">Select bus unit...</option>
                  {buses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bus_number || b.id} — Route {b.route_number || b.route}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !file}
                  className="rounded bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {isUploading ? "Uploading..." : "Start Ingestion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
