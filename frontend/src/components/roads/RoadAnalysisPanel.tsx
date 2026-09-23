import { useState, useRef } from "react";
import { Upload, Video, AlertCircle, CheckCircle, Loader2, Play, Cpu, Layers } from "lucide-react";
import { analyzeRoadVideo, type RoadAnalysisResponse } from "@/services/api/sixthSense";
import { cn } from "@/lib/utils";

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/40",
  HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  LOW: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
};

export function RoadAnalysisPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<string>("urban_mvp");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RoadAnalysisResponse | null>(null);
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
      const res = await analyzeRoadVideo(file, profile);
      setResult(res);
    } catch (err: any) {
      console.error("Road analysis error:", err);
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
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Sixth Sense Road AI</h3>
            <p className="text-[11px] text-muted-foreground">YOLOv12s RDD2022 Deep Model</p>
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
            {file ? file.name : "Select dashcam / drone video"}
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
            <option value="road_damage_sensitive">Profile: Damage Sensitive</option>
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
            <span className="text-xs font-semibold text-foreground">Inference Results</span>
            <span
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded border uppercase",
                SEVERITY_COLORS[result.summary.max_severity] || "bg-muted text-muted-foreground"
              )}
            >
              {result.summary.max_severity}
            </span>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/40 p-2 border border-border/40 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Observations</p>
              <p className="text-base font-bold text-foreground">{result.summary.total_observations}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2 border border-border/40 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Potholes</p>
              <p className="text-base font-bold text-red-400">{result.summary.potholes}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2 border border-border/40 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Cracks</p>
              <p className="text-base font-bold text-amber-400">
                {result.summary.longitudinal_cracks +
                  result.summary.transverse_cracks +
                  result.summary.alligator_cracks}
              </p>
            </div>
          </div>

          {/* Annotated Video Playback */}
          {result.video?.annotated_url && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Video className="h-3 w-3" /> Annotated Stream
                </span>
                <span className="text-[10px] font-mono">{result.metrics.inference_device}</span>
              </div>
              <video
                controls
                className="w-full rounded-lg border border-border bg-black max-h-[180px] object-contain"
                src={`/api/road/runs/${result.run_id}/video`}
              />
            </div>
          )}

          {/* Observations List */}
          {result.detections.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">Detected Road Defects</p>
              <div className="max-h-[140px] overflow-y-auto space-y-1 scroll-thin pr-1">
                {result.detections.map((det, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-1.5 rounded bg-muted/30 border border-border/40 text-xs"
                  >
                    <div>
                      <p className="font-medium text-foreground">{det.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Frame #{det.frame} · {(det.timestamp).toFixed(1)}s · Conf: {(det.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase",
                        SEVERITY_COLORS[det.severity] || "bg-muted text-muted-foreground"
                      )}
                    >
                      {det.severity}
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
