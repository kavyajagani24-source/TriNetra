import { AppShell } from "@/components/layout/AppShell";
import { MetaRow, PageHeader, Panel } from "@/components/common/primitives";
import { PrivacyPanel, SecurityPanel } from "@/components/workflow/pieces";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/state/app-store";
import type { Role } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useStoreDemo } from "@/components/layout/demo";
import { useDemoMode } from "@/hooks/useDemoMode";
import { checkHealth, checkDatabaseHealth } from "@/services/api/health";
import { API_BASE_URL, BACKEND_URL } from "@/config/env";
import { Server, Database, RefreshCw, CheckCircle2, Wifi, WifiOff } from "lucide-react";

const ROLE_LABELS: Record<Role, string> = {
  pwd: "PWD Engineer",
  traffic: "Traffic Police",
  transport: "Transport Authority",
  executive: "Commissioner / Executive",
};

const THRESHOLDS = [
  { label: "Auto-route confidence threshold", value: "85%" },
  { label: "Minimum corroborating buses", value: "3 passes" },
  { label: "Verification confidence threshold", value: "90%" },
  { label: "Incident review threshold", value: "Always human" },
];

export function SettingsPage() {
  const { role, setRole } = useStore();
  const { events, fire } = useStoreDemo();
  const { isDemoMode, toggleDemoMode, backendOnline, isCheckingBackend, checkBackendStatus } = useDemoMode();

  const handleTestConnection = async () => {
    toast.promise(
      Promise.all([checkHealth(), checkDatabaseHealth()]),
      {
        loading: "Testing FastAPI backend & PostgreSQL connection...",
        success: ([api, db]) => `FastAPI online (${api.service} v${api.version}) · Database: ${db.status}`,
        error: (err) => `Connection failed: ${err.message || "Backend offline"}`,
      }
    );
  };

  return (
    <AppShell>
      <PageHeader title="Settings, API Integration & Demo Controls" subtitle="Configure FastAPI connection, Demo fallback, and platform privacy settings." />
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
        <div className="grid gap-2 xl:grid-cols-3">
          {/* Backend API Integration Panel */}
          <Panel title="FastAPI Backend Integration" description="Live connection & mobile sensing pipeline" className="xl:col-span-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Connection Status</span>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${backendOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                  <span className="text-[14px] font-bold text-foreground">
                    {backendOnline ? "Online & Synced" : "Offline"}
                  </span>
                </div>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {backendOnline ? "Ready for video processing" : "Running on client demo fallback"}
                </span>
              </div>

              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">FastAPI Endpoint</span>
                <div className="mt-1 truncate font-mono text-[12px] font-semibold text-foreground">
                  {API_BASE_URL}
                </div>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Static media: {BACKEND_URL}/storage
                </span>
              </div>

              <div className="rounded-lg border border-border bg-secondary/30 p-3 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Demo Mode Override</span>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Force mock data regardless of backend status</p>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[12px] font-medium text-foreground">{isDemoMode ? "Enabled" : "Disabled"}</span>
                  <Switch checked={isDemoMode} onCheckedChange={toggleDemoMode} />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-secondary/30 p-3 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Health Diagnostics</span>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Verify database & YOLO pipeline API</p>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestConnection}
                    className="h-8 flex-1 text-[11px]"
                  >
                    <Server className="mr-1.5 h-3.5 w-3.5 text-primary" /> Test Connection
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={checkBackendStatus}
                    disabled={isCheckingBackend}
                    className="h-8 px-2.5"
                    title="Ping Backend"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isCheckingBackend ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            </div>
          </Panel>
          <Panel title="Role & access" description="Views adapt to the signed-in role">
            <div className="space-y-1.5">
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={cn(
                    "w-full rounded border px-2.5 py-2 text-left text-[12px] transition-colors",
                    r === role
                      ? "border-primary/50 bg-info-soft text-primary"
                      : "border-border hover:bg-secondary",
                  )}
                >
                  <span className="block font-medium">{ROLE_LABELS[r]}</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Detection thresholds" description="Read-only in the pilot build">
            <dl>
              {THRESHOLDS.map((t) => (
                <MetaRow key={t.label} label={t.label} value={t.value} />
              ))}
            </dl>
            <div className="mt-2 space-y-2">
              {[
                "Notify on P1 hazards",
                "Notify on DLP-linked defects",
                "Notify on verification candidates",
              ].map((n, i) => (
                <label key={n} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="text-foreground">{n}</span>
                  <Switch defaultChecked={i < 2} />
                </label>
              ))}
            </div>
          </Panel>

          <Panel title="Demo controls" description="Inject synthetic events into the live workspace">
            <div className="grid gap-1.5">
              {events.map((e) => (
                <Button
                  key={e.kind}
                  size="sm"
                  variant="outline"
                  className="h-7 justify-start text-[11px]"
                  onClick={() => {
                    const id = fire(e.kind);
                    toast.success(`${e.label} — ${id} created`);
                  }}
                >
                  {e.label}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Injected events flow through the same triage, routing, and verification logic as
              seeded data.
            </p>
          </Panel>

          <Panel title="Privacy processing" className="xl:col-span-1">
            <PrivacyPanel />
          </Panel>

          <Panel title="Security & audit" className="xl:col-span-2">
            <SecurityPanel />
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
