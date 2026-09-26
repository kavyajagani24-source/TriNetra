import { useState } from "react";
import { Bus, AlertTriangle, RotateCcw, Layers } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { AndheriIntelligenceMap, MapLegend } from "@/components/maps/MapView";
import {
  DEMO_REGION,
  ANDHERI_ROADS,
  ANDHERI_STATS,
  CONDITION_CONFIG,
  SEVERITY_MARKER_COLOR,
  type AndheriRoad,
  type AndheriIssue,
} from "@/data/andheri";

// ── CityMapPage ────────────────────────────────────────────────────────────────

export function CityMapPage() {
  const [showFleet, setShowFleet] = useState(false);
  const [selectedRoad, setSelectedRoad] = useState<AndheriRoad | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<AndheriIssue | null>(null);

  const handleSelectRoad = (road: AndheriRoad) => {
    setSelectedRoad(road);
    setSelectedIssue(null);
  };

  const handleSelectIssue = (issue: AndheriIssue) => {
    setSelectedIssue(issue);
    // Also highlight the road this issue belongs to
    const road = ANDHERI_ROADS.find((r) => r.id === issue.roadId) ?? null;
    setSelectedRoad(road);
  };

  const handleClearSelection = () => {
    setSelectedRoad(null);
    setSelectedIssue(null);
  };

  return (
    <AppShell>
      <div className="relative flex flex-1 overflow-hidden rounded-xl border border-white/5 shadow-2xl"
           style={{ height: "calc(100vh - 72px)", background: "#0a0e1a" }}>

        {/* ── Map Canvas ── */}
        <AndheriIntelligenceMap
          showFleet={showFleet}
          selectedRoadId={selectedRoad?.id ?? null}
          selectedIssueId={selectedIssue?.id ?? null}
          onSelectRoad={handleSelectRoad}
          onSelectIssue={handleSelectIssue}
          className="flex-1 h-full w-full"
        />

        {/* ── Top-Left: Intelligence Control Bar ── */}
        <div className="absolute left-4 top-4 z-20 flex flex-col gap-2">
          {/* Intelligence View Label */}
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0d1117]/95 backdrop-blur px-4 py-2.5 shadow-2xl">
            <Layers className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <div>
              <p className="text-[9px] uppercase font-bold tracking-widest text-slate-500">Intelligence View</p>
              <p className="text-xs font-semibold text-slate-100">Road &amp; Infrastructure</p>
            </div>
            {/* Region badge */}
            <span className="ml-2 rounded-md bg-blue-500/20 border border-blue-400/30 px-2 py-0.5 text-[10px] font-bold text-blue-300 uppercase tracking-wider">
              {DEMO_REGION.name} · DEMO
            </span>
          </div>

          {/* Fleet Toggle */}
          <button
            onClick={() => setShowFleet((v) => !v)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all shadow-lg ${
              showFleet
                ? "border-blue-500/50 bg-blue-500/20 text-blue-300"
                : "border-white/10 bg-[#0d1117]/95 text-slate-400 hover:text-slate-200 hover:border-white/20"
            } backdrop-blur`}
          >
            <Bus className={`h-3.5 w-3.5 ${showFleet ? "text-blue-400" : "text-slate-500"}`} />
            Show Fleet Buses
            {showFleet && (
              <span className="ml-auto rounded bg-blue-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                {ANDHERI_STATS.activeBuses} active
              </span>
            )}
          </button>

          {/* Reset to Andheri */}
          {selectedRoad && (
            <button
              onClick={handleClearSelection}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0d1117]/95 backdrop-blur px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-all shadow-lg"
            >
              <RotateCcw className="h-3 w-3" />
              Clear Selection
            </button>
          )}
        </div>

        {/* ── Left Panel: Road Intelligence Overview ── */}
        <div className="absolute left-4 top-32 z-20 w-56 rounded-xl border border-white/10 bg-[#0d1117]/95 backdrop-blur shadow-2xl overflow-hidden">
          {/* Panel header */}
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-[9px] uppercase font-bold tracking-widest text-slate-500">Road Intelligence</p>
            <p className="text-sm font-bold text-slate-100 mt-0.5">{DEMO_REGION.name}</p>
          </div>

          {/* Overview numbers */}
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-[9px] uppercase font-bold tracking-widest text-slate-600 mb-2">Overview</p>
            <div className="grid grid-cols-2 gap-y-2 gap-x-3">
              <Stat label="Surveyed" value={`${ANDHERI_STATS.totalSegments}`} sub="segments" />
              <Stat label="Issues" value={`${ANDHERI_STATS.totalIssues}`} sub="found" color="text-orange-400" />
              <Stat label="Priority" value={`${ANDHERI_STATS.priorityIssues}`} sub="P1 issues" color="text-red-400" />
              <Stat label="Buses" value={`${ANDHERI_STATS.activeBuses}`} sub="active" color="text-blue-400" />
            </div>
          </div>

          {/* Condition breakdown */}
          <div className="px-4 py-3">
            <p className="text-[9px] uppercase font-bold tracking-widest text-slate-600 mb-2">Condition Break-Up</p>
            {(["HEALTHY", "WATCH", "POOR", "CRITICAL"] as const).map((cond) => {
              const count = ANDHERI_STATS[cond.toLowerCase() as "healthy" | "watch" | "poor" | "critical"];
              const cfg = CONDITION_CONFIG[cond];
              const pct = Math.round((count / ANDHERI_STATS.totalSegments) * 100);
              return (
                <div key={cond} className="flex items-center gap-2 mb-1.5">
                  <span className="h-1.5 w-5 rounded-full shrink-0" style={{ background: cfg.color }} />
                  <span className="flex-1 text-[11px] text-slate-400">{cfg.label}</span>
                  <span className="text-[11px] font-semibold text-slate-200">{count}</span>
                  <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: cfg.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Demo notice */}
          <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20">
            <p className="text-[9px] text-amber-400/80 leading-relaxed">
              ⚠ Demo prototype. Conditions are illustrative, not real municipal data.
            </p>
          </div>
        </div>

        {/* ── Right: Road Detail Panel ── */}
        {selectedRoad && !selectedIssue && (
          <div className="absolute right-4 top-4 z-20 w-72 rounded-xl border border-white/10 bg-[#0d1117]/95 backdrop-blur shadow-2xl overflow-hidden">
            <RoadDetailPanel road={selectedRoad} onClose={handleClearSelection} />
          </div>
        )}

        {/* ── Right: Issue Detail Panel ── */}
        {selectedIssue && (
          <div className="absolute right-4 top-4 z-20 w-72 rounded-xl border border-white/10 bg-[#0d1117]/95 backdrop-blur shadow-2xl overflow-hidden">
            <IssueDetailPanel
              issue={selectedIssue}
              road={ANDHERI_ROADS.find((r) => r.id === selectedIssue.roadId) ?? null}
              onClose={handleClearSelection}
            />
          </div>
        )}

        {/* ── Top-Right: Active Count ── */}
        <div className="absolute right-4 bottom-20 z-20 flex flex-col gap-2">
          <div className="rounded-xl border border-white/10 bg-[#0d1117]/95 backdrop-blur px-4 py-2.5 shadow-2xl text-right">
            <p className="text-[9px] uppercase font-bold tracking-widest text-slate-500">Active View</p>
            <p className="text-sm font-bold text-slate-100 font-mono">{ANDHERI_STATS.totalIssues} Issues</p>
          </div>
          {showFleet && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 backdrop-blur px-4 py-2.5 shadow-2xl text-right">
              <p className="text-[9px] uppercase font-bold tracking-widest text-blue-500">Tracked Fleet</p>
              <p className="text-sm font-bold text-blue-300 font-mono">{ANDHERI_STATS.totalBuses} Buses</p>
            </div>
          )}
        </div>

        {/* ── Bottom-Left: Map Legend ── */}
        <div className="absolute bottom-4 left-4 z-20">
          <MapLegend />
        </div>

        {/* ── Bottom-Center: Marker Priority Legend ── */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 rounded-xl border border-white/10 bg-[#0d1117]/95 backdrop-blur px-4 py-2 shadow-2xl">
          <p className="text-[9px] uppercase font-bold tracking-widest text-slate-600 shrink-0">Marker Severity</p>
          {(["critical", "major", "moderate"] as const).map((sev) => (
            <div key={sev} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: SEVERITY_MARKER_COLOR[sev] }} />
              <span className="text-[10px] text-slate-400 capitalize">{sev}</span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Stat({
  label, value, sub, color = "text-slate-100",
}: {
  label: string; value: string; sub: string; color?: string;
}) {
  return (
    <div>
      <p className={`text-base font-bold font-mono ${color}`}>{value}</p>
      <p className="text-[9px] text-slate-600 leading-tight">{label} {sub}</p>
    </div>
  );
}

function RoadDetailPanel({
  road, onClose,
}: {
  road: AndheriRoad; onClose: () => void;
}) {
  const cfg = CONDITION_CONFIG[road.condition];
  return (
    <>
      <div className="flex items-start justify-between px-4 py-3 border-b border-white/5">
        <div>
          <p className="text-[9px] uppercase font-bold tracking-widest text-slate-500">Road Segment</p>
          <p className="text-sm font-bold text-slate-100 mt-0.5 leading-snug">{road.name}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{road.id}</p>
        </div>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-300 text-lg leading-none ml-2">×</button>
      </div>

      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 mb-3">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: cfg.color }} />
          <span className="font-bold text-sm" style={{ color: cfg.color }}>{road.condition}</span>
          <span className="text-slate-500 text-xs">· Score {road.conditionScore}/100</span>
        </div>
        <div className="grid grid-cols-2 gap-y-2 text-xs">
          <InfoRow label="Issue Count" value={String(road.issueCount)} />
          <InfoRow label="Observations" value={String(road.observationCount)} />
          <InfoRow label="Surveyed By" value={`${road.surveyedBuses} buses`} />
          <InfoRow label="Priority" value={road.priority ?? "—"} />
          <InfoRow label="Last Seen" value={road.lastObserved} />
          <InfoRow label="Status" value={road.status} />
        </div>
      </div>

      {/* Condition bar */}
      <div className="px-4 py-3">
        <div className="flex justify-between text-[9px] text-slate-600 mb-1">
          <span>Condition Score</span>
          <span className="font-mono" style={{ color: cfg.color }}>{road.conditionScore}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${road.conditionScore}%`, background: cfg.color }} />
        </div>
      </div>
    </>
  );
}

function IssueDetailPanel({
  issue, road, onClose,
}: {
  issue: AndheriIssue; road: AndheriRoad | null; onClose: () => void;
}) {
  const markerColor = SEVERITY_MARKER_COLOR[issue.severity];
  return (
    <>
      <div className="flex items-start justify-between px-4 py-3 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                  style={{ background: `${markerColor}25`, color: markerColor, border: `1px solid ${markerColor}40` }}>
              {issue.priority}
            </span>
            <span className="text-[9px] text-slate-500 uppercase font-semibold tracking-wider capitalize">
              {issue.type.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-sm font-bold text-slate-100 leading-snug">{issue.title}</p>
          <p className="text-[10px] text-slate-500 mt-1">{issue.id}</p>
        </div>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-300 text-lg leading-none ml-2">×</button>
      </div>

      {road && (
        <div className="px-4 py-2 bg-white/5 border-b border-white/5">
          <p className="text-[9px] text-slate-500">On road</p>
          <p className="text-xs font-semibold text-slate-300">{road.name}</p>
        </div>
      )}

      <div className="px-4 py-3">
        <div className="grid grid-cols-2 gap-y-2 text-xs">
          <InfoRow label="Severity" value={issue.severity} valueColor={markerColor} />
          <InfoRow label="Confidence" value={`${Math.round(issue.confidence * 100)}%`} />
          <InfoRow label="Observed By" value={`${issue.observedBy} buses`} />
          <InfoRow label="Last Seen" value={issue.lastObserved} />
          <InfoRow label="Status" value={issue.status} />
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="flex gap-2">
          <button className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors">
            View Evidence
          </button>
          <button className="flex-1 rounded-lg bg-blue-600/80 border border-blue-500/50 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors">
            Review Task
          </button>
        </div>
      </div>

      <div className="px-4 py-2 bg-amber-500/5 border-t border-amber-500/10">
        <p className="text-[9px] text-amber-500/60">Demo prototype — not real municipal data</p>
      </div>
    </>
  );
}

function InfoRow({
  label, value, valueColor,
}: {
  label: string; value: string; valueColor?: string;
}) {
  return (
    <div>
      <p className="text-[9px] text-slate-600 uppercase tracking-wider">{label}</p>
      <p className="text-xs font-semibold mt-0.5" style={{ color: valueColor ?? "#e2e8f0" }}>{value}</p>
    </div>
  );
}
