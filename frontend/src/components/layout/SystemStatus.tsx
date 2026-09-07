import { useEffect } from "react";
import { Activity, Database, Sparkles, Wifi, WifiOff } from "lucide-react";
import { checkHealth } from "@/services/api/health";
import { useAppStore } from "@/store/appStore";

export function SystemStatus() {
  const { demoMode, toggleDemoMode, backendOnline, setBackendOnline } = useAppStore();

  useEffect(() => {
    let mounted = true;
    const testConnection = async () => {
      try {
        await checkHealth();
        if (mounted) setBackendOnline(true);
      } catch {
        if (mounted) setBackendOnline(false);
      }
    };

    testConnection();
    const interval = setInterval(testConnection, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [setBackendOnline]);

  return (
    <div className="flex items-center gap-2 text-[11px]">
      {/* Demo Mode Toggle */}
      <button
        onClick={toggleDemoMode}
        title={demoMode ? "Demo Mode is active. Click to switch to live backend." : "Live mode active. Click to switch to demo mode."}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border font-medium transition-all ${
          demoMode
            ? "bg-amber-950/60 border-amber-800 text-amber-300 hover:bg-amber-900/60 shadow-sm"
            : "bg-secondary border-border text-muted-foreground hover:text-foreground hover:bg-secondary/80"
        }`}
      >
        <Sparkles className="h-3 w-3" />
        <span>{demoMode ? "DEMO MODE" : "LIVE MODE"}</span>
      </button>

      {/* Backend Connection Indicator */}
      <div
        className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold uppercase ${
          backendOnline === true
            ? "bg-emerald-950/60 border-emerald-800 text-emerald-400"
            : backendOnline === false
            ? "bg-red-950/60 border-red-800 text-red-400"
            : "bg-secondary border-border text-muted-foreground"
        }`}
      >
        {backendOnline === true ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Backend Online</span>
          </>
        ) : backendOnline === false ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            <span>Backend Offline</span>
          </>
        ) : (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            <span>Connecting...</span>
          </>
        )}
      </div>
    </div>
  );
}
