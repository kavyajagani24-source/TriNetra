import { useState, useRef } from "react";
import { Upload, Video, AlertCircle, Loader2, Play, Cpu, Activity } from "lucide-react";
import { analyzeTrafficVideo, type TrafficAnalysisResponse } from "@/services/api/sixthSense";
import { cn } from "@/lib/utils";

const CONGESTION_COLORS: Record<string, string> = {
  SEVERE: "bg-red-500/20 text-red-400 border-red-500/40",
  HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  LOW: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
};

export function TrafficAnalysisPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<string>("urban_mvp");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrafficAnalysisResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeTrafficVideo(file, profile);
      setResult(res);
    } catch (err: any) {
      console.error("Traffic analysis error:", err);
      setError(err?.message || "Inference failed. Check backend logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/80 bg-card/60 p-4 backdrop-blur-md shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-border/50 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Sixth Sense Traffic AI</h3>
            <p className="text-[11px] text-muted-foreground">YOLO11x + DIoU Tracker</p>
          </div>
        </div>
        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          Live Engine
        </span>
      </div>

      {/* Upload Controls */}
      <div className="space-y-3">
        <div
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "cursor-pointer rounded-lg border-2 border-dashed border-border/80 hover:border-primary/50 transition-all p-3 text-center",
            file ? "bg-primary/5 border-primary/40" : "hover:bg-accent/40"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/avi,video/quicktime,video/webm"
            className="hidden"
            onChange={handleFileChange}
          />
          <Upload className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
          <p className="text-xs font-medium text-foreground truncate">
            {file ? file.name : "Select traffic surveillance video"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">MP4, MOV, AVI up to 100MB</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            className="text-xs bg-muted/60 border border-border rounded-lg px-2.5 py-1.5 text-foreground flex-1 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="urban_mvp">Profile: Urban MVP</option>
            <option value="urban_full">Profile: Urban Full</option>
          </select>

          <button
            onClick={handleAnalyze}
            disabled={!file || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                <span>Run AI</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="break-all">{error}</span>
          </div>
        )}
      </div>

      {/* Live Inference Results Display */}
      {result && (
        <div className="mt-4 pt-3 border-t border-border/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Track Summary</span>
            <span
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded border uppercase",
                CONGESTION_COLORS[result.summary.congestion_level] || "bg-muted text-muted-foreground"
              )}
            >
              Congestion: {result.summary.congestion_level}
            </span>
          </div>

          {/* Vehicle Counts */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="rounded-lg bg-muted/40 p-1.5 border border-border/40">
              <p className="text-[9px] text-muted-foreground uppercase">Total</p>
              <p className="text-sm font-bold text-foreground">{result.summary.total_vehicles}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-1.5 border border-border/40">
              <p className="text-[9px] text-muted-foreground uppercase">Cars</p>
              <p className="text-sm font-bold text-blue-400">{result.summary.cars}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-1.5 border border-border/40">
              <p className="text-[9px] text-muted-foreground uppercase">Buses/Trucks</p>
              <p className="text-sm font-bold text-amber-400">
                {result.summary.buses + result.summary.trucks}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-1.5 border border-border/40">
              <p className="text-[9px] text-muted-foreground uppercase">2-Wheel/Auto</p>
              <p className="text-sm font-bold text-purple-400">
                {result.summary.motorcycles + result.summary.auto_rickshaws}
              </p>
            </div>
          </div>

          {/* Annotated Video Playback */}
          {result.video?.annotated_url && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Video className="h-3 w-3" /> Tracked Video
                </span>
                <span className="text-[10px] font-mono">{result.metrics.inference_device}</span>
              </div>
              <video
                controls
                className="w-full rounded-lg border border-border bg-black max-h-[180px] object-contain"
                src={`/api/traffic/runs/${result.run_id}/video`}
              />
            </div>
          )}

          {/* Unique Vehicle Tracks */}
          {result.detections.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">Confirmed Vehicle Tracks</p>
              <div className="max-h-[140px] overflow-y-auto space-y-1 scroll-thin pr-1">
                {result.detections.slice(0, 15).map((track) => (
                  <div
                    key={track.track_id}
                    className="flex items-center justify-between p-1.5 rounded bg-muted/30 border border-border/40 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-primary">#{track.track_id}</span>{" "}
                      <span className="font-medium text-foreground capitalize">{track.class_name}</span>
                      <p className="text-[10px] text-muted-foreground">
                        {track.classification_source} · {track.age_frames} frames · Conf:{" "}
                        {(track.latest_confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                      {(track.first_seen_ts).toFixed(1)}s - {(track.last_seen_ts).toFixed(1)}s
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
