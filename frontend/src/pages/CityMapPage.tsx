import { useState } from "react";
import {
  Compass,
  Layers,
  AlertTriangle,
  Bus,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  Share2,
  Wrench,
  CheckCircle2,
  Eye,
  Route,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { AndheriIntelligenceMap, MapLegend } from "@/components/maps/MapView";
import {
  DEMO_REGION,
  ANDHERI_ROADS,
  ANDHERI_ISSUES,
  ANDHERI_STATS,
  CONDITION_CONFIG,
  SEVERITY_MARKER_COLOR,
  type AndheriRoad,
  type AndheriIssue,
} from "@/data/andheri";

// Evidence assets
import evidencePothole from "@/assets/evidence-pothole.jpg";
import evidenceWater from "@/assets/evidence-water.jpg";
import evidenceTraffic from "@/assets/evidence-traffic.jpg";

export function CityMapPage() {
  const [showFleet, setShowFleet] = useState(false);
  const [showOverview, setShowOverview] = useState(true);
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

  const handleClearSelection = () => {
    setSelectedRoad(null);
    setSelectedIssue(null);
  };

  return (
    <AppShell>
      <div className="relative flex flex-1 overflow-hidden rounded-lg border border-[#D9E2DC] bg-[#0f172a] shadow-sm"
           style={{ height: "calc(100vh - 84px)" }}>

        {/* ---------------- Map Canvas ---------------- */}
        <AndheriIntelligenceMap
          showFleet={showFleet}
          selectedRoadId={selectedRoad?.id ?? null}
          selectedIssueId={selectedIssue?.id ?? null}
          onSelectRoad={handleSelectRoad}
          onSelectIssue={handleSelectIssue}
          className="flex-1 h-full w-full"
        />

        {/* ---------------- Left Panel: RoadMetrics Style Overview ---------------- */}
        <div
          className={`absolute left-3 top-3 bottom-3 z-20 flex transition-all duration-300 ease-in-out ${
            showOverview ? "translate-x-0" : "-translate-x-[calc(100%-12px)]"
          }`}
        >
          <div className="relative w-80 rounded-lg border border-[#D9E2DC] bg-white/98 shadow-md backdrop-blur-xs flex flex-col overflow-hidden text-[#1F2933]">
            {/* Header */}
            <div className="border-b border-[#D9E2DC] px-4 py-3 bg-[#F8FAF8]">
              <div className="flex items-center justify-between">
                <span className="rounded bg-[#EEF7F1] border border-[#DDEFE5] px-2 py-0.5 text-[10px] font-semibold text-[#245B45] tracking-wide">
                  {DEMO_REGION.name} Municipal Sector
                </span>
                <span className="text-[10px] text-[#66736D] font-medium">OSM Verified</span>
              </div>
              <h2 className="text-sm font-bold text-[#1F2933] mt-1.5">Data Visualization</h2>
              <p className="text-[11px] text-[#66736D] leading-tight">
                View &amp; understand surveyed road network condition at a glance.
              </p>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Overview Metrics */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#66736D] mb-2.5">
                  Network Overview
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-md border border-[#D9E2DC] bg-[#F8FAF8] p-2.5">
                    <div className="flex items-center gap-1.5 text-[#66736D] mb-1">
                      <Route className="h-3.5 w-3.5 text-[#245B45]" />
                      <span className="text-[10px] font-medium">Surveyed Distance</span>
                    </div>
                    <p className="text-base font-bold text-[#1F2933] font-mono leading-none">
                      {ANDHERI_STATS.totalSurveyedKm} <span className="text-xs font-normal text-[#66736D]">km</span>
                    </p>
                    <p className="text-[10px] text-[#66736D] mt-1">354 road segments</p>
                  </div>

                  <div className="rounded-md border border-[#D9E2DC] bg-[#F8FAF8] p-2.5">
                    <div className="flex items-center gap-1.5 text-[#66736D] mb-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-[#D97706]" />
                      <span className="text-[10px] font-medium">Defects Identified</span>
                    </div>
                    <p className="text-base font-bold text-[#D97706] font-mono leading-none">
                      {ANDHERI_STATS.totalIssues} <span className="text-xs font-normal text-[#66736D]">defects</span>
                    </p>
                    <p className="text-[10px] text-[#DC2626] font-semibold mt-1">
                      {ANDHERI_STATS.priorityIssues} critical priority
                    </p>
                  </div>

                  <div className="rounded-md border border-[#D9E2DC] bg-[#F8FAF8] p-2.5">
                    <div className="flex items-center gap-1.5 text-[#66736D] mb-1">
                      <Eye className="h-3.5 w-3.5 text-[#3F8F68]" />
                      <span className="text-[10px] font-medium">Survey Points</span>
                    </div>
                    <p className="text-sm font-bold text-[#1F2933] font-mono leading-none">
                      {ANDHERI_STATS.totalObservationPoints.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-[#66736D] mt-1">Centerline readings</p>
                  </div>

                  <div className="rounded-md border border-[#D9E2DC] bg-[#F8FAF8] p-2.5">
                    <div className="flex items-center gap-1.5 text-[#66736D] mb-1">
                      <Bus className="h-3.5 w-3.5 text-[#2563EB]" />
                      <span className="text-[10px] font-medium">Active Fleet</span>
                    </div>
                    <p className="text-sm font-bold text-[#2563EB] font-mono leading-none">
                      {ANDHERI_STATS.totalBuses} <span className="text-xs font-normal text-[#66736D]">buses</span>
                    </p>
                    <p className="text-[10px] text-[#66736D] mt-1">Live tracking</p>
                  </div>
                </div>
              </div>

              {/* Condition Break-Up (RoadMetrics Style) */}
              <div className="border-t border-[#D9E2DC] pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#66736D]">
                    Condition Break-Up
                  </p>
                  <span className="text-[10px] text-[#66736D] font-mono">107.8 km total</span>
                </div>

                <div className="space-y-2">
                  {([
                    { key: "healthy", level: "Level 0", label: "Healthy", color: "#16A34A", dist: "45.1 km", pct: 41.8 },
                    { key: "watch", level: "Level 1", label: "Watch", color: "#EAB308", dist: "35.9 km", pct: 33.3 },
                    { key: "poor", level: "Level 2", label: "Poor", color: "#EA580C", dist: "18.0 km", pct: 16.7 },
                    { key: "critical", level: "Level 3", label: "Critical", color: "#DC2626", dist: "8.8 km", pct: 8.2 },
                  ] as const).map((item) => (
                    <div key={item.key} className="rounded-md border border-[#D9E2DC]/80 bg-[#F8FAF8] p-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: item.color }} />
                          <span className="font-semibold text-xs text-[#1F2933]">{item.label}</span>
                          <span className="text-[10px] text-[#66736D] font-mono">({item.level})</span>
                        </div>
                        <span className="text-xs font-bold text-[#1F2933] font-mono">{item.pct}%</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#66736D] mb-1.5">
                        <span>Total Distance</span>
                        <span className="font-mono font-medium text-[#1F2933]">{item.dist}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#D9E2DC] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${item.pct}%`, background: item.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visualization Toggles */}
              <div className="border-t border-[#D9E2DC] pt-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#66736D] mb-1">
                  Layer Display
                </p>

                <label className="flex items-center justify-between p-2 rounded-md border border-[#D9E2DC] bg-[#F8FAF8] cursor-pointer hover:bg-[#F3F6F4] transition-colors">
                  <span className="text-xs font-medium text-[#1F2933] flex items-center gap-2">
                    <Bus className="h-3.5 w-3.5 text-[#2563EB]" />
                    Show Fleet Buses
                  </span>
                  <input
                    type="checkbox"
                    checked={showFleet}
                    onChange={(e) => setShowFleet(e.target.checked)}
                    className="h-4 w-4 rounded border-[#D9E2DC] text-[#245B45] focus:ring-[#3F8F68] accent-[#245B45]"
                  />
                </label>

                {selectedRoad && (
                  <button
                    onClick={handleClearSelection}
                    className="w-full flex items-center justify-center gap-1.5 rounded-md border border-[#D9E2DC] bg-white py-1.5 text-xs font-semibold text-[#66736D] hover:text-[#1F2933] hover:bg-[#F3F6F4] transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset Road Selection
                  </button>
                )}
              </div>
            </div>

            {/* Footer Notice */}
            <div className="border-t border-[#D9E2DC] px-3.5 py-2 bg-[#F8FAF8]">
              <p className="text-[10px] text-[#66736D] leading-relaxed">
                Network: 3,286 OSM roads. Condition attributes are demo operational values.
              </p>
            </div>

            {/* Collapse toggle tab */}
            <button
              onClick={() => setShowOverview(false)}
              className="absolute -right-3.5 top-1/2 -translate-y-1/2 h-7 w-3.5 bg-white border border-[#D9E2DC] rounded-r flex items-center justify-center text-[#66736D] hover:text-[#1F2933] shadow-xs"
              title="Collapse Overview"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
          </div>

          {/* Expand button when collapsed */}
          {!showOverview && (
            <button
              onClick={() => setShowOverview(true)}
              className="ml-2 h-9 w-9 rounded-md bg-white border border-[#D9E2DC] shadow-md flex items-center justify-center text-[#1F2933] hover:bg-[#F3F6F4] transition-colors"
              title="Expand Overview"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ---------------- Right Panel: GIS Inspection Drawer (RoadMetrics Image 3 Style) ---------------- */}
        {selectedIssue && (
          <div className="absolute right-3 top-3 bottom-3 z-20 w-88 sm:w-96 rounded-lg border border-[#D9E2DC] bg-white shadow-lg flex flex-col overflow-hidden text-[#1F2933] animate-in slide-in-from-right-4 duration-200">
            <IssueInspectionDrawer
              issue={selectedIssue}
              road={ANDHERI_ROADS.find((r) => r.id === selectedIssue.roadId) ?? null}
              onClose={handleClearSelection}
            />
          </div>
        )}

        {selectedRoad && !selectedIssue && (
          <div className="absolute right-3 top-3 bottom-3 z-20 w-84 sm:w-88 rounded-lg border border-[#D9E2DC] bg-white shadow-lg flex flex-col overflow-hidden text-[#1F2933] animate-in slide-in-from-right-4 duration-200">
            <RoadSegmentDrawer
              road={selectedRoad}
              onClose={handleClearSelection}
            />
          </div>
        )}

        {/* ---------------- Bottom-Left: Map Legend ---------------- */}
        <div className="absolute bottom-3 left-3 z-10">
          <MapLegend />
        </div>

        {/* ---------------- Top-Right Context Bar ---------------- */}
        <div className="absolute right-3 top-3 z-10 hidden sm:flex items-center gap-2">
          <div className="rounded-md border border-[#D9E2DC] bg-white/95 backdrop-blur-xs px-3 py-1.5 shadow-sm text-right">
            <p className="text-[10px] text-[#66736D] font-medium uppercase tracking-wider">Active Sector</p>
            <p className="text-xs font-bold text-[#1F2933]">Andheri • 107.8 km Surveyed</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// -------------------------------------------------------------
// SUB-COMPONENTS: RoadMetrics Inspired Drawers
// -------------------------------------------------------------

function IssueInspectionDrawer({
  issue,
  road,
  onClose,
}: {
  issue: AndheriIssue;
  road: AndheriRoad | null;
  onClose: () => void;
}) {
  const isP1 = issue.priority === "P1";
  const isCritical = issue.severity === "critical";
  const severityBadgeBg = isCritical ? "bg-[#FEF2F2] text-[#DC2626] border-[#FCA5A5]" : "bg-[#FFFBEB] text-[#D97706] border-[#FCD34D]";

  // Pick appropriate evidence image based on issue type
  const evidenceImg = issue.type === "waterlogging" ? evidenceWater : evidencePothole;

  return (
    <>
      {/* Header (Level 1 Information) */}
      <div className="border-b border-[#D9E2DC] px-4 py-3 bg-[#F8FAF8] flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${severityBadgeBg}`}>
              {issue.priority} • {issue.severity}
            </span>
            <span className="text-[10px] text-[#66736D] capitalize font-medium">
              {issue.type.replace(/_/g, " ")}
            </span>
          </div>
          <h3 className="text-sm font-bold text-[#1F2933] leading-snug">{issue.title}</h3>
          <p className="text-xs font-semibold text-[#245B45] mt-0.5">
            {issue.roadName}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-[#66736D] hover:bg-[#F3F6F4] hover:text-[#1F2933] transition-colors"
          title="Close Inspection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Visual Inspection Evidence Preview (RoadMetrics Image 3 Style) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#66736D]">
              Camera Evidence Frame
            </span>
            <span className="text-[10px] text-[#245B45] font-semibold flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Telemetry Verified
            </span>
          </div>

          <div className="relative rounded-md border border-[#D9E2DC] overflow-hidden bg-slate-900 aspect-video">
            <img
              src={evidenceImg}
              alt="Road Defect Evidence"
              className="h-full w-full object-cover"
            />
            {/* Defect Bounding Box Overlay */}
            <div className="absolute inset-x-8 inset-y-6 border-2 border-[#DC2626] rounded-sm bg-[#DC2626]/10 flex items-start p-1 pointer-events-none">
              <span className="bg-[#DC2626] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-xs">
                {issue.type.toUpperCase()} • {Math.round(issue.confidence * 100)}%
              </span>
            </div>
            {/* Timestamp & Telemetry Stamp */}
            <div className="absolute bottom-2 left-2 rounded bg-black/75 px-2 py-0.5 text-[9px] font-mono text-white/90">
              Bearing: East • Speed: 24 km/h • GPS Valid
            </div>
          </div>
        </div>

        {/* Operational Context (Level 2 Information) */}
        <div className="rounded-md border border-[#D9E2DC] bg-[#F8FAF8] p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#66736D] mb-1">
            Inspection Details
          </p>
          <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-xs">
            <div>
              <p className="text-[10px] text-[#66736D]">Location</p>
              <p className="font-semibold text-[#1F2933]">{issue.roadName}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#66736D]">Date &amp; Time</p>
              <p className="font-semibold text-[#1F2933]">{issue.lastObserved}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#66736D]">Observed By</p>
              <p className="font-semibold text-[#1F2933]">{issue.observedBy} fleet passes</p>
            </div>
            <div>
              <p className="text-[10px] text-[#66736D]">Status</p>
              <p className="font-semibold text-[#D97706]">{issue.status}</p>
            </div>
          </div>
        </div>

        {/* Defect Breakdown */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#66736D] mb-1.5">
            Defect Classification
          </p>
          <p className="text-xs text-[#1F2933] bg-[#F8FAF8] border border-[#D9E2DC] rounded-md p-2.5 leading-relaxed">
            Severe Pothole, Minor Transverse Cracking, Moderate Alligator Fatigue, Ravelling Area
          </p>
        </div>

        {/* Maintenance Recommendation Tags (RoadMetrics Image 3 Style) */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#66736D] mb-1.5">
            Recommended Remediation Tags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {["+ Patching", "+ Surface Dressing", "+ Joint Sealing", "+ PWD Work Order"].map((tag) => (
              <span
                key={tag}
                className="rounded border border-[#D9E2DC] bg-[#F8FAF8] hover:bg-[#EEF7F1] hover:text-[#245B45] hover:border-[#DDEFE5] px-2 py-1 text-[11px] font-medium text-[#1F2933] transition-colors cursor-pointer"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex gap-2">
          <button className="flex-1 rounded-md bg-[#245B45] hover:bg-[#245B45]/90 text-white font-semibold text-xs py-2 shadow-xs transition-colors flex items-center justify-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" />
            Create Work Order
          </button>
          <button className="rounded-md border border-[#D9E2DC] bg-white hover:bg-[#F3F6F4] text-[#1F2933] font-semibold text-xs px-3 py-2 transition-colors">
            Acknowledge
          </button>
        </div>

        {/* Level 3: Technical Metadata (Subdued at Bottom) */}
        <div className="border-t border-[#D9E2DC] pt-3 text-[10px] text-[#66736D] space-y-1">
          <p className="font-bold uppercase tracking-wider text-[#66736D]/80">Technical Metadata</p>
          <div className="font-mono space-y-0.5">
            <p>Record ID: {issue.id}</p>
            <p>Segment Ref: {issue.roadId}</p>
            <p>Coordinates: {issue.position.lat.toFixed(5)}° N, {issue.position.lng.toFixed(5)}° E</p>
          </div>
        </div>
      </div>
    </>
  );
}

function RoadSegmentDrawer({
  road,
  onClose,
}: {
  road: AndheriRoad;
  onClose: () => void;
}) {
  const cfg = CONDITION_CONFIG[road.condition];

  return (
    <>
      {/* Header */}
      <div className="border-b border-[#D9E2DC] px-4 py-3 bg-[#F8FAF8] flex items-start justify-between">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#66736D]">
            Surveyed Road Corridor
          </span>
          <h3 className="text-sm font-bold text-[#1F2933] mt-0.5 leading-snug">{road.name}</h3>
          <p className="text-xs text-[#66736D] capitalize mt-0.5">{road.type} Corridor</p>
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
        {/* Condition Rating */}
        <div className="rounded-md border border-[#D9E2DC] bg-[#F8FAF8] p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: cfg.color }} />
              <span className="font-bold text-sm" style={{ color: cfg.color }}>{road.condition}</span>
              <span className="text-[10px] text-[#66736D]">({cfg.level})</span>
            </div>
            <span className="font-mono font-bold text-sm text-[#1F2933]">{road.conditionScore} / 100</span>
          </div>

          <div className="h-2 w-full rounded-full bg-[#D9E2DC] overflow-hidden mb-2">
            <div
              className="h-full rounded-full"
              style={{ width: `${road.conditionScore}%`, background: cfg.color }}
            />
          </div>
          <p className="text-[10px] text-[#66736D]">
            Pavement Condition Index calculated from {road.observationCount} sensor readings.
          </p>
        </div>

        {/* Operational Attributes */}
        <div className="rounded-md border border-[#D9E2DC] bg-[#F8FAF8] p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#66736D] mb-1">
            Segment Attributes
          </p>
          <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-xs">
            <div>
              <p className="text-[10px] text-[#66736D]">Surveyed Length</p>
              <p className="font-semibold text-[#1F2933]">{road.lengthKm} km</p>
            </div>
            <div>
              <p className="text-[10px] text-[#66736D]">Identified Defects</p>
              <p className="font-semibold text-[#D97706]">{road.issueCount} defects</p>
            </div>
            <div>
              <p className="text-[10px] text-[#66736D]">Survey Observations</p>
              <p className="font-semibold text-[#1F2933]">{road.observationCount} points</p>
            </div>
            <div>
              <p className="text-[10px] text-[#66736D]">Surveyed Fleet</p>
              <p className="font-semibold text-[#1F2933]">{road.surveyedBuses} buses</p>
            </div>
            <div>
              <p className="text-[10px] text-[#66736D]">Maintenance Priority</p>
              <p className="font-semibold text-[#1F2933]">{road.priority ?? "Normal"}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#66736D]">Operational Status</p>
              <p className="font-semibold text-[#16A34A]">{road.status}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2">
          <button className="w-full rounded-md bg-[#245B45] hover:bg-[#245B45]/90 text-white font-semibold text-xs py-2 shadow-xs transition-colors">
            Generate Sector Condition Report
          </button>
        </div>

        {/* Level 3: Technical Metadata */}
        <div className="border-t border-[#D9E2DC] pt-3 text-[10px] text-[#66736D] space-y-1">
          <p className="font-bold uppercase tracking-wider text-[#66736D]/80">Technical Metadata</p>
          <div className="font-mono space-y-0.5">
            <p>Segment Ref: {road.id}</p>
            <p>Corridor Classification: {road.type}</p>
            <p>Vertex Nodes: {road.coordinates.length} waypoints</p>
          </div>
        </div>
      </div>
    </>
  );
}
