import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bus,
  Layers,
  MapPin,
  ShieldAlert,
  TrafficCone,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MapView, MapLegend } from "@/components/maps/MapView";
import { IssueDetailDrawer } from "@/components/issues/IssueDetailDrawer";
import { useStore } from "@/state/app-store";
import type { Issue } from "@/types";

export type IntelligenceView =
  | "road"
  | "traffic"
  | "safety";

export function CityMapPage() {
  const { issues, buses, layers, toggleLayer, selectedIssueId, selectIssue } = useStore();
  const [activeDrawerIssue, setActiveDrawerIssue] = useState<Issue | null>(null);

  // Dropdown selector state
  const [intelligenceView, setIntelligenceView] = useState<IntelligenceView>("road");

  // Dynamically filter issues based on the selected Intelligence View
  const filteredIssues = useMemo(() => {
    return issues.filter((iss) => {
      if (intelligenceView === "road") {
        return ["pothole", "crack", "missing_divider", "waterlogging", "debris", "infrastructure", "hazard"].includes(iss.category);
      }
      if (intelligenceView === "traffic") {
        return ["traffic", "congestion", "traffic_sign", "signal"].includes(iss.category);
      }
      if (intelligenceView === "safety") {
        return ["incident", "safety", "zebra_crossing", "vru", "behavior"].includes(iss.category);
      }
      return false;
    });
  }, [issues, intelligenceView]);

  const handleSelectMarker = (issueId: string) => {
    selectIssue(issueId);
    const found = issues.find((i) => i.id === issueId);
    if (found) {
      setActiveDrawerIssue(found);
    }
  };

  return (
    <AppShell>
      <div className="relative flex flex-1 flex-col rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden h-[calc(100vh-80px)]">
        {/* Top Intelligence View Selector & Map Controls Overlay */}
        <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white/95 backdrop-blur-md p-2.5 shadow-lg">
          {/* Intelligence View Selector Dropdown */}
          <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Intelligence View:
            </span>
            <select
              value={intelligenceView}
              onChange={(e) => setIntelligenceView(e.target.value as IntelligenceView)}
              className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            >
              <option value="road">Road & Infrastructure Intelligence</option>
              <option value="traffic">Traffic Intelligence</option>
              <option value="safety">Safety & Incident Intelligence</option>
            </select>
          </div>

          {/* Quick Fleet Toggle */}
          <button
            onClick={() => toggleLayer("buses")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
              layers.buses
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Bus className={`h-3.5 w-3.5 ${layers.buses ? "text-blue-400" : "text-slate-500"}`} />
            <span>Show Fleet Buses</span>
          </button>
        </div>

        {/* Reused Mapbox GL JS WebGL Engine */}
        <div className="relative h-full w-full">
          <MapView
            issues={filteredIssues}
            buses={buses}
            layers={layers}
            selectedIssueId={selectedIssueId}
            onSelectIssue={handleSelectMarker}
            className="h-full w-full"
          />
        </div>

        {/* Floating Map Legend (Bottom Left Overlay) */}
        <div className="absolute bottom-4 left-4 z-20">
          <MapLegend className="bg-white/95 backdrop-blur-md border border-slate-200 text-slate-800 shadow-lg" />
        </div>

        {/* Floating Active Count Overlay (Top Right) */}
        <div className="absolute top-4 right-4 z-20 rounded-lg border border-slate-200 bg-white/95 backdrop-blur-md px-3 py-2 text-xs shadow-lg flex items-center gap-4">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Active View Points</span>
            <span className="font-bold text-slate-900 font-mono text-sm">{filteredIssues.length} Markers</span>
          </div>
          {layers.buses && (
            <div className="border-l border-slate-200 pl-4">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Tracked Fleet</span>
              <span className="font-bold text-slate-900 font-mono text-sm">{buses.length} Buses</span>
            </div>
          )}
        </div>
      </div>

      {/* Shared Issue Detail Drawer when marker clicked */}
      <IssueDetailDrawer
        issue={activeDrawerIssue}
        onClose={() => {
          setActiveDrawerIssue(null);
          selectIssue(null);
        }}
      />
    </AppShell>
  );
}
