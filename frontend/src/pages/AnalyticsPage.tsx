import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import {
  CONGESTION_TREND,
  DEFECT_TYPES,
  DEPARTMENT_PERFORMANCE,
  FLEET_COVERAGE_TREND,
  RESOLUTION_TREND,
  ROAD_HEALTH_TREND,
} from "@/data/mock";

const axisStyle = { fontSize: 10, fill: "#64748b" };
const tooltipStyle = {
  fontSize: 11,
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  backgroundColor: "#ffffff",
  color: "#0f172a",
};

export function AnalyticsPage() {
  // Filters
  const [dateRange, setDateRange] = useState("30d");
  const [selectedRoute, setSelectedRoute] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedSeverity, setSelectedSeverity] = useState("all");

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Filters Header Bar */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-xs md:grid-cols-5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Date Range
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="h-8 w-full rounded border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="7d">Past 7 Days</option>
              <option value="30d">Past 30 Days</option>
              <option value="90d">Past 90 Days</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Route
            </label>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="h-8 w-full rounded border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="all">All Routes</option>
              <option value="B1">Route B1 (WEH Corridor)</option>
              <option value="B2">Route B2 (Bandra Link)</option>
              <option value="B3">Route B3 (LBS Marg)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Location / Ward
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="h-8 w-full rounded border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="all">All Locations</option>
              <option value="ward-4">BMC Ward 4</option>
              <option value="ward-1">BMC Ward 1</option>
              <option value="traffic-south">Traffic South Zone</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Issue Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-8 w-full rounded border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="all">All Types</option>
              <option value="pothole">Potholes</option>
              <option value="waterlogging">Waterlogging</option>
              <option value="traffic">Traffic Congestion</option>
              <option value="safety">Pedestrian Hazards</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Severity
            </label>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="h-8 w-full rounded border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical / Major</option>
              <option value="moderate">Moderate</option>
              <option value="minor">Minor</option>
            </select>
          </div>
        </div>

        {/* Key Metrics Restrained Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Observations</span>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">2,437</div>
            <span className="text-[11px] text-slate-500">Bus vision passes</span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Road Defects</span>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">104</div>
            <span className="text-[11px] text-slate-500">Potholes & cracks</span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Traffic Events</span>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">61</div>
            <span className="text-[11px] text-slate-500">Corridor delays</span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">AI Incidents</span>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">18</div>
            <span className="text-[11px] text-slate-500">Candidates flagged</span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Resolved Issues</span>
            <div className="mt-1 text-2xl font-extrabold text-emerald-700">181</div>
            <span className="text-[11px] text-emerald-600 font-medium">88% verified</span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Avg Resolution Time</span>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">38 h</div>
            <span className="text-[11px] text-slate-500">SLA performance</span>
          </div>
        </div>

        {/* 1. Road Conditions Section */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
            1. Road Conditions Analytics
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 mb-1">Road Issues Over Time</h3>
              <p className="text-[11px] text-slate-500 mb-3">Health index vs open defect count per month</p>
              <div className="h-[200px]">
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
              <h3 className="text-xs font-bold text-slate-800 mb-1">Issue Distribution by Defect Type</h3>
              <p className="text-[11px] text-slate-500 mb-3">Breakdown of detected road surface anomalies</p>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={DEFECT_TYPES} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 24 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={axisStyle} />
                    <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 10 }} width={100} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 2, 2, 0]} name="Total Count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Traffic Analytics Section */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
            2. Traffic & Congestion Analytics
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 mb-1">Congestion Delays by Hour of Day</h3>
              <p className="text-[11px] text-slate-500 mb-3">Average minutes delay experienced across transit corridors</p>
              <div className="h-[200px]">
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
              <h3 className="text-xs font-bold text-slate-800 mb-1">Issue Resolution Performance</h3>
              <p className="text-[11px] text-slate-500 mb-3">Reported vs resolved vs verified per week</p>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={RESOLUTION_TREND} margin={{ top: 6, right: 12, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="week" tick={axisStyle} />
                    <YAxis tick={axisStyle} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="reported" fill="#94a3b8" radius={[2, 2, 0, 0]} name="Reported" />
                    <Bar dataKey="resolved" fill="#2563eb" radius={[2, 2, 0, 0]} name="Resolved" />
                    <Bar dataKey="verified" fill="#16a34a" radius={[2, 2, 0, 0]} name="Verified" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Fleet & Department Response Section */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
            3. Fleet Surveying & Department Performance
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 mb-1">Fleet Network Survey Coverage</h3>
              <p className="text-[11px] text-slate-500 mb-3">Percentage of city arterial network surveyed per day</p>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={FLEET_COVERAGE_TREND} margin={{ top: 6, right: 12, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="day" tick={axisStyle} />
                    <YAxis tick={axisStyle} domain={[50, 100]} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="coverage" stroke="#16a34a" fill="#dcfce7" strokeWidth={2} name="Coverage %" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 mb-1">Department Operational Performance</h3>
              <p className="text-[11px] text-slate-500 mb-3">Score, median response hours, and open backlog</p>
              <div className="space-y-2.5">
                {DEPARTMENT_PERFORMANCE.map((d) => (
                  <div key={d.department} className="border-b border-slate-100 pb-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900">{d.department}</span>
                      <span className="font-mono text-slate-500 text-[11px]">
                        {d.responseH} h median · {d.open} open items
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
                        <div className="h-full bg-blue-700 rounded" style={{ width: `${d.score}%` }} />
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-800">{d.score}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
