import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Cpu,
  Film,
  Play,
  X,
} from "lucide-react";
import type { BackendVideo } from "@/types/api";
import { formatDateTime, formatDuration, formatFileSize } from "@/utils/formatters";

interface VideoJobDetailDrawerProps {
  job: BackendVideo | null;
  onClose: () => void;
}

export function VideoJobDetailDrawer({ job, onClose }: VideoJobDetailDrawerProps) {
  if (!job) return null;

  const pipelineStages = [
    { label: "Uploaded", done: true },
    { label: "Frame Extraction", done: job.status !== "UPLOADED" },
    { label: "Detection", done: ["PROCESSING", "COMPLETED", "READY"].includes(job.status) },
    { label: "Tracking", done: ["COMPLETED", "READY"].includes(job.status) },
    { label: "Event Generation", done: ["COMPLETED", "READY"].includes(job.status) },
    { label: "Completed", done: job.status === "COMPLETED" || job.status === "READY" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl animate-in slide-in-from-right duration-250">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded bg-blue-600/30 text-blue-400 border border-blue-500/30">
              <Film className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">{job.original_filename}</h2>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Job ID: {job.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Close video job drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Pipeline Stages Progress Bar */}
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase mb-2">
            AI Video Inference Pipeline Stages
          </div>
          <div className="grid grid-cols-6 gap-1">
            {pipelineStages.map((stage) => (
              <div
                key={stage.label}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded border text-center text-[9px] font-medium transition-colors ${
                  stage.done
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : "bg-white border-slate-200 text-slate-400"
                }`}
              >
                <span>{stage.label}</span>
                {stage.done && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600 mt-0.5" />}
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Job Status:</span>
              <span
                className={`font-semibold uppercase px-2 py-0.5 rounded text-[11px] ${
                  job.status === "COMPLETED" || job.status === "READY"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : job.status === "PROCESSING"
                    ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
                    : job.status === "FAILED"
                    ? "bg-rose-100 text-rose-800 border border-rose-300"
                    : "bg-blue-100 text-blue-800 border border-blue-300"
                }`}
              >
                {job.status}
              </span>
            </div>
            <span className="text-xs text-slate-600 font-mono">
              Duration: {formatDuration(job.duration)}
            </span>
          </div>

          {/* Technical Metadata */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-blue-600" />
              Technical Video & Ingestion Parameters
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">Resolution</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {job.width || 1920} x {job.height || 1080}
                </span>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">Frame Rate / Frames</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {job.fps || 30} fps ({job.frame_count || 0} total)
                </span>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">File Size</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {formatFileSize(job.file_size)}
                </span>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">Uploaded Timestamp</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {formatDateTime(job.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Pipeline Warnings or Status */}
          {job.status === "FAILED" ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-rose-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Pipeline Warning</span>
                Processing terminated prematurely. Check backend logs for detailed stacktrace.
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
              <span className="font-bold block mb-1">Inference Execution:</span>
              Dispatched to YOLO detection model container. Keyframes sampled at 2 FPS for road defect & vehicle tracking extraction.
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-slate-50 p-4 text-right">
          <button
            onClick={onClose}
            className="rounded border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Close Inspector
          </button>
        </footer>
      </aside>
    </div>
  );
}
