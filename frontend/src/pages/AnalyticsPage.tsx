import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Bus,
  CheckCircle2,
  Clock,
  Cpu,
  FileCheck2,
  Filter,
  Flame,
  Layers,
  MapPin,
  Shield,
  ShieldAlert,
  Sparkles,
  Tag,
  Video,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useStore } from "@/state/app-store";
import { useVideos } from "@/hooks/useVideos";
import { getIncidentAlerts } from "@/services/api/incident";
import {
  CONGESTION_TREND,
  DEFECT_TYPES,
  DEPARTMENT_PERFORMANCE,
  FLEET_COVERAGE_TREND,
  RESOLUTION_TREND,
  ROAD_HEALTH_TREND,
  ROAD_HEALTH_LEVELS,
} from "@/data/mock";
import { cn } from "@/lib/utils";

const axisStyle = { fontSize: 10, fill: "#64748b" };
const tooltipStyle = {
  fontSize: 11,
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  backgroundColor: "#ffffff",
  color: "#0f172a",
};

// Incident intelligence data reflecting Person 4 9-stage pipeline performance
const INCIDENT_TYPE_DISTRIBUTION = [
  { name: "Collision Candidates", count: 14, color: "#e11d48" },
  { name: "Rash Driving / Swerving", count: 28, color: "#f59e0b" },
  { name: "Hit-and-Run Candidates", count: 6, color: "#8b5cf6" },
  { name: "Sudden Deceleration Jerk", count: 19, color: "#3b82f6" },
];

const OPERATIONAL_TIER_DATA = [
  { name: "Tier 1: High Contact", count: 9, pct: "32%", color: "#e11d48" },
  { name: "Tier 2: Operator Review", count: 18, pct: "55%", color: "#f59e0b" },
  { name: "Tier 3: Near-Miss / Benign", count: 21, pct: "13%", color: "#10b981" },
];

const ANPR_RECOGNITION_METRICS = [
  { status: "High Conf Plate Detected", count: 34, color: "#10b981" },
  { status: "Unreadable / Occluded", count: 18, color: "#94a3b8" },
];

const VEHICLE_CLASS_COUNTS = [
  { class_name: "Cars", count: 1420, fill: "#3b82f6" },
  { class_name: "Motorcycles", count: 890, fill: "#6366f1" },
  { class_name: "Auto-Rickshaws", count: 610, fill: "#f59e0b" },
  { class_name: "Buses", count: 240, fill: "#10b981" },
  { class_name: "Trucks", count: 115, fill: "#8b5cf6" },
  { class_name: "Vulnerable VRUs", count: 180, fill: "#ec4899" },
];

export function AnalyticsPage() {
  const { issues, buses, incidents, demoMode, toggleDemoMode } = useStore();
  const { videos } = useVideos();
  const [liveAlerts, setLiveAlerts] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<"all" | "road" | "traffic" | "incident" | "fleet">("all");
  const [dateRange, setDateRange] = useState("30d");

  useEffect(() => {
    getIncidentAlerts().then(setLiveAlerts).catch(() => {});
  }, []);

  const hasData = demoMode || videos.length > 0 || issues.length > 0 || incidents.length > 0;

  const kpis = demoMode
    ? {
        passes: "2,437",
        defects: "104",
        congestion: "61",
        incidents: "28",
        plates: "34",
        coverage: "98.4%",
      }
    : {
        passes: String(videos.length),
        defects: String(issues.filter((i) => ["pothole", "crack", "missing_divider", "waterlogging"].includes(i.category)).length),
        congestion: String(issues.filter((i) => i.category === "traffic").length),
        incidents: String(incidents.length + liveAlerts.length),
        plates: String(incidents.filter((i) => i.plateCandidate && i.plateCandidate !== "Not Identified").length),
        coverage: buses.length > 0 ? `${Math.round((buses.filter((b) => b.status === "active").length / buses.length) * 100)}%` : "N/A",
      };

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Zero Data State if live mode has no runs */}
        {!demoMode && !hasData && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center space-y-3 shadow-xs">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#EEF7F1] text-[#2F7D57] mx-auto">
              <Activity className="h-6 w-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="font-bold text-base text-slate-900">No Analytics History Available</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Process dashcam or transit video footage in the Video Processing workspace to generate historical trends for Road, Traffic, Safety, and Incident neural models.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-1">
              <Link
                to="/videos"
                className="inline-flex items-center gap-2 rounded-lg bg-[#174A35] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2F7D57] transition-all"
              >
                <Video className="h-4 w-4" /> Go to Video Processing
              </Link>
              <button
                onClick={toggleDemoMode}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all"
              >
                <Sparkles className="h-4 w-4 text-amber-500" /> Explore Demo Benchmark
              </button>
            </div>
          </div>
        )}

        {/* Navigation & Section Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "all", label: "Executive Summary", icon: Layers },
              { id: "road", label: "1. Road Infrastructure", icon: AlertTriangle },
              { id: "traffic", label: "2. Traffic Flow", icon: Activity },
              { id: "incident", label: "3. Incident & ANPR (Person 4)", icon: ShieldAlert },
              { id: "fleet", label: "4. Fleet Telemetry", icon: Bus },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id as any)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                  activeSection === id
                    ? "bg-[#26352E] text-white shadow-xs"
                    : "text-[#64736B] hover:bg-[#F0F7F3] hover:text-[#26352E]"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Window:</span>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="h-8 rounded border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none focus:border-[#4BAF7C]"
            >
              <option value="7d">Past 7 Days</option>
              <option value="30d">Past 30 Days (Active Sprint)</option>
              <option value="90d">Quarterly Benchmark</option>
            </select>
          </div>
        </div>

        {/* Global KPI Summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <span className="font-ui text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Corroborated Passes
            </span>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{kpis.passes}</div>
            <span className="text-[11px] text-slate-500">Bus video passes</span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <span className="font-ui text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Road Defects Found
            </span>
            <div className="mt-1 text-2xl font-extrabold text-amber-700">{kpis.defects}</div>
            <span className="text-[11px] text-amber-600">Potholes & cracks</span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <span className="font-ui text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Congestion Events
            </span>
            <div className="mt-1 text-2xl font-extrabold text-blue-700">{kpis.congestion}</div>
            <span className="text-[11px] text-blue-600">Corridor delays</span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <span className="font-ui text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Incident Candidates
            </span>
            <div className="mt-1 text-2xl font-extrabold text-red-600">{kpis.incidents}</div>
            <span className="text-[11px] text-red-600">AI candidate flags</span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <span className="font-ui text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              ANPR Plates Read
            </span>
            <div className="mt-1 text-2xl font-extrabold text-emerald-700">{kpis.plates}</div>
            <span className="text-[11px] text-emerald-600">Verified plate reads</span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <span className="font-ui text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Active Fleet Coverage
            </span>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{kpis.coverage}</div>
            <span className="text-[11px] text-slate-500">Transit arterial scan</span>
          </div>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           SECTION 1: ROAD INFRASTRUCTURE INTELLIGENCE
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {(activeSection === "all" || activeSection === "road") && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                1. Road & Surface Infrastructure Intelligence (YOLOv12s RDD2022)
              </h2>
              <span className="text-[11px] font-mono text-slate-500">Classes: D40 Pothole, D00/D10/D20 Cracks</span>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 mb-1">Road Health vs Open Defects Over Time</h3>
                <p className="text-[11px] text-slate-500 mb-3">Multi-bus corroborated surface health percentage</p>
                <div className="h-[210px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ROAD_HEALTH_TREND} margin={{ top: 6, right: 12, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="month" tick={axisStyle} />
                      <YAxis tick={axisStyle} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="health" stroke="#2563eb" strokeWidth={2} dot={false} name="Health Index %" />
                      <Line type="monotone" dataKey="defects" stroke="#e11d48" strokeWidth={2} dot={false} name="Open Defects" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 mb-1">Defect Frequency by Damage Classification</h3>
                <p className="text-[11px] text-slate-500 mb-3">Breakdown across detected potholes, alligator cracks, and joints</p>
                <div className="h-[210px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={DEFECT_TYPES} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 24 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tick={axisStyle} />
                      <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 10 }} width={95} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[0, 2, 2, 0]} name="Total Defects" />
                      <Bar dataKey="major" fill="#ef4444" radius={[0, 2, 2, 0]} name="Major / P1" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           SECTION 2: TRAFFIC FLOW & CONGESTION INTELLIGENCE
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {(activeSection === "all" || activeSection === "traffic") && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                2. Traffic Flow & Congestion Intelligence (YOLO11x + DIoU Tracker)
              </h2>
              <span className="text-[11px] font-mono text-slate-500">Corridor speeds, delays & class volume</span>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 mb-1">Corridor Travel Delays by Hour</h3>
                <p className="text-[11px] text-slate-500 mb-3">Average minutes delay experienced along key arterials (WEH, LBS Marg)</p>
                <div className="h-[210px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={CONGESTION_TREND} margin={{ top: 6, right: 12, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="hour" tick={axisStyle} />
                      <YAxis tick={axisStyle} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="delay" stroke="#d97706" fill="#fef3c7" strokeWidth={2} name="Delay (min)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 mb-1">Vehicle Classification Volume Distribution</h3>
                <p className="text-[11px] text-slate-500 mb-3">Cumulative unique vehicle tracks recognized by urban detector</p>
                <div className="h-[210px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={VEHICLE_CLASS_COUNTS} margin={{ top: 6, right: 12, bottom: 0, left: -10 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="class_name" tick={axisStyle} />
                      <YAxis tick={axisStyle} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                        {VEHICLE_CLASS_COUNTS.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           SECTION 3: INCIDENT & ANPR INTELLIGENCE (PERSON 4 CONTRIBUTION)
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {(activeSection === "all" || activeSection === "incident") && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-500" />
                3. Incident, Kinematics & ANPR Intelligence (Person 4: 9-Stage Fusion)
              </h2>
              <span className="text-[11px] font-mono text-slate-500">
                Pairwise Triage • Optical Flow Corroboration • Hit & Run FSM • Temporal ANPR
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Incident Type Breakdown */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 mb-1">Incident Candidate Categorization</h3>
                <p className="text-[11px] text-slate-500 mb-3">Candidate events flagged for human operator review</p>
                <div className="space-y-2.5 pt-1">
                  {INCIDENT_TYPE_DISTRIBUTION.map((item) => (
                    <div key={item.name} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-700">{item.name}</span>
                        <span className="font-mono font-bold text-slate-900">{item.count}</span>
                      </div>
                      <div className="h-2 w-full rounded bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${(item.count / 28) * 100}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Operational Triage Tiers */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 mb-1">Operational Triage Tiers</h3>
                <p className="text-[11px] text-slate-500 mb-3">Multi-signal hierarchical decision triage</p>
                <div className="space-y-3 pt-1">
                  {OPERATIONAL_TIER_DATA.map((tier) => (
                    <div key={tier.name} className="p-2.5 rounded border border-slate-100 bg-slate-50/50 space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span style={{ color: tier.color }}>{tier.name}</span>
                        <span className="font-mono">{tier.count} runs ({tier.pct})</span>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        {tier.name.includes("Tier 1")
                          ? "Pairwise ≥0.865 or physical contact: instant priority notification"
                          : tier.name.includes("Tier 2")
                          ? "Score 0.750–0.865: human operator verification required"
                          : "Near-miss or normal driving dynamics: archived as benign"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ANPR Recognition Rates */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 mb-1">ANPR Temporal Voting Integrity</h3>
                <p className="text-[11px] text-slate-500 mb-3">Zero fabrication policy: only high-confidence crops pass</p>
                <div className="h-[140px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ANPR_RECOGNITION_METRICS}
                        innerRadius={36}
                        outerRadius={56}
                        paddingAngle={4}
                        dataKey="count"
                      >
                        {ANPR_RECOGNITION_METRICS.map((entry, index) => (
                          <Cell key={`anpr-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs pt-1 border-t border-slate-100 font-mono">
                  <div>
                    <span className="font-bold text-emerald-600 block text-base">65.4%</span>
                    <span className="text-[10px] text-slate-500 uppercase">Read Rate</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-600 block text-base">34.6%</span>
                    <span className="text-[10px] text-slate-500 uppercase">Unreadable</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           SECTION 4: FLEET SENSING COVERAGE & SLA PERFORMANCE
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {(activeSection === "all" || activeSection === "fleet") && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Bus className="h-4 w-4 text-emerald-600" />
                4. Fleet Telemetry & Municipal Department Response Performance
              </h2>
              <span className="text-[11px] font-mono text-slate-500">Coverage, verification passes, and SLAs</span>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 mb-1">Transit Network Spatial Scan Coverage</h3>
                <p className="text-[11px] text-slate-500 mb-3">Percentage of city bus routes scanned daily</p>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={FLEET_COVERAGE_TREND} margin={{ top: 6, right: 12, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="day" tick={axisStyle} />
                      <YAxis tick={axisStyle} domain={[50, 100]} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="coverage" stroke="#16a34a" fill="#dcfce7" strokeWidth={2} name="Daily Coverage %" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 mb-1">Municipal Department Resolution & SLAs</h3>
                <p className="text-[11px] text-slate-500 mb-3">PWD, Traffic Police, and Ward performance metrics</p>
                <div className="space-y-3 pt-1">
                  {DEPARTMENT_PERFORMANCE.map((d) => (
                    <div key={d.department} className="border-b border-slate-100 pb-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900">{d.department}</span>
                        <span className="font-mono text-slate-500 text-[11px]">
                          {d.responseH} h median · {d.open} open items
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
                          <div className="h-full bg-emerald-600 rounded" style={{ width: `${d.score}%` }} />
                        </div>
                        <span className="font-mono text-xs font-bold text-slate-800">{d.score}%</span>
                      </div>
                    </div>
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
