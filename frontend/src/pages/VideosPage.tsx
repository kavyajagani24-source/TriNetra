import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Film,
  Loader2,
  MapPin,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Upload,
  X,
  AlertTriangle,
  Car,
  Eye,
  Shield,
  Zap,
  ChevronRight,
  Volume2,
  VolumeX,
  Maximize2,
  RotateCcw,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useStore } from "@/state/app-store";
import { useVideos } from "@/hooks/useVideos";
import { useBuses } from "@/hooks/useBuses";
import { getVideoEvents } from "@/services/api/events";
import { getSafetyRunForVideo, getSafetyVideoEvents } from "@/services/api/safety";
import { getProcessingResults, getVideoProcessingStatus } from "@/services/api/processing";
import { startProcessing } from "@/services/api/videos";
import { env } from "@/config/env";
import { formatDateTime, formatDuration, formatFileSize } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import type { BackendJobResults, BackendUrbanEvent, BackendVideo, VideoProcessingStatusResponse } from "@/types/api";
import type { SafetyEventListItem, SafetyRun } from "@/types/safety";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Unified Event Model across Road, Traffic, Safety, Incident, and Evidence modules
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export type AnalysisModule = "overview" | "road" | "traffic" | "safety" | "incident" | "evidence";

export interface UnifiedEvent {
  id: string;
  module: AnalysisModule;
  timestamp: number; // in seconds
  label: string;
  detail: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  evidenceUrl?: string | null;
  coordinates?: { lat?: number | null; lon?: number | null };
  bbox?: number[] | null;
  damageClass?: string | null;
  extra?: Record<string, unknown>;
}

function fmtTs(s: number): string {
  if (isNaN(s) || s < 0) return "00:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "READY":
    case "COMPLETED":
      return {
        cls: "bg-[#DCEFE4] text-[#174A35] border border-[#2F7D57]/20",
        label: "Ready / Complete",
      };
    case "PROCESSING":
    case "PERSISTING":
    case "ROAD_ANALYSIS":
    case "TRAFFIC_ANALYSIS":
    case "SAFETY_ANALYSIS":
      return {
        cls: "bg-amber-50 text-amber-800 border border-amber-300 animate-pulse",
        label: "Processing AI",
      };
    case "QUEUED":
      return {
        cls: "bg-sky-50 text-sky-800 border border-sky-300",
        label: "Queued",
      };
    case "UPLOADED":
      return {
        cls: "bg-blue-50 text-blue-800 border border-blue-300",
        label: "Uploaded",
      };
    case "FAILED":
      return {
        cls: "bg-rose-50 text-rose-800 border border-rose-300",
        label: "Failed",
      };
    default:
      return {
        cls: "bg-slate-100 text-slate-700 border border-slate-300",
        label: status,
      };
  }
}

function humanName(video: BackendVideo): string {
  const fn = video.original_filename || "";
  const waMatch = fn.match(/WhatsApp Video (\d{4}[- ]\d{2}[- ]\d{2}) at ([\d.]+ (?:AM|PM))/i);
  if (waMatch) {
    return `Transit Cam · ${waMatch[1]} (${waMatch[2]})`;
  }
  if (fn.toLowerCase().includes("bus_route")) {
    return fn.replace(/\.[^.]+$/, "").replace(/_/g, " ");
  }
  if (fn.toLowerCase().includes("jaad")) {
    return `Survey Feed · ${fn.replace(/\.[^.]+$/, "").replace(/_/g, " ")}`;
  }
  return (
    fn
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) || "Bus Journey Session"
  );
}

function getRoute(video: BackendVideo): string {
  const n = (video.original_filename || "").toLowerCase();
  if (n.includes("andheri")) return "Andheri East ⇄ Kurla Station";
  if (n.includes("kurla")) return "Kurla Depot ⇄ BKC Corridor";
  if (n.includes("jvlr")) return "JVLR Expressway Corridor";
  if (n.includes("orr") || n.includes("outer")) return "Outer Ring Road Transit";
  if (n.includes("sarjapur")) return "Sarjapur Road Corridor";
  if (n.includes("bannerghatta")) return "Bannerghatta Transit Line";
  if (n.includes("indiranagar") || n.includes("100ft")) return "Indiranagar 100ft Transit";
  return "Mumbai Metropolitan Corridor";
}

/* ─── Severity Badge Component ─── */
function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "bg-rose-50 text-rose-700 border border-rose-200 font-semibold",
    high: "bg-amber-50 text-amber-700 border border-amber-200 font-semibold",
    medium: "bg-yellow-50 text-yellow-700 border border-yellow-200 font-medium",
    low: "bg-[#DCEFE4] text-[#174A35] border border-[#2F7D57]/20 font-medium",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
        map[severity.toLowerCase()] ?? map["low"]
      )}
    >
      {severity}
    </span>
  );
}

/* ─── Progress Bar Component ─── */
function ProgressBar({
  value,
  label,
  sublabel,
}: {
  value: number;
  label: string;
  sublabel?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-slate-700">{label}</span>
        <span
          className={cn(
            value === 0
              ? "text-slate-400"
              : value >= 100
              ? "text-[#2F7D57] font-semibold"
              : "text-amber-700 font-semibold"
          )}
        >
          {sublabel ? sublabel : value === 0 ? "Not started" : value >= 100 ? "Complete" : `${Math.round(value)}%`}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn(
            "h-1.5 rounded-full transition-all duration-500",
            value >= 100
              ? "bg-[#2F7D57]"
              : value > 0
              ? "bg-amber-500"
              : "bg-slate-200"
          )}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

/* ─── Video Thumbnail ─── */
function VideoThumbnail({
  video,
  size = "md",
}: {
  video: BackendVideo;
  size?: "sm" | "md" | "lg";
}) {
  const cls = { sm: "h-14 w-20", md: "h-16 w-24", lg: "h-full w-full" }[size];
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-[#123827] shrink-0 border border-[#2F7D57]/40 shadow-2xs", cls)}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <Film className={cn("text-[#4ADE80]", size === "sm" ? "h-4 w-4" : "h-5 w-5")} />
        <span className="text-[8px] text-[#A3D9BA] font-mono tracking-wider font-semibold uppercase">
          {video.format?.replace(".", "") || "MP4"}
        </span>
      </div>
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg,#4ADE80 0,#4ADE80 1px,transparent 0,transparent 50%)",
          backgroundSize: "6px 6px",
        }}
      />
    </div>
  );
}

/* ─── VideoCard (in library) ─── */
function VideoCard({
  video,
  onOpen,
  isSelected,
}: {
  video: BackendVideo;
  onOpen: (v: BackendVideo) => void;
  isSelected: boolean;
}) {
  const badge = getStatusBadge(video.status);
  const isDone = video.status === "READY" || video.status === "COMPLETED";

  return (
    <div
      onClick={() => onOpen(video)}
      className={cn(
        "group relative flex gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-all duration-150 text-left",
        isSelected
          ? "border-[#2F7D57] bg-[#EEF7F1] shadow-xs ring-1 ring-[#2F7D57]/30"
          : "border-slate-200 bg-white hover:border-[#3F966C] hover:bg-[#F6FAF7]"
      )}
    >
      <VideoThumbnail video={video} size="sm" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-1.5">
          <p
            className="font-ui text-xs font-semibold text-slate-900 group-hover:text-[#174A35] line-clamp-1 flex-1 leading-snug"
            title={video.original_filename || ""}
          >
            {humanName(video)}
          </p>
          <span className={cn("shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap", badge.cls)}>
            {badge.label}
          </span>
        </div>
        <p className="text-[11px] text-slate-600 flex items-center gap-1 truncate font-medium">
          <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
          {getRoute(video)}
        </p>
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
            <span className="font-semibold text-slate-700">{formatDuration(video.duration)}</span>
            <span>•</span>
            <span>{formatFileSize(video.file_size)}</span>
          </div>
          <div className="flex items-center gap-1">
            {(["road", "traffic", "safety", "incident"] as const).map((m) => (
              <span
                key={m}
                className={cn(
                  "text-[8px] font-bold uppercase rounded px-1 py-0.2 border",
                  isDone
                    ? "bg-[#DCEFE4] text-[#174A35] border-[#2F7D57]/20"
                    : video.status === "PROCESSING"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-slate-50 text-slate-400 border-slate-200"
                )}
              >
                {m === "incident" ? "Inc" : m.slice(0, 3)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── EventRow Component ─── */
function EventRow({
  event,
  onSelect,
  isSelected,
}: {
  event: UnifiedEvent;
  onSelect: (e: UnifiedEvent) => void;
  isSelected: boolean;
}) {
  const iconMap: Record<AnalysisModule, React.ReactNode> = {
    overview: <Film className="h-3.5 w-3.5" />,
    road: <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />,
    traffic: <Car className="h-3.5 w-3.5 text-sky-600" />,
    safety: <Shield className="h-3.5 w-3.5 text-emerald-600" />,
    incident: <Zap className="h-3.5 w-3.5 text-rose-600" />,
  };

  const resolveImgUrl = (u: string) => {
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    return `${env.backendUrl}${u.startsWith("/") ? u : `/${u}`}`;
  };

  return (
    <button
      onClick={() => onSelect(event)}
      className={cn(
        "w-full flex items-start gap-3 px-3 py-2 text-left rounded-md transition-all text-xs",
        isSelected
          ? "bg-[#EEF7F1] border border-[#2F7D57]/30 shadow-xs"
          : "hover:bg-slate-50 border border-transparent"
      )}
    >
      {event.evidenceUrl ? (
        <div className="shrink-0 relative h-10 w-14 rounded overflow-hidden border border-slate-200 bg-slate-900 group">
          <img
            src={resolveImgUrl(event.evidenceUrl)}
            alt={event.label}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />
        </div>
      ) : (
        <div className="shrink-0 mt-0.5 flex items-center justify-center h-6 w-6 rounded bg-slate-100 text-slate-600">
          {iconMap[event.module]}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-slate-900 truncate">{event.label}</span>
          <SeverityBadge severity={event.severity} />
        </div>
        <p className="text-[11px] text-slate-500 truncate mt-0.5">{event.detail}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-mono text-[10px] text-[#2F7D57] font-bold bg-[#DCEFE4]/60 px-1 py-0.2 rounded">
            {fmtTs(event.timestamp)}
          </span>
          <span className="text-[10px] text-slate-400">{event.confidence}% confidence</span>
          {event.evidenceUrl && (
            <span className="text-[9px] text-[#2F7D57] font-semibold border border-[#2F7D57]/30 rounded px-1">
              Visual Proof
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0 mt-1" />
    </button>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   REAL HTML5 VIDEO PLAYER WITH INTERACTIVE TIMELINE AND EVENT MARKERS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function VideoPlayer({
  video,
  events,
  seekToTime,
  onEventSelect,
  selectedEvent,
  annotatedStreams,
  activeModule,
  streamKey,
  onStreamKeyChange,
}: {
  video: BackendVideo;
  events: UnifiedEvent[];
  seekToTime: number | null;
  onEventSelect?: (e: UnifiedEvent) => void;
  selectedEvent?: UnifiedEvent | null;
  annotatedStreams?: {
    road?: string | null;
    traffic?: string | null;
    safety?: string | null;
    incident?: string | null;
  };
  activeModule?: string;
  streamKey?: string;
  onStreamKeyChange?: (key: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [internalStreamKey, setInternalStreamKey] = useState<string>("raw");
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({ width: 1920, height: 1080 });
  const [containerRect, setContainerRect] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const selectedStreamKey = streamKey !== undefined ? streamKey : internalStreamKey;
  const setSelectedStreamKey = (k: string) => {
    setInternalStreamKey(k);
    onStreamKeyChange?.(k);
  };
  const lastTimeRef = useRef<number>(0);

  // ResizeObserver to maintain exact video aspect ratio letterbox alignment
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerRect({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Synchronized active bounding box detections around currentTime
  const activeDetections = useMemo(() => {
    return events.filter((ev) => {
      if (!ev.bbox || ev.bbox.length < 4) return false;
      const timeDiff = Math.abs(ev.timestamp - currentTime);
      return timeDiff <= 1.2 || (selectedEvent && selectedEvent.id === ev.id && timeDiff <= 2.5);
    });
  }, [events, currentTime, selectedEvent]);

  // Available stream options (Raw footage vs AI overlays)
  const availableStreams = useMemo(() => {
    const list: { key: string; label: string; badge: string; url: string }[] = [];
    const resolveUrl = (u: string) => {
      if (u.startsWith("http://") || u.startsWith("https://")) return u;
      return `${env.backendUrl}${u.startsWith("/") ? u : `/${u}`}`;
    };

    if (video.stream_url) {
      list.push({ key: "raw", label: "Raw", badge: "RAW CAMERA", url: resolveUrl(video.stream_url) });
    }
    if (annotatedStreams?.road) {
      list.push({ key: "road", label: "Road AI", badge: "RDD2022 OVERLAY", url: resolveUrl(annotatedStreams.road) });
    }
    if (annotatedStreams?.traffic) {
      list.push({ key: "traffic", label: "Traffic Flow", badge: "YOLO11x + URBIAN", url: resolveUrl(annotatedStreams.traffic) });
    }
    if (annotatedStreams?.incident) {
      list.push({ key: "incident", label: "Incident AI", badge: "INCIDENT OVERLAY", url: resolveUrl(annotatedStreams.incident) });
    }
    return list;
  }, [video.stream_url, annotatedStreams]);

  // Synchronize stream with active tab if available
  useEffect(() => {
    if (activeModule && activeModule !== "overview") {
      const match = availableStreams.find((s) => s.key === activeModule);
      if (match) {
        setSelectedStreamKey(match.key);
      }
    }
  }, [activeModule, availableStreams]);

  const activeStream = useMemo(() => {
    return availableStreams.find((s) => s.key === selectedStreamKey) || availableStreams[0] || null;
  }, [availableStreams, selectedStreamKey]);

  const streamUrl = activeStream ? activeStream.url : null;

  // Handle external seek requests
  const prevSeekRef = useRef<number | null>(null);
  useEffect(() => {
    if (seekToTime !== null && seekToTime !== prevSeekRef.current && videoRef.current) {
      prevSeekRef.current = seekToTime;
      videoRef.current.currentTime = seekToTime;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [seekToTime]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const ct = videoRef.current.currentTime;
      setCurrentTime(ct);
      lastTimeRef.current = ct;
      if (!duration && videoRef.current.duration) {
        setDuration(videoRef.current.duration);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const d = videoRef.current.duration;
      if (d && !isNaN(d)) setDuration(d);
      if (videoRef.current.videoWidth && videoRef.current.videoHeight) {
        setVideoDimensions({
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight,
        });
      }
      if (lastTimeRef.current > 0) {
        videoRef.current.currentTime = lastTimeRef.current;
        if (isPlaying) {
          videoRef.current.play().catch(() => {});
        }
      }
    }
  };

  // Compute exact letterboxed/pillarboxed video content rect inside container
  const displayRect = useMemo(() => {
    if (!containerRect.width || !containerRect.height || !videoDimensions.width || !videoDimensions.height) {
      return { left: 0, top: 0, width: 100, height: 100 };
    }
    const containerAspect = containerRect.width / containerRect.height;
    const videoAspect = videoDimensions.width / videoDimensions.height;

    if (Math.abs(containerAspect - videoAspect) < 0.02) {
      return { left: 0, top: 0, width: 100, height: 100 };
    }

    if (containerAspect > videoAspect) {
      // Pillarboxed (bars on sides)
      const renderWidth = containerRect.height * videoAspect;
      const leftOffset = (containerRect.width - renderWidth) / 2;
      return {
        left: (leftOffset / containerRect.width) * 100,
        top: 0,
        width: (renderWidth / containerRect.width) * 100,
        height: 100,
      };
    } else {
      // Letterboxed (bars on top/bottom)
      const renderHeight = containerRect.width / videoAspect;
      const topOffset = (containerRect.height - renderHeight) / 2;
      return {
        left: 0,
        top: (topOffset / containerRect.height) * 100,
        width: 100,
        height: (renderHeight / containerRect.height) * 100,
      };
    }
  }, [containerRect, videoDimensions]);

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = pos * (duration || 1);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
      setCurrentTime(target);
    }
  };

  const handleMouseMoveScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(pos * (duration || 1));
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="group relative bg-[#0B1E14] rounded-xl overflow-hidden border border-[#174A35] shadow-lg w-full"
      style={{ aspectRatio: "16 / 9", minHeight: "240px" }}
    >
      {/* Active Stream Indicator Badge */}
      {activeStream && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 pointer-events-none">
          <span className="rounded bg-black/80 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#4ADE80] border border-white/10 backdrop-blur-xs flex items-center gap-1.5 shadow-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
            {activeStream.badge}
          </span>
        </div>
      )}

      {/* Video Element — fills entire container */}
      {streamUrl ? (
        <video
          ref={videoRef}
          src={streamUrl}
          className="absolute inset-0 w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onError={() => {
            const mp4Stream = availableStreams.find((s) => s.key !== "raw" && s.url.endsWith(".mp4"));
            if (mp4Stream && selectedStreamKey !== mp4Stream.key) {
              setSelectedStreamKey(mp4Stream.key);
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          playsInline
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
          <Film className="h-10 w-10 text-[#2F7D57]" />
          <p className="text-xs">No streamable video file available</p>
        </div>
      )}

      {/* Real-time Dynamic AI Bounding Box & Defect Classification Overlay */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        {activeDetections.map((det) => {
          const [bx1, by1, bx2, by2] = det.bbox!;
          const isPx = bx2 > 1.0 || by2 > 1.0;
          const vw = videoDimensions.width || 1920;
          const vh = videoDimensions.height || 1080;

          const relLeft = Math.max(0, Math.min(100, isPx ? (bx1 / vw) * 100 : bx1 * 100));
          const relTop = Math.max(0, Math.min(100, isPx ? (by1 / vh) * 100 : by1 * 100));
          const relWidth = Math.max(2, Math.min(100 - relLeft, isPx ? ((bx2 - bx1) / vw) * 100 : (bx2 - bx1) * 100));
          const relHeight = Math.max(2, Math.min(100 - relTop, isPx ? ((by2 - by1) / vh) * 100 : (by2 - by1) * 100));

          const left = displayRect.left + (relLeft * displayRect.width) / 100;
          const top = displayRect.top + (relTop * displayRect.height) / 100;
          const width = (relWidth * displayRect.width) / 100;
          const height = (relHeight * displayRect.height) / 100;

          const damageClass =
            det.damageClass ||
            (det.extra?.damage_class as string) ||
            (det.label.toLowerCase().includes("pothole")
              ? "D40"
              : det.label.toLowerCase().includes("alligator")
              ? "D20"
              : det.label.toLowerCase().includes("crack")
              ? "D00"
              : "D40");

          const isCritical = det.severity === "critical" || damageClass === "D40";

          return (
            <div
              key={det.id}
              onClick={(e) => {
                e.stopPropagation();
                onEventSelect?.(det);
              }}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
              }}
              className={cn(
                "absolute border-2 pointer-events-auto cursor-pointer transition-all duration-75",
                isCritical
                  ? "border-[#EF4444] bg-[#EF4444]/20 shadow-[0_0_12px_rgba(239,68,68,0.8)]"
                  : "border-[#F59E0B] bg-[#F59E0B]/20 shadow-[0_0_10px_rgba(245,158,11,0.7)]"
              )}
            >
              {/* Corner brackets */}
              <span className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-white" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-white" />
              <span className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-white" />
              <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-white" />

              {/* Classification Tag Pill */}
              <div
                className={cn(
                  "absolute -top-5 left-0 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-tight text-white shadow-md whitespace-nowrap",
                  isCritical ? "bg-[#DC2626]" : "bg-[#D97706]"
                )}
              >
                <span className="bg-black/50 px-1 rounded text-[9px] uppercase tracking-wider">{damageClass}</span>
                <span>{det.label.replace(damageClass, "").trim() || "Road Defect"}</span>
                <span className="opacity-90 font-normal">· {det.confidence}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Center Play/Pause Overlay — only when paused */}
      {!isPlaying && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer z-10"
        >
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#174A35]/90 border border-[#2F7D57] text-[#4ADE80] shadow-xl hover:scale-105 transition-transform">
            <Play className="h-7 w-7 ml-1" />
          </div>
        </div>
      )}

      {/* Bottom Control Bar — absolute so it OVERLAYS video, never pushes it up */}
      <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-3 pt-8 pb-2.5 space-y-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
        {/* Timeline Scrubber */}
        <div
          className="relative h-1.5 w-full bg-white/25 hover:h-2.5 rounded-full cursor-pointer transition-all duration-150"
          onClick={handleScrub}
          onMouseMove={handleMouseMoveScrub}
          onMouseLeave={() => setHoverTime(null)}
        >
          {/* Progress fill */}
          <div
            className="h-full bg-[#4ADE80] rounded-full transition-all duration-75"
            style={{ width: `${progressPct}%` }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-md border border-[#2F7D57] pointer-events-none transition-all"
            style={{ left: `calc(${progressPct}% - 6px)` }}
          />

          {/* Event markers on timeline */}
          {duration > 0 &&
            events.map((ev) => {
              const leftPct = Math.min(100, Math.max(0, (ev.timestamp / duration) * 100));
              const color =
                ev.module === "safety"
                  ? "#EF4444"
                  : ev.module === "incident"
                  ? "#F59E0B"
                  : ev.module === "road"
                  ? "#EAB308"
                  : "#3B82F6";
              return (
                <div
                  key={ev.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEventSelect) onEventSelect(ev);
                    if (videoRef.current) {
                      videoRef.current.currentTime = ev.timestamp;
                      videoRef.current.play().catch(() => {});
                      setIsPlaying(true);
                    }
                  }}
                  title={`${ev.label} @ ${fmtTs(ev.timestamp)}`}
                  className="absolute top-0 bottom-0 w-0.5 hover:w-1.5 z-10 cursor-pointer rounded-full opacity-80 hover:opacity-100"
                  style={{ left: `${leftPct}%`, backgroundColor: color }}
                />
              );
            })}

          {/* Hover Time Tooltip */}
          {hoverTime !== null && (
            <div
              className="absolute -top-7 -translate-x-1/2 rounded bg-black/90 px-1.5 py-0.5 font-mono text-[9px] text-white shadow pointer-events-none"
              style={{ left: `${(hoverTime / (duration || 1)) * 100}%` }}
            >
              {fmtTs(hoverTime)}
            </div>
          )}
        </div>

        {/* Buttons and Time Row */}
        <div className="flex items-center justify-between text-xs text-white">
          <div className="flex items-center gap-2.5">
            <button
              onClick={togglePlay}
              className="grid h-7 w-7 place-items-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
            </button>

            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  setCurrentTime(0);
                }
              }}
              title="Restart"
              className="text-white/60 hover:text-white transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            {/* Volume toggle */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.muted = !isMuted;
                    setIsMuted(!isMuted);
                  }
                }}
                className="text-white/60 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  setIsMuted(val === 0);
                  if (videoRef.current) {
                    videoRef.current.volume = val;
                    videoRef.current.muted = val === 0;
                  }
                }}
                className="w-14 h-1 accent-[#4ADE80] cursor-pointer"
              />
            </div>

            {/* Current / Total duration */}
            <span className="font-mono text-[11px] text-white/90">
              <span className="text-[#4ADE80] font-bold">{fmtTs(currentTime)}</span>
              <span className="text-white/50 mx-1">/</span>
              {fmtTs(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Stream View Selector (Raw vs AI Annotated) */}
            {availableStreams.length > 1 && (
              <div className="flex items-center gap-1 bg-black/70 border border-white/20 rounded-md p-0.5">
                {availableStreams.map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (videoRef.current) lastTimeRef.current = videoRef.current.currentTime;
                      setSelectedStreamKey(st.key);
                    }}
                    className={cn(
                      "px-2 py-0.5 text-[10px] rounded transition-all font-medium cursor-pointer",
                      activeStream?.key === st.key
                        ? "bg-[#2F7D57] text-white font-bold shadow-xs"
                        : "text-white/70 hover:text-white hover:bg-white/10"
                    )}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            )}

            {/* Speed selector */}
            <select
              value={playbackRate}
              onChange={(e) => {
                const r = parseFloat(e.target.value);
                setPlaybackRate(r);
                if (videoRef.current) videoRef.current.playbackRate = r;
              }}
              className="bg-black/60 border border-white/20 rounded px-1.5 py-0.5 text-[10px] text-white outline-none cursor-pointer"
            >
              <option value="0.5">0.5x</option>
              <option value="1">1.0x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2.0x</option>
            </select>

            <button
              onClick={toggleFullscreen}
              title="Fullscreen"
              className="text-white/60 hover:text-white transition-colors"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SUB-TABS IMPLEMENTATIONS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* ─── 1. Overview Tab ─── */
function OverviewTab({
  video,
  statusData,
  events,
  onEventSelect,
  onTriggerAnalysis,
  processing,
  selectedMode,
  setSelectedMode,
}: {
  video: BackendVideo;
  statusData: VideoProcessingStatusResponse | null;
  events: UnifiedEvent[];
  onEventSelect: (e: UnifiedEvent) => void;
  onTriggerAnalysis: (mode: string) => void;
  processing: boolean;
  selectedMode: string;
  setSelectedMode: (m: string) => void;
}) {
  const isDone = video.status === "READY" || video.status === "COMPLETED";
  const roadCount = statusData?.engine_statuses?.road?.detections_count !== undefined
    ? Number(statusData.engine_statuses.road.detections_count)
    : events.filter((e) => e.module === "road").length;
  const trafficCount = statusData?.engine_statuses?.traffic?.tracks_count !== undefined
    ? Number(statusData.engine_statuses.traffic.tracks_count)
    : events.filter((e) => e.module === "traffic").length;
  const safetyCount = statusData?.engine_statuses?.safety?.events_count !== undefined
    ? Number(statusData.engine_statuses.safety.events_count)
    : events.filter((e) => e.module === "safety").length;
  const incidentCount = statusData?.engine_statuses?.incident?.rash_driving_count !== undefined
    ? (Number(statusData.engine_statuses.incident.collision_detected ? 1 : 0) +
       Number(statusData.engine_statuses.incident.hit_and_run_candidate ? 1 : 0) +
       Number(statusData.engine_statuses.incident.rash_driving_count || 0))
    : events.filter((e) => e.module === "incident").length;

  const MODES = [
    { id: "multi_engine", label: "All AI Engines (Unified)", icon: Sparkles, desc: "Run Road, Traffic, Safety & Incident pipelines concurrently" },
    { id: "road", label: "Road & Surface", icon: AlertTriangle, desc: "RDD2022 pothole & crack segmentation" },
    { id: "traffic", label: "Traffic Flow", icon: Car, desc: "Vehicle volume, class velocity & density" },
    { id: "safety", label: "VRU Safety", icon: Shield, desc: "Pedestrian & vulnerable user hazard engine" },
    { id: "incident", label: "Incident + ANPR", icon: Zap, desc: "Collision, rash driving & license recognition" },
  ];

  // Engine stage telemetry derived strictly from backend statusData
  const engineStatuses = statusData?.engine_statuses || {};
  const jobStatus = statusData?.job_status;

  const getStageState = (engineKey: string): { status: string; reason?: string } => {
    const raw = engineStatuses[engineKey];
    if (raw) {
      if (typeof raw === "string") return { status: raw };
      return { status: raw.status || "queued", reason: raw.reason || raw.error };
    }
    if (processing) {
      if (jobStatus === "ROAD_ANALYSIS" && engineKey === "road") return { status: "running" };
      if (jobStatus === "TRAFFIC_ANALYSIS" && engineKey === "traffic") return { status: "running" };
      if (jobStatus === "SAFETY_ANALYSIS" && engineKey === "safety") return { status: "running" };
      if (jobStatus === "INCIDENT_ANALYSIS" && engineKey === "incident") return { status: "running" };
      return { status: "queued" };
    }
    if (isDone) return { status: "completed" };
    return { status: "queued" };
  };

  const STAGES = [
    { key: "road", name: "Road Defects (RDD2022)", icon: AlertTriangle, count: roadCount, unit: "defects" },
    { key: "traffic", name: "Traffic Flow (UrbianTracker)", icon: Car, count: trafficCount, unit: "tracked vehicles" },
    { key: "safety", name: "VRU Safety (Pedestrian)", icon: Shield, count: safetyCount, unit: "hazards" },
    { key: "incident", name: "Incident + ANPR (Multi-Signal)", icon: Zap, count: incidentCount, unit: "candidates" },
  ];

  return (
    <div className="space-y-4">
      {/* Engine Status & Execution Control */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              AI Processing Engine Control
            </h3>
            <p className="text-[11px] text-slate-500">
              Execute neural inference pipelines on this video asset under unified telemetry
            </p>
          </div>
          <button
            onClick={() => onTriggerAnalysis(selectedMode)}
            disabled={processing}
            className="flex items-center gap-2 rounded bg-[#174A35] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2F7D57] disabled:opacity-50 transition-colors shadow-xs shrink-0"
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin text-[#4ADE80]" /> : <Sparkles className="h-4 w-4 text-[#4ADE80]" />}
            {processing ? "Executing AI Pipeline..." : isDone ? "Reprocess Video" : "Start AI Analysis"}
          </button>
        </div>

        {/* Mode Selector */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
            Execution Mode Selector
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {MODES.map((m) => {
              const Icon = m.icon;
              const isSelected = selectedMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMode(m.id)}
                  disabled={processing}
                  className={cn(
                    "flex flex-col text-left p-2.5 rounded-lg border transition-all cursor-pointer",
                    isSelected
                      ? "border-[#2F7D57] bg-[#EEF7F1] shadow-2xs ring-1 ring-[#2F7D57]/30"
                      : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 hover:border-slate-300",
                    processing && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={cn("h-3.5 w-3.5", isSelected ? "text-[#174A35]" : "text-slate-500")} />
                    <span className={cn("text-xs font-bold truncate", isSelected ? "text-[#174A35]" : "text-slate-700")}>
                      {m.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 line-clamp-2 leading-tight">
                    {m.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Real-Time Multi-Stage Execution Pipeline */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Stage Pipeline Status
            </span>
            {processing && (
              <span className="font-mono text-[11px] text-[#2F7D57] font-bold flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> In Progress ({statusData?.frames_processed || 0} / {statusData?.total_frames || video.frame_count || 330} frames)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            {STAGES.map((st) => {
              const stageInfo = getStageState(st.key);
              const state = stageInfo.status;
              const Icon = st.icon;

              const stateBadge: Record<string, { cls: string; label: string }> = {
                running: { cls: "bg-amber-50 text-amber-800 border-amber-300 animate-pulse", label: "Running" },
                completed: { cls: "bg-[#DCEFE4] text-[#174A35] border-[#2F7D57]/30", label: "Completed" },
                failed: { cls: "bg-rose-50 text-rose-700 border-rose-300", label: "Failed" },
                unavailable: { cls: "bg-slate-100 text-slate-600 border-slate-300", label: "Unavailable" },
                skipped: { cls: "bg-slate-100 text-slate-500 border-slate-200", label: "Skipped" },
                queued: { cls: "bg-slate-50 text-slate-600 border-slate-200", label: "Pending" },
              };
              const badge = stateBadge[state] || { cls: "bg-slate-50 text-slate-500 border-slate-200", label: state };

              return (
                <div
                  key={st.key}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                      <Icon className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                      <span className="truncate">{st.name}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="font-data text-lg font-bold text-slate-900 block leading-tight">
                        {st.count}
                      </span>
                      <span className="text-[10px] text-slate-500 capitalize">{st.unit}</span>
                    </div>
                    <span
                      title={stageInfo.reason || undefined}
                      className={cn("text-[9px] font-bold uppercase rounded px-1.5 py-0.5 border", badge.cls)}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Granular Progress Indicator */}
          {processing && (
            <div className="pt-3">
              <ProgressBar
                value={statusData?.progress_percentage || 25}
                label={`Stage Active: ${jobStatus?.replace(/_/g, " ") || "Processing video frames"}`}
                sublabel={`${statusData?.frames_processed || 0} / ${statusData?.total_frames || video.frame_count || 330} frames`}
              />
            </div>
          )}

          {statusData?.error_message && (
            <div className="mt-3 rounded-md bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{statusData.error_message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Observation Feed with Click-to-Seek */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Detected Events Across All Modules ({events.length})
          </span>
          <span className="text-[11px] text-slate-500">Click any row to seek video player</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {events.length === 0 ? (
            <div className="p-6 text-center text-slate-400 space-y-2">
              <Film className="h-8 w-8 mx-auto text-slate-300" />
              <p className="text-xs">No analysis events generated yet.</p>
              <button
                onClick={() => onTriggerAnalysis(selectedMode)}
                className="text-xs font-semibold text-[#2F7D57] hover:underline"
              >
                Run AI Pipeline →
              </button>
            </div>
          ) : (
            events.map((ev) => (
              <EventRow key={ev.id} event={ev} onSelect={onEventSelect} isSelected={false} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── 2. Road & Infrastructure Tab ─── */
function RoadTab({
  video,
  events,
  statusData,
  onEventSelect,
  selectedEvent,
  onTriggerAnalysis,
  onSelectStream,
}: {
  video: BackendVideo;
  events: UnifiedEvent[];
  statusData: VideoProcessingStatusResponse | null;
  onEventSelect: (e: UnifiedEvent) => void;
  selectedEvent: UnifiedEvent | null;
  onTriggerAnalysis: () => void;
  onSelectStream?: (streamKey: string) => void;
}) {
  const [filterType, setFilterType] = useState<"all" | "pothole" | "crack" | "priority">("all");
  const [inspectModalDefect, setInspectModalDefect] = useState<UnifiedEvent | null>(null);

  const resolveImgUrl = (u: string) => {
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    return `${env.backendUrl}${u.startsWith("/") ? u : `/${u}`}`;
  };

  const roadEvents = events.filter((e) => e.module === "road");
  const potholeEvents = roadEvents.filter(
    (e) =>
      e.label.toLowerCase().includes("pothole") ||
      (e.extra?.["damage_class"] as string) === "D40" ||
      e.detail?.toLowerCase().includes("pothole")
  );
  const crackEvents = roadEvents.filter(
    (e) =>
      e.label.toLowerCase().includes("crack") ||
      ["D00", "D10", "D20"].includes(e.extra?.["damage_class"] as string) ||
      e.detail?.toLowerCase().includes("crack")
  );
  const critical = roadEvents.filter((e) => e.severity === "critical").length;
  const high = roadEvents.filter((e) => e.severity === "high").length;
  const watch = roadEvents.filter((e) => e.severity === "medium" || e.severity === "low").length;

  const defectsWithEvidence = roadEvents.filter((e) => Boolean(e.evidenceUrl));

  const filteredEvidence = defectsWithEvidence.filter((ev) => {
    if (filterType === "pothole") {
      return (
        ev.label.toLowerCase().includes("pothole") ||
        (ev.extra?.["damage_class"] as string) === "D40" ||
        ev.detail?.toLowerCase().includes("pothole")
      );
    }
    if (filterType === "crack") {
      return (
        ev.label.toLowerCase().includes("crack") ||
        ["D00", "D10", "D20"].includes(ev.extra?.["damage_class"] as string) ||
        ev.detail?.toLowerCase().includes("crack")
      );
    }
    if (filterType === "priority") {
      return ev.severity === "critical" || ev.severity === "high";
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Annotated Road Stream Banner */}
      {statusData?.annotated_road_path && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-[#2F7D57]/30 bg-[#EEF7F1] shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#174A35] flex items-center justify-center text-[#4ADE80] shrink-0">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                Road AI Video Stream Available (RDD2022 Overlays)
                <span className="text-[10px] bg-[#2F7D57] text-white px-1.5 py-0.5 rounded font-semibold">
                  Annotated MP4
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Displays real-time bounding boxes with confidence scores directly onto video frames.
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelectStream?.("road")}
            className="px-3.5 py-1.5 rounded-md bg-[#174A35] text-white text-xs font-semibold hover:bg-[#2F7D57] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
          >
            <Play className="h-3.5 w-3.5 fill-current text-[#4ADE80]" />
            Watch Road AI Annotated Stream
          </button>
        </div>
      )}

      {/* Header Metric Cards */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Road & Infrastructure AI
            </h3>
            <p className="text-[11px] text-slate-500">
              Automated detection of potholes (D40), surface cracks (D00/D10/D20), waterlogging, and signage
            </p>
          </div>
          <span className="text-xs font-semibold text-[#2F7D57] flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> RDD2022 Model
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-center">
            <div className="font-data text-lg font-bold text-slate-900">{roadEvents.length}</div>
            <div className="text-[10px] text-slate-500">Total Observations</div>
          </div>
          <div className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-center">
            <div className="font-data text-lg font-bold text-rose-700">{potholeEvents.length}</div>
            <div className="text-[10px] text-rose-600">Potholes (D40)</div>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-center">
            <div className="font-data text-lg font-bold text-amber-700">{crackEvents.length}</div>
            <div className="text-[10px] text-amber-600">Cracks (D00-D20)</div>
          </div>
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-center">
            <div className="font-data text-lg font-bold text-emerald-700">{defectsWithEvidence.length}</div>
            <div className="text-[10px] text-emerald-600">Visual Crops Saved</div>
          </div>
        </div>
      </div>

      {/* Visual Defect Evidence Gallery */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-[#2F7D57]" />
              Visual Defect Evidence Gallery ({defectsWithEvidence.length})
            </h3>
            <p className="text-[11px] text-slate-500">
              Captured image crops from the video frames demonstrating pavement distress
            </p>
          </div>

          {/* Gallery Filters */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md text-xs">
            <button
              onClick={() => setFilterType("all")}
              className={cn(
                "px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer",
                filterType === "all" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              )}
            >
              All ({defectsWithEvidence.length})
            </button>
            <button
              onClick={() => setFilterType("pothole")}
              className={cn(
                "px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer",
                filterType === "pothole" ? "bg-white text-rose-700 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              )}
            >
              Potholes ({potholeEvents.filter((e) => e.evidenceUrl).length})
            </button>
            <button
              onClick={() => setFilterType("crack")}
              className={cn(
                "px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer",
                filterType === "crack" ? "bg-white text-amber-700 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              )}
            >
              Cracks ({crackEvents.filter((e) => e.evidenceUrl).length})
            </button>
            <button
              onClick={() => setFilterType("priority")}
              className={cn(
                "px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer",
                filterType === "priority" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              )}
            >
              Priority ({critical + high})
            </button>
          </div>
        </div>

        {filteredEvidence.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <AlertTriangle className="h-8 w-8 mx-auto text-slate-300" />
            <p className="text-xs">No visual crops found matching this filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {filteredEvidence.map((ev) => {
              const imgUrl = resolveImgUrl(ev.evidenceUrl!);
              const isSelected = selectedEvent?.id === ev.id;
              return (
                <div
                  key={ev.id}
                  onClick={() => onEventSelect(ev)}
                  className={cn(
                    "group relative rounded-lg border overflow-hidden bg-slate-50 transition-all cursor-pointer hover:shadow-md",
                    isSelected
                      ? "border-[#2F7D57] ring-2 ring-[#2F7D57]/20 bg-[#EEF7F1]"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className="aspect-[16/10] w-full bg-slate-900 relative overflow-hidden">
                    <img
                      src={imgUrl}
                      alt={ev.label}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <span className="rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white backdrop-blur-xs">
                        {fmtTs(ev.timestamp)}
                      </span>
                      <SeverityBadge severity={ev.severity} />
                    </div>
                    <div className="absolute top-2 right-2">
                      <span className="rounded bg-[#174A35]/90 px-1.5 py-0.5 text-[10px] font-bold text-[#4ADE80] border border-[#4ADE80]/30 shadow-xs">
                        {ev.confidence}% conf
                      </span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2.5">
                      <span className="text-[11px] text-white font-medium flex items-center gap-1">
                        <Play className="h-3 w-3 fill-current text-[#4ADE80]" /> Seek & Play
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectModalDefect(ev);
                        }}
                        className="p-1 rounded bg-black/60 text-white hover:bg-black/90 transition-colors"
                        title="Enlarge Evidence"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 group-hover:text-[#2F7D57] transition-colors truncate">
                        {ev.label}
                      </span>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                        {ev.extra?.["damage_class"] ? String(ev.extra["damage_class"]) : "DEFECT"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1">{ev.detail}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
                      <span>Frame #{ev.extra?.["frame_number"] ?? Math.round(ev.timestamp * 30)}</span>
                      <span className="text-[#2F7D57] font-semibold">Click to seek video →</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Defect Timeline */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Road Defect Timeline ({roadEvents.length})
          </span>
          <span className="text-[11px] text-slate-500">Click to seek timestamp in footage</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {roadEvents.length === 0 ? (
            <div className="p-6 text-center text-slate-400 space-y-2">
              <AlertTriangle className="h-8 w-8 mx-auto text-slate-300" />
              <p className="text-xs">No road defects recorded in this footage.</p>
              <button
                onClick={onTriggerAnalysis}
                className="text-xs font-semibold text-[#2F7D57] hover:underline"
              >
                Run AI Road Analysis →
              </button>
            </div>
          ) : (
            roadEvents.map((ev) => (
              <EventRow
                key={ev.id}
                event={ev}
                onSelect={onEventSelect}
                isSelected={selectedEvent?.id === ev.id}
              />
            ))
          )}
        </div>
      </div>

      {/* Inspect Defect Modal */}
      {inspectModalDefect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={inspectModalDefect.severity} />
                <h4 className="font-bold text-sm text-slate-900">{inspectModalDefect.label}</h4>
              </div>
              <button
                onClick={() => setInspectModalDefect(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {inspectModalDefect.evidenceUrl && (
                <div className="rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-200 shadow-inner">
                  <img
                    src={resolveImgUrl(inspectModalDefect.evidenceUrl)}
                    alt={inspectModalDefect.label}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                  <span className="text-slate-500 block text-[10px]">Timestamp</span>
                  <span className="font-mono font-bold text-slate-900">{fmtTs(inspectModalDefect.timestamp)}</span>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                  <span className="text-slate-500 block text-[10px]">Damage Classification</span>
                  <span className="font-bold text-slate-900">{inspectModalDefect.extra?.["damage_class"] ? String(inspectModalDefect.extra["damage_class"]) : "D40 (Pothole)"}</span>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                  <span className="text-slate-500 block text-[10px]">Model Confidence</span>
                  <span className="font-bold text-emerald-700">{inspectModalDefect.confidence}%</span>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                  <span className="text-slate-500 block text-[10px]">Frame Number</span>
                  <span className="font-mono font-bold text-slate-900">#{inspectModalDefect.extra?.["frame_number"] ?? Math.round(inspectModalDefect.timestamp * 30)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setInspectModalDefect(null)}
                  className="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    onEventSelect(inspectModalDefect);
                    setInspectModalDefect(null);
                  }}
                  className="px-3 py-1.5 rounded-md bg-[#174A35] text-xs font-semibold text-white hover:bg-[#2F7D57] flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5 fill-current" /> Seek Video Player Here
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 3. Traffic Tab ─── */
function TrafficTab({
  video,
  events,
  jobResults,
  statusData,
  onEventSelect,
  selectedEvent,
  onTriggerAnalysis,
  onSelectStream,
}: {
  video: BackendVideo;
  events: UnifiedEvent[];
  jobResults: BackendJobResults | null;
  statusData?: VideoProcessingStatusResponse | null;
  onEventSelect: (e: UnifiedEvent) => void;
  selectedEvent: UnifiedEvent | null;
  onTriggerAnalysis: () => void;
  onSelectStream?: (streamKey: string) => void;
}) {
  const trafficEvents = events.filter((e) => e.module === "traffic");

  const totalTracked = jobResults?.total_unique_vehicles ?? trafficEvents.length;
  const countsMap = (jobResults as any)?.counts_by_class || jobResults?.vehicle_counts_by_class || {};
  const carCount = countsMap["car"] ?? trafficEvents.filter((e) => e.label.toLowerCase().includes("car")).length;
  const motoCount = countsMap["motorcycle"] ?? trafficEvents.filter((e) => e.label.toLowerCase().includes("motorcycle") || e.label.toLowerCase().includes("two")).length;
  const busCount = countsMap["bus"] ?? trafficEvents.filter((e) => e.label.toLowerCase().includes("bus")).length;
  const truckCount = countsMap["truck"] ?? trafficEvents.filter((e) => e.label.toLowerCase().includes("truck")).length;
  const pedestrianCount = countsMap["person"] ?? countsMap["pedestrian"] ?? trafficEvents.filter((e) => e.label.toLowerCase().includes("person") || e.label.toLowerCase().includes("pedestrian")).length;
  const peakDensity = jobResults?.peak_density ?? (totalTracked > 15 ? "HIGH" : totalTracked > 5 ? "MEDIUM" : totalTracked > 0 ? "LOW" : "NONE");
  const congestion = jobResults?.avg_congestion_level ?? (totalTracked > 20 ? "HIGH" : totalTracked > 5 ? "MODERATE" : "LOW");

  const counts = {
    total: totalTracked,
    cars: carCount,
    twoWheelers: motoCount,
    buses: busCount,
    trucks: truckCount,
    pedestrians: pedestrianCount,
    peakDensity,
    congestion,
  };

  return (
    <div className="space-y-4">
      {/* Annotated Traffic Stream Banner */}
      {statusData?.annotated_traffic_path && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-[#2F7D57]/30 bg-[#EEF7F1] shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#174A35] flex items-center justify-center text-[#4ADE80] shrink-0">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                Traffic Flow Video Stream Available (UrbianTracker)
                <span className="text-[10px] bg-[#2F7D57] text-white px-1.5 py-0.5 rounded font-semibold">
                  Track IDs & Flow
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Displays vehicle bounding boxes, persistent track IDs, velocity vectors, and class classifications.
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelectStream?.("traffic")}
            className="px-3.5 py-1.5 rounded-md bg-[#174A35] text-white text-xs font-semibold hover:bg-[#2F7D57] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
          >
            <Play className="h-3.5 w-3.5 fill-current text-[#4ADE80]" />
            Watch Traffic Flow Stream
          </button>
        </div>
      )}

      {/* Vehicle Summary Metrics */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Traffic Intelligence & Density
            </h3>
            <p className="text-[11px] text-slate-500">
              YOLO11x vehicle & pedestrian detection, UrbianTracker (Distance-IoU + class constraint), and flow velocity
            </p>
          </div>
          <span className="text-xs font-semibold text-[#2F7D57] flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Live Telemetry
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="text-slate-600">Total Tracked</span>
            <span className="font-data font-bold text-slate-900">{counts.total}</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="text-slate-600">Cars</span>
            <span className="font-data font-bold text-slate-900">{counts.cars}</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="text-slate-600">Two-wheelers</span>
            <span className="font-data font-bold text-slate-900">{counts.twoWheelers}</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="text-slate-600">Pedestrians</span>
            <span className="font-data font-bold text-slate-900">{counts.pedestrians}</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="text-slate-600">Buses</span>
            <span className="font-data font-bold text-slate-900">{counts.buses}</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="text-slate-600">Trucks / HGV</span>
            <span className="font-data font-bold text-slate-900">{counts.trucks}</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="text-slate-600">Peak Density</span>
            <span className="font-bold text-[#174A35] uppercase text-[11px]">{counts.peakDensity}</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="text-slate-600">Congestion</span>
            <span className="font-bold text-[#2F7D57] uppercase text-[11px]">{counts.congestion}</span>
          </div>
        </div>
      </div>

      {/* Traffic Events Timeline */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Traffic Events & Density Peaks ({trafficEvents.length})
          </span>
          <span className="text-[11px] text-slate-500">Click to seek timestamp</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {trafficEvents.length === 0 ? (
            <div className="p-6 text-center text-slate-400 space-y-2">
              <Car className="h-8 w-8 mx-auto text-slate-300" />
              <p className="text-xs">No discrete traffic anomaly events recorded.</p>
              <button
                onClick={onTriggerAnalysis}
                className="text-xs font-semibold text-[#2F7D57] hover:underline"
              >
                Run Traffic AI Analysis →
              </button>
            </div>
          ) : (
            trafficEvents.map((ev) => (
              <EventRow
                key={ev.id}
                event={ev}
                onSelect={onEventSelect}
                isSelected={selectedEvent?.id === ev.id}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── 4. Safety Tab ─── */
function SafetyTab({
  video,
  events,
  safetyRun,
  safetyStatus,
  onEventSelect,
  selectedEvent,
  onTriggerAnalysis,
}: {
  video: BackendVideo;
  events: UnifiedEvent[];
  safetyRun: SafetyRun | null;
  safetyStatus?: { status: string; reason?: string };
  onEventSelect: (e: UnifiedEvent) => void;
  selectedEvent: UnifiedEvent | null;
  onTriggerAnalysis: () => void;
}) {
  const safetyEvents = events.filter((e) => e.module === "safety");
  const critical = safetyEvents.filter((e) => e.severity === "critical").length;
  const high = safetyEvents.filter((e) => e.severity === "high").length;
  const watch = safetyEvents.filter((e) => e.severity === "medium" || e.severity === "low").length;

  return (
    <div className="space-y-4">
      {/* Safety Intelligence Module Availability Notice */}
      {safetyStatus?.status === "unavailable" && (
        <div className="rounded-lg border border-slate-300 bg-slate-50 p-4 space-y-1.5 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-200 text-slate-700 text-[10px] font-bold uppercase px-2 py-0.5 border border-slate-300">
              Module Unavailable
            </span>
            <span className="text-xs font-semibold text-slate-800">
              Module 3 (SIH2026--Module3) Not Present on Host Node
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            The Pedestrian &amp; VRU Safety Intelligence engine (SIH2026--Module3 repository) is not available in this local environment. In strict adherence to our Zero-Fabrication standards, safety telemetry is not synthesized or simulated.
          </p>
        </div>
      )}

      {/* Safety Metric Cards */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Module 3 — Pedestrian & VRU Safety AI
            </h3>
            <p className="text-[11px] text-slate-500">
              School zone pedestrian crossing, vulnerable road user trajectory, and collision risk scoring
            </p>
          </div>
          <span className={cn(
            "text-xs font-semibold flex items-center gap-1.5",
            safetyStatus?.status === "unavailable" ? "text-slate-500" : "text-[#2F7D57]"
          )}>
            {safetyStatus?.status === "unavailable" ? (
              <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {safetyStatus?.status === "unavailable" ? "Module Unavailable" : "Module 3 VRU Engine"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-center">
            <div className="font-data text-lg font-bold text-rose-700">{critical}</div>
            <div className="text-[10px] text-rose-600 font-semibold">Critical Risks</div>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-center">
            <div className="font-data text-lg font-bold text-amber-700">{high}</div>
            <div className="text-[10px] text-amber-600 font-semibold">High Risk</div>
          </div>
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-2 text-center">
            <div className="font-data text-lg font-bold text-yellow-700">{watch}</div>
            <div className="text-[10px] text-yellow-600 font-semibold">Watch / Crossing</div>
          </div>
        </div>
      </div>

      {/* Safety Events Timeline with Frame Evidence */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Safety Events & Pedestrian Interactions ({safetyEvents.length})
          </span>
          <span className="text-[11px] text-slate-500">Click to seek timestamp</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {safetyEvents.length === 0 ? (
            <div className="p-6 text-center text-slate-400 space-y-2">
              <Shield className="h-8 w-8 mx-auto text-slate-300" />
              <p className="text-xs">No safety hazards detected in this footage.</p>
              <button
                onClick={onTriggerAnalysis}
                className="text-xs font-semibold text-[#2F7D57] hover:underline"
              >
                Run Safety AI Analysis →
              </button>
            </div>
          ) : (
            safetyEvents.map((ev) => (
              <EventRow
                key={ev.id}
                event={ev}
                onSelect={onEventSelect}
                isSelected={selectedEvent?.id === ev.id}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── 5. Incident + ANPR Tab ─── */
function IncidentTab({
  video,
  events,
  statusData,
  onEventSelect,
  selectedEvent,
  onTriggerAnalysis,
  onSelectStream,
}: {
  video: BackendVideo;
  events: UnifiedEvent[];
  statusData?: VideoProcessingStatusResponse | null;
  onEventSelect: (e: UnifiedEvent) => void;
  selectedEvent: UnifiedEvent | null;
  onTriggerAnalysis: () => void;
  onSelectStream?: (streamKey: string) => void;
}) {
  const incidentEvents = events.filter((e) => e.module === "incident");

  return (
    <div className="space-y-4">
      {/* Annotated Incident Stream Banner */}
      {statusData?.annotated_incident_path && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-[#2F7D57]/30 bg-[#EEF7F1] shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#174A35] flex items-center justify-center text-[#4ADE80] shrink-0">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                Incident AI Video Stream Available (Multi-Signal Overlays)
                <span className="text-[10px] bg-[#2F7D57] text-white px-1.5 py-0.5 rounded font-semibold">
                  Incident & ANPR
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Displays collision trajectories, speed/deceleration telemetry, and vehicle tracks.
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelectStream?.("incident")}
            className="px-3.5 py-1.5 rounded-md bg-[#174A35] text-white text-xs font-semibold hover:bg-[#2F7D57] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
          >
            <Play className="h-3.5 w-3.5 fill-current text-[#4ADE80]" />
            Watch Incident Video Stream
          </button>
        </div>
      )}

      {/* Incident Metric Cards */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Incident Detection & Plate Recognition (ANPR)
            </h3>
            <p className="text-[11px] text-slate-500">
              Collision candidates, rash-driving trajectories, hit-and-run investigation, and vehicle tracking
            </p>
          </div>
          <span className="text-xs font-semibold text-[#2F7D57] flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Verification Ready
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <div className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-center">
            <div className="font-data text-lg font-bold text-rose-700">{incidentEvents.length}</div>
            <div className="text-[10px] text-rose-600 font-semibold">Incident Candidates Found</div>
          </div>
          <div className="rounded-md border border-blue-200 bg-blue-50 p-2.5 text-center">
            <div className="font-data text-lg font-bold text-blue-700">
              {incidentEvents.filter((e) => e.extra?.["plate"] || e.extra?.["offending_plate"] || e.extra?.["plate_text"]).length}
            </div>
            <div className="text-[10px] text-blue-600 font-semibold">ANPR Plate Observations</div>
          </div>
        </div>
      </div>

      {/* Incident Candidate Timeline */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Incident Candidates & Plate Records ({incidentEvents.length})
          </span>
          <span className="text-[11px] text-slate-500">Click to seek timestamp</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {incidentEvents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <Zap className="h-8 w-8 mx-auto text-slate-300" />
              <p className="text-xs font-medium text-slate-600">No incident candidates found</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                No collision, near-miss, or rash-driving behavior detected in this footage.
              </p>
            </div>
          ) : (
            incidentEvents.map((ev) => (
              <EventRow
                key={ev.id}
                event={ev}
                onSelect={onEventSelect}
                isSelected={selectedEvent?.id === ev.id}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── 6. Evidence Tab (Visual Evidence & Forensic Artifacts) ─── */
function EvidenceTab({
  events,
  onEventSelect,
  statusData,
}: {
  events: UnifiedEvent[];
  onEventSelect: (e: UnifiedEvent) => void;
  statusData: VideoProcessingStatusResponse | null;
}) {
  const [selectedImg, setSelectedImg] = useState<{ url: string; title: string; desc?: string } | null>(null);

  const evidenceItems = useMemo(() => {
    const list: {
      id: string;
      title: string;
      module: AnalysisModule;
      timestamp: number;
      url: string;
      confidence: number;
      severity: string;
      event: UnifiedEvent;
    }[] = [];

    events.forEach((ev) => {
      if (ev.evidenceUrl) {
        list.push({
          id: ev.id,
          title: ev.label,
          module: ev.module,
          timestamp: ev.timestamp,
          url: ev.evidenceUrl.startsWith("http")
            ? ev.evidenceUrl
            : `${env.backendUrl}${ev.evidenceUrl.startsWith("/") ? "" : "/"}${ev.evidenceUrl}`,
          confidence: ev.confidence,
          severity: ev.severity,
          event: ev,
        });
      }
    });

    return list;
  }, [events]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Evidence & Keyframe Archive ({evidenceItems.length})
            </h3>
            <p className="text-[11px] text-slate-500">
              Direct photographic proof captured by Road, Safety, and Incident neural models
            </p>
          </div>
          <span className="text-xs font-semibold text-[#2F7D57] flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Chain of Custody
          </span>
        </div>
      </div>

      {evidenceItems.length === 0 ? (
        <div className="p-8 text-center text-slate-400 bg-white rounded-lg border border-slate-200 space-y-2 shadow-xs">
          <Film className="h-8 w-8 mx-auto text-slate-300" />
          <p className="text-xs font-semibold text-slate-700">No Visual Evidence Keyframes Extracted</p>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            Run multi-engine analysis to generate defect crops, pedestrian safety risk frames, and collision candidate evidence.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {evidenceItems.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs hover:border-[#2F7D57] transition-all group"
            >
              <div
                className="relative aspect-video bg-black cursor-pointer overflow-hidden flex items-center justify-center"
                onClick={() => setSelectedImg({ url: item.url, title: item.title, desc: `${fmtTs(item.timestamp)} · ${item.module.toUpperCase()} · ${item.confidence}%` })}
              >
                <img
                  src={item.url}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute top-2 right-2">
                  <SeverityBadge severity={item.severity} />
                </div>
                <div className="absolute bottom-2 left-2 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-mono text-white">
                  {fmtTs(item.timestamp)}
                </div>
              </div>

              <div className="p-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 truncate">{item.title}</span>
                  <span className="text-[10px] text-slate-500 font-semibold">{item.confidence}%</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold uppercase text-[#2F7D57] bg-[#EEF7F1] px-1.5 py-0.5 rounded border border-[#DCEFE4]">
                    {item.module}
                  </span>
                  <button
                    onClick={() => onEventSelect(item.event)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#174A35] hover:text-[#2F7D57] transition-colors"
                  >
                    <Play className="h-3 w-3" /> Seek Player
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          onClick={() => setSelectedImg(null)}
        >
          <div
            className="max-w-3xl w-full rounded-xl bg-white overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50">
              <div>
                <h4 className="font-bold text-sm text-slate-900">{selectedImg.title}</h4>
                {selectedImg.desc && <p className="text-xs text-slate-500 font-mono">{selectedImg.desc}</p>}
              </div>
              <button
                onClick={() => setSelectedImg(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-3 bg-black flex items-center justify-center max-h-[70vh]">
              <img src={selectedImg.url} alt={selectedImg.title} className="max-h-[65vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   REAL UPLOAD MODAL COMPONENT (WITH FILE SELECTION & ACTUAL BACKEND PROGRESS)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function UploadModal({
  buses,
  onClose,
  onUpload,
}: {
  buses: { id: string; bus_number?: string; route_number?: string }[];
  onClose: () => void;
  onUpload: (file: File, opts: { bus_id?: string; onUploadProgress?: (p: { loaded: number; total?: number }) => void }) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busId, setBusId] = useState("");
  const [route, setRoute] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      await onUpload(file, {
        bus_id: busId || undefined,
        onUploadProgress: (p) => {
          if (p.total) {
            setUploadProgress(Math.round((p.loaded / p.total) * 100));
          }
        },
      });
      onClose();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || "Upload failed. Please check backend connection.";
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-[#174A35] text-white">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Upload Bus Journey Footage</h3>
              <p className="text-[11px] text-slate-500">Shared asset — analyzed across all 4 AI modules</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-md bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f && (f.type.startsWith("video/") || f.name.match(/\.(mp4|mov|avi|mkv)$/i))) {
                setFile(f);
              }
            }}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
              dragging || file
                ? "border-[#2F7D57] bg-[#EEF7F1]"
                : "border-slate-300 hover:border-[#3F966C] hover:bg-[#F6FAF7]"
            )}
            onClick={() => document.getElementById("vp-file-input")?.click()}
          >
            <input
              id="vp-file-input"
              type="file"
              accept="video/mp4,video/quicktime,video/x-msvideo,.mkv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <Film className="h-8 w-8 text-[#2F7D57]" />
                <div className="text-left min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate max-w-xs">{file.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <Film className="h-8 w-8 text-slate-400 mx-auto" />
                <p className="text-sm font-medium text-slate-700">Drop bus footage here</p>
                <p className="text-xs text-slate-400">MP4, MOV, AVI up to 500MB</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bus Unit</label>
              <select
                value={busId}
                onChange={(e) => setBusId(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#2F7D57]"
              >
                <option value="">Select bus...</option>
                {buses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bus_number || b.id} — Route {b.route_number || "?"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Corridor Name</label>
              <input
                type="text"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                placeholder="e.g. Andheri ⇄ Kurla"
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#2F7D57]"
              />
            </div>
          </div>

          {uploading && (
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Uploading to server storage...</span>
                <span className="font-mono font-bold text-[#2F7D57]">{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#2F7D57] transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-400 leading-relaxed">
            One upload creates a permanent VideoAsset that can be reused across Road, Traffic, Safety and Incident analyses.
          </p>

          <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="rounded-md border border-slate-300 px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || uploading}
              className="flex items-center gap-1.5 rounded-md bg-[#2F7D57] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#245B45] disabled:opacity-50 transition-colors shadow-xs"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? "Uploading Video..." : "Upload & Register Asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   VIDEO LIBRARY (LEFT MASTER PANEL)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function VideoLibrary({
  videos,
  loading,
  selectedVideo,
  onSelect,
  onUpload,
  onRefresh,
}: {
  videos: BackendVideo[];
  loading: boolean;
  selectedVideo: BackendVideo | null;
  onSelect: (v: BackendVideo) => void;
  onUpload: () => void;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    return videos.filter((v) => {
      if (filter !== "all") {
        if (filter === "READY" && v.status !== "READY" && v.status !== "COMPLETED") return false;
        if (filter !== "READY" && v.status !== filter) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          v.original_filename?.toLowerCase().includes(q) ||
          getRoute(v).toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [videos, search, filter]);

  return (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white w-80 shrink-0">
      <div className="border-b border-slate-200 px-4 py-3.5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Video Library
            </h2>
            <p className="text-[11px] text-slate-500">{videos.length} journey assets</p>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={onRefresh}
              title="Refresh Video Library"
              className="grid h-7 w-7 place-items-center rounded border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onUpload}
              className="flex items-center gap-1 rounded bg-[#174A35] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#2F7D57] transition-colors shadow-xs"
            >
              <Plus className="h-3 w-3" />
              Upload
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search footage or route..."
            className="h-7 w-full rounded border border-slate-200 bg-slate-50 pl-7 pr-2 text-[11px] placeholder-slate-400 outline-none focus:border-[#2F7D57] focus:bg-white"
          />
        </div>

        {/* Status Filters */}
        <div className="flex gap-1">
          {[
            { key: "all", label: "All" },
            { key: "READY", label: "Ready" },
            { key: "PROCESSING", label: "Processing" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "px-2 py-0.5 text-[10px] rounded font-medium transition-colors",
                filter === key
                  ? "bg-[#174A35] text-white"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Videos List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-28 text-slate-400 text-xs gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#2F7D57]" /> Loading library...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 text-slate-400 text-xs gap-2 text-center p-4">
            <Film className="h-8 w-8 text-slate-300" />
            <p className="font-semibold text-slate-600">No videos found</p>
            <p className="text-[11px] text-slate-400">Upload bus journey footage to begin analysis</p>
          </div>
        ) : (
          filtered.map((v) => (
            <VideoCard
              key={v.id}
              video={v}
              onOpen={onSelect}
              isSelected={selectedVideo?.id === v.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   VIDEO WORKSPACE (SELECTED VIDEO + SUB-TABS + EVENT DETAILS)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function VideoWorkspace({
  video,
  onBack,
  onRefreshVideo,
}: {
  video: BackendVideo;
  onBack: () => void;
  onRefreshVideo: () => void;
}) {
  const [activeModule, setActiveModule] = useState<AnalysisModule>("overview");
  const [selectedEvent, setSelectedEvent] = useState<UnifiedEvent | null>(null);
  const [seekToTime, setSeekToTime] = useState<number | null>(null);
  const [playerStreamKey, setPlayerStreamKey] = useState<string>("raw");
  const { refreshLiveIntelligence } = useStore();

  // Real backend data states
  const [statusData, setStatusData] = useState<VideoProcessingStatusResponse | null>(null);
  const [safetyRun, setSafetyRun] = useState<SafetyRun | null>(null);
  const [jobResults, setJobResults] = useState<BackendJobResults | null>(null);
  const [urbanEvents, setUrbanEvents] = useState<BackendUrbanEvent[]>([]);
  const [safetyEvents, setSafetyEvents] = useState<SafetyEventListItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Poll status while processing
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadAllData = useCallback(async () => {
    setLoadingData(true);
    try {
      // 1. Video Processing Status
      const st = await getVideoProcessingStatus(video.id).catch(() => null);
      if (st) {
        setStatusData(st);
        if (st.job_status === "PROCESSING" || st.job_status === "QUEUED" || st.video_status === "PROCESSING") {
          setProcessing(true);
        } else {
          setProcessing(false);
        }
      }

      // 2. Safety Run & Safety Events
      const [sEvents, sRun] = await Promise.all([
        getSafetyVideoEvents(video.id, { limit: 100 }).catch(() => ({ data: [] })),
        getSafetyRunForVideo(video.id).catch(() => null),
      ]);
      setSafetyEvents(sEvents.data || []);
      setSafetyRun(sRun);

      // 3. Urban Events (Road, Infrastructure, Incident)
      const uEvents = await getVideoEvents(video.id, { limit: 100 }).catch(() => ({ data: [] }));
      setUrbanEvents(uEvents.data || []);

      // 4. Job Results (Traffic) if job exists
      const jobId = st?.active_job_id || st?.job_id;
      if (jobId) {
        const res = await getProcessingResults(jobId).catch(() => null);
        if (res) setJobResults(res);
      }

      // Sync central live intelligence store
      refreshLiveIntelligence();
    } finally {
      setLoadingData(false);
    }
  }, [video.id, refreshLiveIntelligence]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Polling loop when processing is active
  useEffect(() => {
    if (!processing) return;
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      const st = await getVideoProcessingStatus(video.id).catch(() => null);
      if (st) {
        setStatusData(st);
        if (st.job_status === "COMPLETED" || st.job_status === "FAILED") {
          setProcessing(false);
          clearInterval(pollTimerRef.current!);
          loadAllData();
          onRefreshVideo();
          refreshLiveIntelligence();
        }
      }
    }, 2500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [processing, video.id, loadAllData, onRefreshVideo, refreshLiveIntelligence]);

  const [selectedMode, setSelectedMode] = useState<string>("multi_engine");

  // Trigger processing
  const handleTriggerAnalysis = async (modeToRun?: string) => {
    const runMode = modeToRun || selectedMode || "multi_engine";
    try {
      setProcessing(true);
      await startProcessing(video.id, { mode: runMode, force_reprocess: true });
      await loadAllData();
      await refreshLiveIntelligence();
    } catch (err) {
      console.error("Failed to start processing:", err);
      setProcessing(false);
    }
  };

  // Convert raw DB events to UnifiedEvent format
  const allEvents = useMemo<UnifiedEvent[]>(() => {
    const list: UnifiedEvent[] = [];

    // From Safety Events
    safetyEvents.forEach((se) => {
      const fps = safetyRun?.video_fps || 30.0;
      const ts = se.frame_index ? se.frame_index / fps : (se.start_frame || 0) / fps;
      const rawEvidence = se.evidence_frame_urls || [];
      const evUrl = rawEvidence.length > 0 ? rawEvidence[0] : null;

      list.push({
        id: `safety-${se.id}`,
        module: se.risk_level === "critical" ? "incident" : "safety",
        timestamp: Math.round(ts * 10) / 10,
        label: se.event_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        detail: `Track #${se.track_id} (${se.object_type || "person"}). Risk score: ${Math.round(
          (se.risk_score || 0) * 100
        )}%. ${se.in_school_zone ? "In School Zone." : ""} ${se.road_entry ? "Road entry detected." : ""}`,
        severity: (se.risk_level as "low" | "medium" | "high" | "critical") || "medium",
        confidence: Math.round((se.risk_confidence || se.bbox_confidence || 0.85) * 100),
        evidenceUrl: evUrl,
        coordinates: { lat: se.latitude, lon: se.longitude },
        extra: { ...se },
      });
    });

    // From Urban Events (Road, Infrastructure, Traffic, Incident)
    urbanEvents.forEach((ue) => {
      const mod: AnalysisModule =
        ue.category === "HAZARD" || ue.category === "INFRASTRUCTURE"
          ? "road"
          : ue.category === "SAFETY"
          ? "safety"
          : ue.category === "INCIDENT" || ue.category === "BEHAVIOR"
          ? "incident"
          : "traffic";

      const evUrl =
        (ue.extra_metadata?.["evidence_frame"] as string) ||
        (ue.extra_metadata?.["evidence_ref"] as string) ||
        (ue.extra_metadata?.["evidence_path"] as string) ||
        null;

      const damageClass =
        (ue.extra_metadata?.["damage_class"] as string) ||
        (ue.event_type.toUpperCase().includes("POTHOLE")
          ? "D40"
          : ue.event_type.toUpperCase().includes("ALLIGATOR")
          ? "D20"
          : ue.event_type.toUpperCase().includes("CRACK")
          ? "D00"
          : null);

      const hasBbox =
        ue.bbox_x1 != null &&
        ue.bbox_y1 != null &&
        ue.bbox_x2 != null &&
        ue.bbox_y2 != null;
      const bbox = hasBbox
        ? [ue.bbox_x1 as number, ue.bbox_y1 as number, ue.bbox_x2 as number, ue.bbox_y2 as number]
        : ((ue.extra_metadata?.["bbox"] as number[]) || null);

      const displayLabel = damageClass
        ? `${damageClass} ${ue.event_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`
        : ue.event_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      list.push({
        id: `urban-${ue.id}`,
        module: mod,
        timestamp: Math.round((ue.timestamp || 0) * 10) / 10,
        label: displayLabel,
        detail: ue.description || `${ue.category} event detected at frame ${ue.frame_number}`,
        severity: (ue.severity?.toLowerCase() as "low" | "medium" | "high" | "critical") || "medium",
        confidence: Math.round((ue.confidence || 0.8) * 100),
        evidenceUrl: evUrl,
        coordinates: { lat: ue.latitude, lon: ue.longitude },
        bbox,
        damageClass,
        extra: { ...ue.extra_metadata, damage_class: damageClass, bbox },
      });
    });

    // Sort chronologically
    return list.sort((a, b) => a.timestamp - b.timestamp);
  }, [safetyEvents, safetyRun, urbanEvents]);

  const handleEventSelect = (ev: UnifiedEvent) => {
    setSelectedEvent(ev);
    setSeekToTime(ev.timestamp);
  };

  const roadTabCount = statusData?.engine_statuses?.road?.detections_count !== undefined
    ? Number(statusData.engine_statuses.road.detections_count)
    : allEvents.filter((e) => e.module === "road").length;

  const trafficTabCount = (statusData?.engine_statuses?.traffic?.tracks_count !== undefined
    ? Number(statusData.engine_statuses.traffic.tracks_count)
    : jobResults?.total_unique_vehicles) || allEvents.filter((e) => e.module === "traffic").length;

  const safetyTabCount = statusData?.engine_statuses?.safety?.events_count !== undefined
    ? Number(statusData.engine_statuses.safety.events_count)
    : allEvents.filter((e) => e.module === "safety").length;

  const incidentTabCount = statusData?.engine_statuses?.incident?.rash_driving_count !== undefined
    ? (Number(statusData.engine_statuses.incident.collision_detected ? 1 : 0) +
       Number(statusData.engine_statuses.incident.hit_and_run_candidate ? 1 : 0) +
       Number(statusData.engine_statuses.incident.rash_driving_count || 0))
    : allEvents.filter((e) => e.module === "incident").length;

  const TABS: { key: AnalysisModule; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "overview", label: "Overview", icon: <Eye className="h-3.5 w-3.5" />, count: allEvents.length },
    { key: "road", label: "Road & Infrastructure", icon: <AlertTriangle className="h-3.5 w-3.5" />, count: roadTabCount },
    { key: "traffic", label: "Traffic", icon: <Car className="h-3.5 w-3.5" />, count: trafficTabCount },
    { key: "safety", label: "Safety", icon: <Shield className="h-3.5 w-3.5" />, count: safetyTabCount },
    { key: "incident", label: "Incident + ANPR", icon: <Zap className="h-3.5 w-3.5" />, count: incidentTabCount },
    { key: "evidence", label: "Evidence", icon: <Film className="h-3.5 w-3.5" />, count: allEvents.filter((e) => Boolean(e.evidenceUrl)).length },
  ];

  const statusBadge = getStatusBadge(video.status);

  return (
    <div className="flex flex-1 flex-col min-w-0 min-h-0 bg-slate-50">
      {/* Top Video Header */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3 shadow-2xs">
        <div className="flex items-center gap-2 mb-1.5">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[#174A35] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Video Library
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-semibold text-slate-900 truncate">{humanName(video)}</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#174A35] truncate">{humanName(video)}</h2>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
              <span className="flex items-center gap-1 font-medium text-slate-700">
                <MapPin className="h-3 w-3 text-slate-400" /> {getRoute(video)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono font-medium">
                <Clock className="h-3 w-3 text-slate-400" /> {formatDuration(video.duration)}
              </span>
              <span>•</span>
              <span>{formatDateTime(video.created_at)}</span>
              <span>•</span>
              <span className="font-mono text-slate-400">{formatFileSize(video.file_size)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={cn("inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold", statusBadge.cls)}>
              {statusBadge.label}
            </span>
          </div>
        </div>

        {/* 6 Authoritative Analysis Sub-Tabs */}
        <div className="flex gap-1 mt-3 border-b border-slate-200 -mx-5 px-5 overflow-x-auto">
          {TABS.map(({ key, label, icon, count }) => (
            <button
              key={key}
              onClick={() => {
                setActiveModule(key);
                setSelectedEvent(null);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition-all -mb-px shrink-0 cursor-pointer",
                activeModule === key
                  ? "border-[#2F7D57] text-[#174A35] font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              )}
            >
              {icon}
              {label}
              {count > 0 && (
                <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-mono font-bold text-slate-600">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left side: Video Player + Active Tab Content */}
        <div className="flex flex-1 flex-col min-w-0 overflow-y-auto p-4 space-y-4">
          {/* HTML5 Video Player with Timeline Scrubber & AI Stream Switcher */}
          <VideoPlayer
            video={video}
            events={allEvents}
            seekToTime={seekToTime}
            onEventSelect={handleEventSelect}
            selectedEvent={selectedEvent}
            annotatedStreams={{
              road: statusData?.annotated_road_path,
              traffic: statusData?.annotated_traffic_path,
              safety: statusData?.annotated_safety_path,
              incident: statusData?.annotated_incident_path,
            }}
            activeModule={activeModule}
            streamKey={playerStreamKey}
            onStreamKeyChange={setPlayerStreamKey}
          />

          {/* Sub-Tab View Content */}
          {activeModule === "overview" && (
            <OverviewTab
              video={video}
              statusData={statusData}
              events={allEvents}
              onEventSelect={handleEventSelect}
              onTriggerAnalysis={handleTriggerAnalysis}
              processing={processing}
              selectedMode={selectedMode}
              setSelectedMode={setSelectedMode}
            />
          )}

          {activeModule === "road" && (
            <RoadTab
              video={video}
              events={allEvents}
              statusData={statusData}
              onEventSelect={handleEventSelect}
              selectedEvent={selectedEvent}
              onTriggerAnalysis={() => handleTriggerAnalysis("road")}
              onSelectStream={(k) => setPlayerStreamKey(k)}
            />
          )}

          {activeModule === "traffic" && (
            <TrafficTab
              video={video}
              events={allEvents}
              jobResults={jobResults}
              statusData={statusData}
              onEventSelect={handleEventSelect}
              selectedEvent={selectedEvent}
              onTriggerAnalysis={() => handleTriggerAnalysis("traffic")}
              onSelectStream={(k) => setPlayerStreamKey(k)}
            />
          )}

          {activeModule === "safety" && (
            <SafetyTab
              video={video}
              events={allEvents}
              safetyRun={safetyRun}
              safetyStatus={statusData?.engine_statuses?.["safety"] || { status: video.status === "COMPLETED" ? "unavailable" : "queued" }}
              onEventSelect={handleEventSelect}
              selectedEvent={selectedEvent}
              onTriggerAnalysis={() => handleTriggerAnalysis("safety")}
            />
          )}

          {activeModule === "incident" && (
            <IncidentTab
              video={video}
              events={allEvents}
              statusData={statusData}
              onEventSelect={handleEventSelect}
              selectedEvent={selectedEvent}
              onTriggerAnalysis={() => handleTriggerAnalysis("incident")}
              onSelectStream={(k) => setPlayerStreamKey(k)}
            />
          )}

          {activeModule === "evidence" && (
            <EvidenceTab
              events={allEvents}
              onEventSelect={handleEventSelect}
              statusData={statusData}
            />
          )}
        </div>

        {/* Right side: Event Detail Inspector Drawer (when an event is selected) */}
        {selectedEvent && (
          <div className="w-80 shrink-0 border-l border-slate-200 bg-white overflow-y-auto flex flex-col">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Observation Detail
              </span>
              <button
                onClick={() => setSelectedEvent(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 flex-1">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge severity={selectedEvent.severity} />
                  <span className="font-mono text-xs font-bold text-[#2F7D57] bg-[#DCEFE4] px-1.5 py-0.5 rounded">
                    {fmtTs(selectedEvent.timestamp)}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-1">{selectedEvent.label}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{selectedEvent.detail}</p>
              </div>

              {/* Metadata specs */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Module</span>
                  <span className="font-semibold text-slate-900 uppercase">{selectedEvent.module}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Model Confidence</span>
                  <span className="font-bold text-slate-900">{selectedEvent.confidence}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Source Video</span>
                  <span className="font-medium text-slate-700 truncate max-w-[140px]">
                    {video.original_filename}
                  </span>
                </div>
                {selectedEvent.coordinates?.lat && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">GPS Coordinates</span>
                    <span className="font-mono text-[11px] text-slate-700">
                      {selectedEvent.coordinates.lat.toFixed(4)}, {selectedEvent.coordinates.lon?.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>

              {/* Evidence Frame Preview */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Visual Evidence Frame
                </span>
                {selectedEvent.evidenceUrl ? (
                  <div className="rounded-lg overflow-hidden border border-slate-200 bg-black aspect-video flex items-center justify-center shadow-xs">
                    <img
                      src={
                        selectedEvent.evidenceUrl.startsWith("http")
                          ? selectedEvent.evidenceUrl
                          : `${env.backendUrl}${selectedEvent.evidenceUrl.startsWith("/") ? "" : "/"}${selectedEvent.evidenceUrl}`
                      }
                      alt="Event evidence"
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center bg-slate-50 text-slate-400 space-y-1">
                    <Film className="h-6 w-6 mx-auto text-slate-300" />
                    <p className="text-[11px]">Keyframe captured at {fmtTs(selectedEvent.timestamp)}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  onClick={() => {
                    setSeekToTime(selectedEvent.timestamp);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-md bg-[#174A35] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2F7D57] transition-colors shadow-xs"
                >
                  <Play className="h-3.5 w-3.5" /> Seek Player to Frame
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   EMPTY WORKSPACE STATE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function EmptyWorkspace({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center p-8 bg-slate-50">
      <div className="grid h-20 w-20 place-items-center rounded-2xl bg-[#EEF7F1] border border-[#DCEFE4] shadow-xs">
        <Film className="h-10 w-10 text-[#2F7D57]" />
      </div>
      <div className="max-w-md space-y-1.5">
        <h3 className="text-base font-bold text-slate-900">
          Video Processing & Intelligence Workspace
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Select an uploaded bus journey from the library, or upload new footage. A single uploaded video serves as the unified source asset for Road, Traffic, Safety, and Incident neural pipelines.
        </p>
      </div>
      <button
        onClick={onUpload}
        className="flex items-center gap-1.5 rounded-md bg-[#174A35] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2F7D57] transition-colors shadow-xs"
      >
        <Plus className="h-4 w-4" />
        Upload First Video
      </button>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AUTHORITATIVE PAGE ROOT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export function VideosPage() {
  const { videos, loading, refresh, uploadVideo } = useVideos();
  const { buses } = useBuses();
  const [selectedVideo, setSelectedVideo] = useState<BackendVideo | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Auto-select first video once loaded if none selected
  useEffect(() => {
    if (!selectedVideo && videos.length > 0) {
      setSelectedVideo(videos[0]);
    }
  }, [videos, selectedVideo]);

  const handleUpload = async (
    file: File,
    opts: { bus_id?: string; onUploadProgress?: (p: { loaded: number; total?: number }) => void }
  ) => {
    const uploaded = await uploadVideo(file, opts);
    await refresh();
    if (uploaded) {
      setSelectedVideo(uploaded);
      try {
        await startProcessing(uploaded.id, { mode: "multi_engine", force_reprocess: true });
        await refresh();
      } catch (err) {
        console.error("Auto-trigger processing error:", err);
      }
    }
  };

  return (
    <AppShell>
      <div className="flex h-full min-h-0 -m-3 sm:-m-4 overflow-hidden">
        {/* Left Side: Video Library */}
        <VideoLibrary
          videos={videos}
          loading={loading}
          selectedVideo={selectedVideo}
          onSelect={setSelectedVideo}
          onUpload={() => setUploadOpen(true)}
          onRefresh={refresh}
        />

        {/* Right Side: Selected Video Workspace */}
        {selectedVideo ? (
          <VideoWorkspace
            key={selectedVideo.id}
            video={selectedVideo}
            onBack={() => setSelectedVideo(null)}
            onRefreshVideo={refresh}
          />
        ) : (
          <EmptyWorkspace onUpload={() => setUploadOpen(true)} />
        )}
      </div>

      {/* Upload Modal */}
      {uploadOpen && (
        <UploadModal
          buses={buses}
          onClose={() => setUploadOpen(false)}
          onUpload={handleUpload}
        />
      )}
    </AppShell>
  );
}
