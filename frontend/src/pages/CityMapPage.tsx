import { useState } from "react";
import {
  AlertTriangle,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
  Wrench,
  Eye,
  ChevronDown,
  Filter,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { AndheriIntelligenceMap, MapLegend } from "@/components/maps/MapView";
import {
  ANDHERI_ROADS,
  ANDHERI_ISSUES,
  ANDHERI_STATS,
  CONDITION_CONFIG,
  type AndheriRoad,
  type AndheriIssue,
} from "@/data/andheri";

// Realistic photographic inspection frames
import evidencePothole from "@/assets/evidence-pothole.jpg";
import evidenceWater from "@/assets/evidence-water.jpg";
import evidenceTraffic from "@/assets/evidence-traffic.jpg";

export function CityMapPage() {
  // Layer visibility states (Native GIS Controls)
  const [showRoadCondition, setShowRoadCondition] = useState(true);
  const [showIssues, setShowIssues] = useState(true);
  const [showFleet, setShowFleet] = useState(false);
  const [showObservations, setShowObservations] = useState(false);
  const [conditionFilter, setConditionFilter] = useState<"ALL" | "CRITICAL" | "POOR_CRITICAL" | "WATCH_POOR">("ALL");

  // Panel & Selection states
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [selectedRoad, setSelectedRoad] = useState<AndheriRoad | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<AndheriIssue | null>(null);

  const handleSelectRoad = (road: AndheriRoad) => {
    setSelectedRoad(road);
    setSelectedIssue(null);
  };

  const handleSelectIssue = (issue: AndheriIssue) => {
    setSelectedIssue(issue);
    const road = ANDHERI_ROADS.find((r) => r.id === issue.roadId) ?? null;
    setSelectedRoad(road);
  };

  const hasSelection = Boolean(selectedIssue || selectedRoad);

  const handleClearSelection = () => {
    setSelectedRoad(null);
    setSelectedIssue(null);
  };

  return (
    <AppShell>
      <div className="relative h-full w-full overflow-hidden bg-[#0A101D] select-none">
        {/* Full Viewport Map Canvas: THE MAP IS THE PRODUCT */}
        <AndheriIntelligenceMap
          showRoadCondition={showRoadCondition}
          showIssues={showIssues}
          showFleet={showFleet}
          showObservations={showObservations}
          conditionFilter={conditionFilter}
          selectedRoadId={selectedRoad?.id}
          selectedIssueId={selectedIssue?.id}
          onSelectRoad={handleSelectRoad}
          onSelectIssue={handleSelectIssue}
          className="h-full w-full"
        />

        {/* ------------------------------------------------------------- */}
        {/* LEFT PANEL: ROAD INTELLIGENCE (GIS Information Architecture) */}
        {/* Sections 6 & 8: Calm, compact, structured, credible */}
        {/* ------------------------------------------------------------- */}
        <div
          className={`absolute top-4 left-4 z-20 transition-transform duration-200 ease-out ${
            isPanelCollapsed ? "-translate-x-[calc(100%+16px)]" : "translate-x-0"
          }`}
        >
          <div className="relative w-72 max-h-[calc(100vh-100px)] rounded-md border border-[#D9E2DC] bg-white shadow-xs flex flex-col overflow-hidden text-xs">
            {/* Header: ROAD INTELLIGENCE / Andheri, Mumbai */}
            <div className="border-b border-[#D9E2DC] px-3.5 py-3 bg-[#F8FAF8]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-ui text-xs font-bold uppercase tracking-wider text-[#1F2933]">
                    ROAD INTELLIGENCE
                  </h2>
                  <p className="font-ui text-[11px] text-[#66736D] font-medium mt-0.5">
                    Andheri, Mumbai
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded bg-[#EEF7F1] border border-[#DDEFE5] px-1.5 py-0.5 text-[10px] font-semibold text-[#245B45]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
                  Active
                </span>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
              {/* SECTION: OVERVIEW */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#66736D] mb-1.5">
                  Overview
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-[#D9E2DC] bg-[#F8FAF8] p-2">
                    <p className="text-[10px] text-[#66736D]">Surveyed</p>
                    <p className="font-data text-sm font-bold text-[#1F2933] mt-0.5">
                      {ANDHERI_STATS.surveyedSegments} <span className="font-data text-[10px] font-normal text-[#66736D]">segments</span>
                    </p>
                  </div>

                  <div className="rounded border border-[#D9E2DC] bg-[#F8FAF8] p-2">
                    <p className="text-[10px] text-[#66736D]">Issues</p>
                    <p className="font-data text-sm font-bold text-[#D97706] mt-0.5">
                      {ANDHERI_STATS.totalIssues} <span className="font-data text-[10px] font-normal text-[#66736D]">detected</span>
                    </p>
                  </div>

                  <div className="rounded border border-[#D9E2DC] bg-[#F8FAF8] p-2">
                    <p className="text-[10px] text-[#66736D]">Priority</p>
                    <p className="font-data text-sm font-bold text-[#DC2626] mt-0.5">
                      {ANDHERI_STATS.priorityIssues} <span className="text-[10px] font-normal text-[#DC2626]">critical</span>
                    </p>
                  </div>

                  <div className="rounded border border-[#D9E2DC] bg-[#F8FAF8] p-2">
                    <p className="text-[10px] text-[#66736D]">Fleet</p>
                    <p className="font-data text-sm font-bold text-[#2563EB] mt-0.5">
                      {ANDHERI_STATS.activeBuses} <span className="font-data text-[10px] font-normal text-[#66736D]">buses</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION: ROAD CONDITION */}
              <div className="border-t border-[#D9E2DC] pt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#66736D]">
                    Road Condition
                  </p>
                  <span className="font-data text-[10px] text-[#66736D]">
                    {ANDHERI_STATS.totalSurveyedKm} km
                  </span>
                </div>

                <div className="space-y-1.5">
                  {/* Healthy */}
                  <div className="rounded border border-[#D9E2DC]/80 bg-[#F8FAF8] px-2 py-1.5">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#10b981]" />
                        <span className="font-semibold text-[#1F2933]">Healthy</span>
                      </div>
                      <span className="font-mono text-[#1F2933] font-bold">
                        {ANDHERI_STATS.conditionBreakdown.healthy}{" "}
                        <span className="font-data text-[10px] font-normal text-[#66736D]">
                          ({ANDHERI_STATS.conditionPercentages.healthy}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#D9E2DC] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#10b981]"
                        style={{ width: `${ANDHERI_STATS.conditionPercentages.healthy}%` }}
                      />
                    </div>
                  </div>

                  {/* Watch */}
                  <div className="rounded border border-[#D9E2DC]/80 bg-[#F8FAF8] px-2 py-1.5">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#eab308]" />
                        <span className="font-semibold text-[#1F2933]">Watch</span>
                      </div>
                      <span className="font-mono text-[#1F2933] font-bold">
                        {ANDHERI_STATS.conditionBreakdown.watch}{" "}
                        <span className="font-data text-[10px] font-normal text-[#66736D]">
                          ({ANDHERI_STATS.conditionPercentages.watch}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#D9E2DC] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#eab308]"
                        style={{ width: `${ANDHERI_STATS.conditionPercentages.watch}%` }}
                      />
                    </div>
                  </div>

                  {/* Poor */}
                  <div className="rounded border border-[#D9E2DC]/80 bg-[#F8FAF8] px-2 py-1.5">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#f97316]" />
                        <span className="font-semibold text-[#1F2933]">Poor</span>
                      </div>
                      <span className="font-mono text-[#1F2933] font-bold">
                        {ANDHERI_STATS.conditionBreakdown.poor}{" "}
                        <span className="font-data text-[10px] font-normal text-[#66736D]">
                          ({ANDHERI_STATS.conditionPercentages.poor}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#f97316]"
                      style={{ width: `${ANDHERI_STATS.conditionPercentages.poor}%` }}
                    />
                  </div>

                  {/* Critical */}
                  <div className="rounded border border-[#D9E2DC]/80 bg-[#F8FAF8] px-2 py-1.5">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
                        <span className="font-semibold text-[#1F2933]">Critical</span>
                      </div>
                      <span className="font-mono text-[#DC2626] font-bold">
                        {ANDHERI_STATS.conditionBreakdown.critical}{" "}
                        <span className="font-data text-[10px] font-normal text-[#66736D]">
                          ({ANDHERI_STATS.conditionPercentages.critical}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#D9E2DC] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#ef4444]"
                        style={{ width: `${ANDHERI_STATS.conditionPercentages.critical}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: LAYERS */}
              <div className="border-t border-[#D9E2DC] pt-3 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#66736D] mb-1">
                  Layers
                </p>

                <label className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-[#F3F6F4] cursor-pointer">
                  <span className="text-xs font-medium text-[#1F2933]">Road condition</span>
                  <input
                    type="checkbox"
                    checked={showRoadCondition}
                    onChange={(e) => setShowRoadCondition(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-[#D9E2DC] text-[#245B45] focus:ring-0 accent-[#245B45] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-[#F3F6F4] cursor-pointer">
                  <span className="text-xs font-medium text-[#1F2933]">Issues</span>
                  <input
                    type="checkbox"
                    checked={showIssues}
                    onChange={(e) => setShowIssues(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-[#D9E2DC] text-[#245B45] focus:ring-0 accent-[#245B45] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-[#F3F6F4] cursor-pointer">
                  <span className="text-xs font-medium text-[#1F2933]">Fleet</span>
                  <input
                    type="checkbox"
                    checked={showFleet}
                    onChange={(e) => setShowFleet(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-[#D9E2DC] text-[#245B45] focus:ring-0 accent-[#245B45] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-[#F3F6F4] cursor-pointer">
                  <span className="text-xs font-medium text-[#1F2933]">Observations</span>
                  <input
                    type="checkbox"
                    checked={showObservations}
                    onChange={(e) => setShowObservations(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-[#D9E2DC] text-[#245B45] focus:ring-0 accent-[#245B45] cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Footer: Prototype data */}
            <div className="border-t border-[#D9E2DC] px-3.5 py-2 bg-[#F8FAF8] text-[10px] text-[#66736D] flex items-center justify-between">
              <span>Prototype data</span>
              <span className="text-[#66736D]/70">Andheri demo environment</span>
            </div>
          </div>

          {/* Collapse / Expand Toggle Button */}
          <button
            onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
            className="absolute -right-3.5 top-4 z-30 grid h-6 w-6 place-items-center rounded-full border border-[#D9E2DC] bg-white text-[#1F2933] shadow-xs hover:bg-[#F3F6F4] transition-colors"
            title={isPanelCollapsed ? "Expand panel" : "Collapse panel"}
            aria-label={isPanelCollapsed ? "Expand panel" : "Collapse panel"}
          >
            {isPanelCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronLeft className="h-3 w-3" />
            )}
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TOP MAP CONTROLS (Section 16) */}
        {/* Road Intelligence · Andheri, Mumbai · All Conditions ▾ */}
        {/* ------------------------------------------------------------- */}
        <div className={`absolute top-4 z-20 flex items-center gap-2 transition-all duration-200 ${hasSelection ? "right-[408px]" : "right-4"}`}>

          <div className="hidden sm:flex items-center gap-2 rounded-md border border-[#D9E2DC] bg-white/95 px-3 py-1.5 text-xs text-[#1F2933] shadow-xs backdrop-blur-xs">
            <span className="font-semibold text-[#1F2933]">Road Intelligence</span>
            <span className="text-[#D9E2DC]">|</span>
            <span className="text-[#66736D]">Andheri, Mumbai</span>
            <span className="text-[#D9E2DC]">|</span>
            <div className="flex items-center gap-1">
              <Filter className="h-3 w-3 text-[#66736D]" />
              <select
                value={conditionFilter}
                onChange={(e) => setConditionFilter(e.target.value as any)}
                className="bg-transparent text-xs font-semibold text-[#245B45] outline-none cursor-pointer"
              >
                <option value="ALL">All Conditions ▾</option>
                <option value="CRITICAL">Critical Only ▾</option>
                <option value="POOR_CRITICAL">Poor &amp; Critical ▾</option>
                <option value="WATCH_POOR">Watch &amp; Poor ▾</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => {
              handleClearSelection();
              setConditionFilter("ALL");
            }}
            className="flex items-center gap-1.5 rounded-md border border-[#D9E2DC] bg-white/95 px-2.5 py-1.5 text-xs font-medium text-[#1F2933] shadow-xs hover:bg-[#F3F6F4] transition-colors backdrop-blur-xs"
            title="Reset map view and filters"
          >
            <RotateCcw className="h-3 w-3 text-[#66736D]" />
            <span>Reset</span>
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* MAP LEGEND (Bottom Right, Unobtrusive) (Section 14) */}
        {/* ------------------------------------------------------------- */}
        <MapLegend className={`absolute bottom-6 z-10 transition-all duration-200 ${hasSelection ? "right-[408px]" : "right-14"}`} />

        {/* ------------------------------------------------------------- */}
        {/* RIGHT DETAIL DRAWER (Section 9, 10, 13) */}
        {/* When nothing selected: NO DRAWER (Maximum map visibility). */}
        {/* When issue selected: Issue Detail Drawer. */}
        {/* When road selected: Road Detail Drawer. */}
        {/* ------------------------------------------------------------- */}
        {selectedIssue && (
          <div className="absolute top-4 right-4 bottom-4 z-30 w-96 rounded-md border border-[#D9E2DC] bg-white shadow-md flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-2 duration-150">
            <IssueDetailDrawer
              issue={selectedIssue}
              onClose={handleClearSelection}
            />
          </div>
        )}

        {!selectedIssue && selectedRoad && (
          <div className="absolute top-4 right-4 bottom-4 z-30 w-96 rounded-md border border-[#D9E2DC] bg-white shadow-md flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-2 duration-150">
            <RoadDetailDrawer
              road={selectedRoad}
              onClose={handleClearSelection}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}

// -----------------------------------------------------------------------------
// ISSUE DETAIL DRAWER (Sections 9 & 10)
// MAJOR POTHOLE / S.V. Road, Andheri / CRITICAL / 91% confidence, 6 bus obs, 14m
// Evidence: [large image]
// Status: Under Review, [Open Task], [View History]
// Technical details ▾ (collapsed by default)
// -----------------------------------------------------------------------------
function IssueDetailDrawer({
  issue,
  onClose,
}: {
  issue: AndheriIssue;
  onClose: () => void;
}) {
  const isCritical = issue.severity === "critical";
  const isMajor = issue.severity === "major";

  const evidenceImg =
    issue.type === "crack"
      ? evidenceWater
      : issue.type === "debris"
      ? evidenceTraffic
      : evidencePothole;

  const confidencePct = Math.round(issue.confidence * 100);

  return (
    <>
      {/* LEVEL 1: Headline & Location */}
      <div className="border-b border-[#D9E2DC] px-4 py-3 bg-[#F8FAF8] flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase text-[#1F2933] leading-snug">
            {issue.title}
          </h3>
          <p className="text-xs text-[#66736D] mt-0.5 font-medium">
            {issue.roadName}, Andheri
          </p>

          <div className="flex items-center gap-2 mt-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                isCritical
                  ? "bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]"
                  : isMajor
                  ? "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]"
                  : "bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]"
              }`}
            >
              <AlertTriangle className="h-3 w-3" />
              {issue.severity.toUpperCase()}
            </span>
            <span className="text-[11px] text-[#66736D]">
              {confidencePct}% confidence · {issue.observedBy} bus observations · 14 min ago
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="rounded p-1 text-[#66736D] hover:bg-[#F3F6F4] hover:text-[#1F2933] transition-colors"
          title="Close Inspection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* LEVEL 2: Evidence Presentation (Section 10: ONE LARGE IMAGE) */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#66736D] mb-1.5">
            Evidence
          </p>

          <div className="relative aspect-video w-full rounded border border-[#D9E2DC] overflow-hidden bg-black shadow-xs">
            <img
              src={evidenceImg}
              alt="Road Condition Evidence"
              className="h-full w-full object-cover"
            />
            {/* Clean Realistic Inspection Box (No neon, no excessive HUD) */}
            <div className="absolute inset-x-8 top-6 bottom-7 border-1.5 border-[#DC2626] bg-[#DC2626]/10 rounded-xs pointer-events-none">
              <span className="absolute -top-4 left-0 rounded bg-[#DC2626] px-1 py-0.2 text-[8px] font-bold text-white uppercase tracking-wider">
                {issue.type === "safety_hotspot" ? "Hazard" : issue.type.charAt(0).toUpperCase() + issue.type.slice(1)} · {confidencePct}%
              </span>
            </div>
          </div>

          <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#66736D] px-1">
            <span>Observed: 14 min ago</span>
            <span>Confidence: {confidencePct}%</span>
            <span>Source: Bus observation</span>
          </div>
        </div>

        {/* LEVEL 3: Operational Status & Action */}
        <div className="rounded border border-[#D9E2DC] bg-[#F8FAF8] p-3 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#66736D] font-medium">Status</span>
            <span className="font-semibold text-[#D97706] bg-[#FFFBEB] border border-[#FDE68A] px-2 py-0.5 rounded text-[11px]">
              Under Review
            </span>
          </div>

          <div className="flex gap-2">
            <button className="flex-1 rounded bg-[#245B45] hover:bg-[#245B45]/90 text-white font-semibold text-xs py-1.5 shadow-xs transition-colors flex items-center justify-center gap-1.5">
              <Wrench className="h-3.5 w-3.5" />
              Open Task
            </button>
            <button className="rounded border border-[#D9E2DC] bg-white hover:bg-[#F3F6F4] text-[#1F2933] font-semibold text-xs px-3 py-1.5 transition-colors">
              View History
            </button>
          </div>
        </div>

        {/* Recommended Remediation Tags */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#66736D] mb-1.5">
            Recommended Remediation
          </p>
          <div className="flex flex-wrap gap-1.5">
            {["+ Patching", "+ Surface Dressing", "+ Joint Sealing"].map((tag) => (
              <span
                key={tag}
                className="rounded border border-[#D9E2DC] bg-[#F8FAF8] hover:bg-[#EEF7F1] hover:text-[#245B45] hover:border-[#DDEFE5] px-2 py-0.5 text-[11px] font-medium text-[#1F2933] transition-colors cursor-pointer"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* LEVEL 4: TECHNICAL DETAILS (Collapsed by Default, Section 8) */}
        <details className="group border-t border-[#D9E2DC] pt-3 text-[11px] text-[#66736D]">
          <summary className="cursor-pointer font-medium text-[#66736D] hover:text-[#1F2933] flex items-center justify-between py-1 outline-none">
            <span>Technical details</span>
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 rounded bg-[#F8FAF8] border border-[#D9E2DC] p-2.5 font-mono text-[10px] space-y-1 text-[#66736D]">
            <p>Record: {issue.id}</p>
            <p>Segment: {issue.roadId}</p>
            <p>Coordinates: {issue.position.lat.toFixed(5)}° N, {issue.position.lng.toFixed(5)}° E</p>
          </div>
        </details>
      </div>
    </>
  );
}

// -----------------------------------------------------------------------------
// ROAD DETAIL DRAWER (Section 13)
// S.V. ROAD / WATCH / 72 / 100 / 2 issues, 12 obs, 4 buses, Last observed 22m
// Status: Monitored
// [View Issues], [View History]
// Technical details ▾ (collapsed by default)
// -----------------------------------------------------------------------------
function RoadDetailDrawer({
  road,
  onClose,
}: {
  road: AndheriRoad;
  onClose: () => void;
}) {
  const cfg = CONDITION_CONFIG[road.condition];

  return (
    <>
      {/* Header: S.V. ROAD / WATCH */}
      <div className="border-b border-[#D9E2DC] px-4 py-3 bg-[#F8FAF8] flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-[#1F2933] leading-snug uppercase">
            {road.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: `${cfg.color}18`,
                color: cfg.color,
                border: `1px solid ${cfg.color}40`,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
              {road.condition}
            </span>
            <span className="text-[11px] text-[#66736D] font-medium capitalize">
              {road.type} Corridor · {road.lengthKm} km
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="rounded p-1 text-[#66736D] hover:bg-[#F3F6F4] hover:text-[#1F2933] transition-colors"
          title="Close Inspection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Condition Score Meter */}
        <div className="rounded border border-[#D9E2DC] bg-[#F8FAF8] p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-[#66736D]">Condition score</span>
            <span className="font-mono font-bold text-sm text-[#1F2933]">
              {road.conditionScore} <span className="text-xs font-normal text-[#66736D]">/ 100</span>
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#D9E2DC] overflow-hidden mb-1.5">
            <div
              className="h-full rounded-full"
              style={{ width: `${road.conditionScore}%`, background: cfg.color }}
            />
          </div>
          <p className="text-[10px] text-[#66736D]">
            {cfg.desc} based on continuous fleet sensor surveys.
          </p>
        </div>

        {/* Survey Metrics (Section 13) */}
        <div className="rounded border border-[#D9E2DC] bg-[#F8FAF8] p-3 space-y-2">
          <div className="grid grid-cols-2 gap-y-2.5 gap-x-3 text-xs">
            <div>
              <p className="text-[10px] text-[#66736D]">Issues</p>
              <p className="font-bold text-[#D97706] font-mono">{road.issueCount}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#66736D]">Observations</p>
              <p className="font-bold text-[#1F2933] font-mono">{road.observationCount}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#66736D]">Observed by</p>
              <p className="font-semibold text-[#1F2933]">{road.surveyedBuses} buses</p>
            </div>
            <div>
              <p className="text-[10px] text-[#66736D]">Last observed</p>
              <p className="font-semibold text-[#1F2933]">22 min ago</p>
            </div>
            <div>
              <p className="text-[10px] text-[#66736D]">Status</p>
              <p className="font-semibold text-[#10b981]">Monitored</p>
            </div>
            <div>
              <p className="text-[10px] text-[#66736D]">Surveyed Length</p>
              <p className="font-semibold text-[#1F2933]">{road.lengthKm} km</p>
            </div>
          </div>
        </div>

        {/* Actions (Section 13: [View Issues], [View History]) */}
        <div className="flex gap-2">
          <button className="flex-1 rounded bg-[#245B45] hover:bg-[#245B45]/90 text-white font-semibold text-xs py-1.5 shadow-xs transition-colors flex items-center justify-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            View Issues
          </button>
          <button className="rounded border border-[#D9E2DC] bg-white hover:bg-[#F3F6F4] text-[#1F2933] font-semibold text-xs px-3 py-1.5 transition-colors">
            View History
          </button>
        </div>

        {/* LEVEL 4: TECHNICAL DETAILS (Collapsed by Default, Section 8) */}
        <details className="group border-t border-[#D9E2DC] pt-3 text-[11px] text-[#66736D]">
          <summary className="cursor-pointer font-medium text-[#66736D] hover:text-[#1F2933] flex items-center justify-between py-1 outline-none">
            <span>Technical details</span>
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 rounded bg-[#F8FAF8] border border-[#D9E2DC] p-2.5 font-mono text-[10px] space-y-1 text-[#66736D]">
            <p>Segment: {road.id}</p>
            <p>Classification: {road.type}</p>
            <p>Waypoints: {road.coordinates.length} nodes</p>
          </div>
        </details>
      </div>
    </>
  );
}
