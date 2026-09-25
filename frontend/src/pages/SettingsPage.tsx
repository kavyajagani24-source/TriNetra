import { useState } from "react";
import {
  Bell,
  CheckCircle2,
  Cpu,
  Database,
  KeyRound,
  LogOut,
  MapPin,
  RefreshCw,
  Server,
  Shield,
  Sliders,
  User,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useStore } from "@/state/app-store";
import type { Role } from "@/types";
import { API_BASE_URL, BACKEND_URL } from "@/config/env";
import { MAPBOX_ACCESS_TOKEN } from "@/config/map";
import { checkHealth, checkDatabaseHealth } from "@/services/api/health";
import { useDemoMode } from "@/hooks/useDemoMode";

const ROLE_LABELS: Record<Role, string> = {
  pwd: "PWD Engineer",
  traffic: "Traffic Police Officer",
  transport: "Transport Authority",
  executive: "Municipal Commissioner",
};

export function SettingsPage() {
  const { role, setRole } = useStore();
  const { isDemoMode, toggleDemoMode, backendOnline, isCheckingBackend, checkBackendStatus } = useDemoMode();

  const [activeSection, setActiveSection] = useState<"system" | "detection" | "notifications" | "account">("system");

  // Detection Toggles State
  const [enabledClasses, setEnabledClasses] = useState({
    potholes: true,
    cracks: true,
    waterlogging: true,
    traffic: true,
    vru_safety: true,
    anpr_plates: true,
  });

  // Notification Toggles State
  const [notifications, setNotifications] = useState({
    p1_hazards: true,
    incidents: true,
    system_alerts: true,
    verification: true,
  });

  const handleTestConnection = async () => {
    toast.promise(
      Promise.all([checkHealth(), checkDatabaseHealth()]),
      {
        loading: "Testing FastAPI backend & PostgreSQL database connection...",
        success: ([api, db]) => `FastAPI online (${api.service} v${api.version}) · Database: ${db.status}`,
        error: (err) => `Connection failed: ${err.message || "Backend offline"}`,
      }
    );
  };

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Settings Secondary Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-lg shadow-xs">
          {[
            { id: "system" as const, label: "System & Infrastructure", icon: Server },
            { id: "detection" as const, label: "Detection & AI Pipelines", icon: Cpu },
            { id: "notifications" as const, label: "Notifications & Alerts", icon: Bell },
            { id: "account" as const, label: "Account & Role Context", icon: User },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
                  active
                    ? "border-blue-700 text-blue-700"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-blue-700" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 1. System Section */}
        {activeSection === "system" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-2">
                System Operational Health & Backend Connection
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Backend API Status</span>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${backendOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                    <span className="font-bold text-slate-900 text-xs">
                      {backendOnline ? "FastAPI Online" : "Client Offline Mode"}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">REST API endpoint synced</span>
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Base API URL</span>
                  <div className="mt-1 font-mono text-xs font-bold text-slate-800 truncate">
                    {API_BASE_URL}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">Static media: {BACKEND_URL}/storage</span>
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Mapbox Engine Integration</span>
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Mapbox GL JS Token Set</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Token: {MAPBOX_ACCESS_TOKEN ? `${MAPBOX_ACCESS_TOKEN.slice(0, 10)}...` : "Demo Mode fallback"}
                  </span>
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 flex flex-col justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Demo Fallback Override</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-semibold text-slate-800">{isDemoMode ? "Enabled" : "Disabled"}</span>
                    <Switch checked={isDemoMode} onCheckedChange={toggleDemoMode} />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <Button size="sm" onClick={handleTestConnection} className="bg-blue-700 hover:bg-blue-800 text-xs">
                  <Server className="mr-1.5 h-3.5 w-3.5" /> Run Backend Connection Test
                </Button>
                <Button size="sm" variant="outline" onClick={checkBackendStatus} disabled={isCheckingBackend} className="text-xs">
                  <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isCheckingBackend ? "animate-spin" : ""}`} /> Ping Status
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Detection Section */}
        {activeSection === "detection" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-2">
                Detection Thresholds & Enabled AI Model Classes
              </h2>

              {/* Thresholds Readout */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
                  <span className="text-slate-500 text-[11px] block">Auto-Route Confidence</span>
                  <span className="font-bold text-slate-900 font-mono">85% minimum</span>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
                  <span className="text-slate-500 text-[11px] block">Corroboration Requirement</span>
                  <span className="font-bold text-slate-900 font-mono">3 bus passes</span>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
                  <span className="text-slate-500 text-[11px] block">Verification Confidence</span>
                  <span className="font-bold text-slate-900 font-mono">90% minimum</span>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
                  <span className="text-slate-500 text-[11px] block">Incident Candidates</span>
                  <span className="font-bold text-slate-900">Always Human Review</span>
                </div>
              </div>

              {/* Class Toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-800 block">Active Detection Classes</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    { key: "potholes" as const, label: "Pothole & Surface Depression Model" },
                    { key: "cracks" as const, label: "Surface Cracking & Fissures Model" },
                    { key: "waterlogging" as const, label: "Waterlogging & Submersion Model" },
                    { key: "traffic" as const, label: "Traffic Congestion & Delay Model" },
                    { key: "vru_safety" as const, label: "Pedestrian Hazard & School Zone Model" },
                    { key: "anpr_plates" as const, label: "ANPR License Plate Recognition Engine" },
                  ].map((cls) => (
                    <label key={cls.key} className="flex items-center justify-between p-2.5 rounded border border-slate-200 bg-slate-50 text-xs">
                      <span className="font-medium text-slate-800">{cls.label}</span>
                      <Switch
                        checked={enabledClasses[cls.key]}
                        onCheckedChange={(checked) =>
                          setEnabledClasses((prev) => ({ ...prev, [cls.key]: checked }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Notifications Section */}
        {activeSection === "notifications" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-2">
                Notification Dispatch & Dispatch Settings
              </h2>
              <div className="space-y-2">
                {[
                  { key: "p1_hazards" as const, label: "Priority P1 Hazard Alerts", desc: "Notify immediately on critical potholes or waterlogging" },
                  { key: "incidents" as const, label: "AI Incident Candidate Flagged", desc: "Notify when a rash driving or collision candidate requires review" },
                  { key: "verification" as const, label: "Verification Candidates Ready", desc: "Notify when 2+ bus passes confirm a defect repair" },
                  { key: "system_alerts" as const, label: "Fleet Telemetry & System Alerts", desc: "Notify if a bus telemetry packet drops offline" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-3 rounded border border-slate-200 bg-slate-50">
                    <div>
                      <span className="font-semibold text-xs text-slate-900 block">{item.label}</span>
                      <span className="text-[11px] text-slate-500">{item.desc}</span>
                    </div>
                    <Switch
                      checked={notifications[item.key]}
                      onCheckedChange={(checked) =>
                        setNotifications((prev) => ({ ...prev, [item.key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4. Account Section */}
        {activeSection === "account" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-2">
                User Profile & Operational Role Context
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-500 block text-[11px]">Officer Name</span>
                  <span className="font-bold text-slate-900 text-sm">K. Jagani</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 block text-[11px]">Organization / Department</span>
                  <span className="font-semibold text-slate-800">Municipal Command Authority</span>
                </div>
              </div>

              {/* Role Context Switcher */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-800 block">Switch Operational Role Context</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        setRole(r);
                        toast.success(`Role context switched to ${ROLE_LABELS[r]}`);
                      }}
                      className={`flex items-center justify-between p-3 rounded border text-xs font-medium text-left transition-colors ${
                        r === role
                          ? "border-blue-600 bg-blue-50 text-blue-800 font-bold"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span>{ROLE_LABELS[r]}</span>
                      {r === role && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
