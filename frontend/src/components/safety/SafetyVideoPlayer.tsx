import { useCallback, useEffect, useRef, useState } from "react";
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  FastForward,
  Rewind,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  SafetyEventListItem,
  SafetyIncident,
  SafetyRun,
} from "@/types/safety";
import { frameToSeekSeconds, frameToTime, RISK_LEVEL_CONFIG } from "@/types/safety";
import { Button } from "@/components/ui/button";

interface SafetyVideoPlayerProps {
  run: SafetyRun;
  events: SafetyEventListItem[];
  incidents?: SafetyIncident[];
  selectedEventId?: string | null;
  onSeekToEvent?: (event: SafetyEventListItem) => void;
  onSeekToIncident?: (incident: SafetyIncident) => void;
  className?: string;
}

function formatVideoTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  return `${String(m).padStart(2, "0")}:${s.padStart(4, "0")}`;
}

export function SafetyVideoPlayer({
  run,
  events,
  incidents,
  selectedEventId,
  onSeekToEvent,
  onSeekToIncident,
  className,
}: SafetyVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [activeIncident, setActiveIncident] = useState<SafetyIncident | null>(null);
  const fps = run.video_fps || 30;

  const videoUrl = run.annotated_video_path;

  // Compute total duration from run metadata as fallback
  const totalDuration = duration > 0 ? duration : (run.total_frames > 0 ? run.total_frames / fps : 0);

  // Update active event / incident based on current playback position
  useEffect(() => {
    const currentFrame = Math.round(currentTime * fps);

    if (incidents && incidents.length > 0) {
      const active = incidents.find(
        (inc) => currentFrame >= inc.start_frame && currentFrame <= inc.end_frame
      );
      setActiveIncident(active ?? null);
      setActiveEventId(active?.id ?? null);
    } else {
      const active = events.find(
        (e) => currentFrame >= e.start_frame && currentFrame <= e.end_frame
      );
      setActiveEventId(active?.id ?? null);
      setActiveIncident(null);
    }
  }, [currentTime, events, incidents, fps]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, []);

  const seekRelative = useCallback((deltaSeconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || totalDuration, v.currentTime + deltaSeconds));
  }, [totalDuration]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const seekToEvent = useCallback(
    (event: SafetyEventListItem) => {
      const v = videoRef.current;
      if (v) {
        v.currentTime = frameToSeekSeconds(event.start_frame, fps);
        if (v.paused) {
          v.play().catch(() => {});
        }
      }
      onSeekToEvent?.(event);
    },
    [fps, onSeekToEvent]
  );

  // Seek when selectedEventId changes externally
  useEffect(() => {
    if (!selectedEventId) return;
    const ev = events.find((e) => e.id === selectedEventId);
    if (ev) {
      const v = videoRef.current;
      if (v) v.currentTime = frameToSeekSeconds(ev.start_frame, fps);
    }
  }, [selectedEventId, events, fps]);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (v) setCurrentTime(v.currentTime);
  };

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (v && v.duration && !isNaN(v.duration)) {
      setDuration(v.duration);
    }
  };

  const handleScrubberInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    const t = parseFloat(e.target.value);
    if (v) v.currentTime = t;
    setCurrentTime(t);
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.5, 2, 0.5];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length] ?? 1;
    setPlaybackRate(nextRate);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextRate;
    }
  };

  if (!videoUrl) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center",
          className
        )}
      >
        <p className="text-sm text-muted-foreground">
          Annotated safety video not found on server for this run.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden",
        isFullscreen ? "h-full w-full rounded-none" : "",
        className
      )}
    >
      {/* ── Video Viewport ─────────────────────────────────────────────────── */}
      <div
        className="group relative aspect-video w-full bg-black cursor-pointer select-none overflow-hidden"
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          muted={muted}
          playsInline
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={handleLoadedMetadata}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="h-full w-full object-contain"
        />

        {/* Central Play Overlay Button when paused */}
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] transition-all">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-2xl transition hover:scale-110 hover:bg-primary">
              <Play className="h-8 w-8 translate-x-0.5 fill-current" />
            </div>
          </div>
        )}

        {/* Top Badges Overlay */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          {/* Active incident or event badge */}
          {activeIncident ? (
            (() => {
              const cfg = RISK_LEVEL_CONFIG[activeIncident.risk_level];
              return (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider shadow-lg backdrop-blur-md border animate-in fade-in zoom-in-95",
                    cfg.bgClass,
                    cfg.colorClass
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
                  {activeIncident.title} · Pedestrian #{activeIncident.track_id ?? "?"}
                </span>
              );
            })()
          ) : activeEventId ? (
            (() => {
              const ev = events.find((e) => e.id === activeEventId);
              if (!ev) return <div />;
              const cfg = RISK_LEVEL_CONFIG[ev.risk_level];
              return (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider shadow-lg backdrop-blur-md border animate-in fade-in zoom-in-95",
                    cfg.bgClass,
                    cfg.colorClass
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
                  {ev.event_type.replace(/_/g, " ")} · Track #{ev.track_id ?? "?"}
                </span>
              );
            })()
          ) : (
            <div className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-mono text-white/80 backdrop-blur-sm border border-white/10">
              SAFETY AI MODULE 3 · VRU FEED
            </div>
          )}

          {/* Video Metadata Chip */}
          <div className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-mono text-white/80 backdrop-blur-sm border border-white/10">
            {fps} FPS · {run.total_frames} FRAMES
          </div>
        </div>
      </div>

      {/* ── Control Bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-t border-border bg-card/90 px-3 py-2">
        {/* Play/Pause */}
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 hover:bg-primary/10 hover:text-primary"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current translate-x-0.5" />}
        </Button>

        {/* Rewind 5s */}
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => seekRelative(-5)}
          title="Rewind 5s"
        >
          <Rewind className="h-4 w-4" />
        </Button>

        {/* Fast-forward 5s */}
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => seekRelative(5)}
          title="Forward 5s"
        >
          <FastForward className="h-4 w-4" />
        </Button>

        {/* Time code */}
        <span className="num shrink-0 text-[11px] font-mono font-medium text-foreground/80 px-1">
          {formatVideoTime(currentTime)} <span className="opacity-40">/</span> {formatVideoTime(totalDuration)}
        </span>

        {/* Scrubber slider */}
        <div className="relative flex-1 flex items-center mx-1">
          <input
            type="range"
            min={0}
            max={totalDuration || 1}
            step={0.05}
            value={currentTime}
            onChange={handleScrubberInput}
            className="h-1.5 w-full cursor-pointer accent-primary rounded-lg"
            aria-label="Video timeline scrubber"
          />
        </div>

        {/* Speed toggle */}
        <button
          onClick={cyclePlaybackRate}
          className="h-7 px-1.5 rounded text-[11px] font-mono font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition"
          title="Playback speed"
        >
          {playbackRate}x
        </button>

        {/* Mute toggle */}
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>

        {/* Fullscreen */}
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* ── Event / Incident Timeline Scrubber ──────────────────────────────── */}
      {((incidents && incidents.length > 0) || events.length > 0) && totalDuration > 0 && (
        <div className="border-t border-border bg-muted/20 px-3.5 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {incidents && incidents.length > 0
                ? `Key Safety Incidents (${incidents.length} actionable interactions)`
                : `Event Timeline (${events.length} flagged detections)`}
            </span>
            {/* Risk Legend */}
            <div className="flex items-center gap-3">
              {(["high", "medium", "low"] as const).map((lvl) => {
                const count = incidents && incidents.length > 0
                  ? incidents.filter((i) => i.risk_level === lvl).length
                  : events.filter((e) => e.risk_level === lvl).length;
                if (count === 0) return null;
                const cfg = RISK_LEVEL_CONFIG[lvl];
                return (
                  <span key={lvl} className={cn("inline-flex items-center gap-1 text-[10px] font-semibold", cfg.colorClass)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", lvl === "high" ? "bg-critical" : lvl === "medium" ? "bg-warn" : "bg-ok")} />
                    {cfg.label}: {count}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="relative h-6 flex items-center">
            {/* Background track */}
            <div className="absolute inset-x-0 h-2 rounded-full bg-muted/80" />

            {/* Incidents Markers or Raw Event Markers */}
            {incidents && incidents.length > 0
              ? incidents.map((inc) => {
                  const startPct = (frameToSeekSeconds(inc.start_frame, fps) / totalDuration) * 100;
                  const widthPct = Math.max(
                    1.2,
                    (inc.duration_seconds / totalDuration) * 100
                  );
                  const isActive = inc.id === activeEventId || inc.id === selectedEventId;
                  const markerBg =
                    inc.risk_level === "high"
                      ? "bg-critical"
                      : inc.risk_level === "medium"
                        ? "bg-warn"
                        : "bg-ok";

                  return (
                    <button
                      key={inc.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        const v = videoRef.current;
                        if (v) {
                          v.currentTime = frameToSeekSeconds(inc.start_frame, fps);
                          if (v.paused) v.play().catch(() => {});
                        }
                        onSeekToIncident?.(inc);
                        onSeekToEvent?.(inc.primary_event);
                      }}
                      title={`${inc.title} @ ${inc.start_time} - ${inc.end_time} (${inc.duration_seconds.toFixed(1)}s)`}
                      aria-label={`Seek to incident: ${inc.title}`}
                      className={cn(
                        "absolute h-3.5 min-w-[5px] rounded-sm transition-all hover:scale-y-125 hover:z-20 focus-visible:outline-none shadow-sm",
                        markerBg,
                        isActive ? "scale-y-150 ring-2 ring-primary z-10" : "opacity-90"
                      )}
                      style={{
                        left: `${Math.min(98.5, startPct)}%`,
                        width: `${Math.min(100 - startPct, widthPct)}%`,
                      }}
                    />
                  );
                })
              : events.map((ev) => {
                  const startPct = (frameToSeekSeconds(ev.start_frame, fps) / totalDuration) * 100;
                  const widthPct = Math.max(
                    0.8,
                    ((ev.end_frame - ev.start_frame + 1) / fps / totalDuration) * 100
                  );
                  const isActive = ev.id === activeEventId || ev.id === selectedEventId;
                  const markerBg =
                    ev.risk_level === "high"
                      ? "bg-critical"
                      : ev.risk_level === "medium"
                        ? "bg-warn"
                        : "bg-ok";

                  return (
                    <button
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        seekToEvent(ev);
                      }}
                      title={`${ev.event_type.replace(/_/g, " ")} @ ${frameToTime(ev.start_frame, fps)} (Risk: ${ev.risk_score.toFixed(2)})`}
                      aria-label={`Seek to event: ${ev.event_type}`}
                      className={cn(
                        "absolute h-3.5 min-w-[3px] rounded-sm transition-all hover:scale-y-125 hover:z-20 focus-visible:outline-none",
                        markerBg,
                        isActive ? "scale-y-150 ring-2 ring-primary z-10" : "opacity-85"
                      )}
                      style={{
                        left: `${Math.min(99, startPct)}%`,
                        width: `${Math.min(100 - startPct, widthPct)}%`,
                      }}
                    />
                  );
                })}

            {/* Current Playhead */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-primary shadow z-30 transition-all"
              style={{
                left: `${Math.min(99.5, (currentTime / totalDuration) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
