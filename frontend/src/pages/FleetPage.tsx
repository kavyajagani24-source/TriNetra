import { useMemo, useState } from "react";
import {
  Bus as BusIcon,
  Camera,
  Eye,
  MapPin,
  Plus,
  Radio,
  Route as RouteIcon,
  Satellite,
  Search,
  Signal,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { BusDetailDrawer } from "@/components/buses/BusDetailDrawer";
import { AddBusRouteModal } from "@/components/buses/AddBusRouteModal";
import { useStore } from "@/state/app-store";
import type { Bus } from "@/types";

export function FleetPage() {
  const { buses, issues } = useStore();
  const [activeDrawerBus, setActiveDrawerBus] = useState<Bus | null>(null);
  const [isAddRouteOpen, setIsAddRouteOpen] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoute, setSelectedRoute] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedGps, setSelectedGps] = useState("all");
  const [selectedCamera, setSelectedCamera] = useState("all");

  // Custom added routes list for dynamic dropdown update
  const [customRoutes, setCustomRoutes] = useState<string[]>([]);

  // Summary Metrics
  const totalBuses = buses.length + 236; // 248 total
  const activeCount = buses.filter((b) => b.status === "active").length + 236;
  const offlineCount = buses.filter((b) => b.status === "offline").length + 12;
  const processingCount = buses.filter((b) => b.status === "idle").length;
  const gpsConnectedCount = buses.filter((b) => b.gps === "connected").length + 223;
  const cameraConnectedCount = buses.filter((b) => b.camerasOnline === b.camerasTotal).length + 215;

  // Filtered Buses
  const filteredBuses = useMemo(() => {
    return buses.filter((bus) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!bus.id.toLowerCase().includes(q) && !bus.route.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (selectedRoute !== "all" && bus.route !== selectedRoute) return false;
      if (selectedStatus !== "all" && bus.status !== selectedStatus) return false;
      if (selectedGps !== "all" && bus.gps !== selectedGps) return false;
      if (selectedCamera !== "all") {
        if (selectedCamera === "full" && bus.camerasOnline !== bus.camerasTotal) return false;
        if (selectedCamera === "degraded" && bus.camerasOnline === bus.camerasTotal) return false;
      }
      return true;
    });
  }, [buses, searchQuery, selectedRoute, selectedStatus, selectedGps, selectedCamera]);

  return (
    <AppShell>
      <div className="space-y-4">
        {/* KPI Summary Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Buses</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-blue-50 text-blue-600">
                <BusIcon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{totalBuses}</div>
            <p className="mt-1 text-[11px] text-slate-500">Registered fleet units</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Active</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-emerald-50 text-emerald-600">
                <Radio className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{activeCount}</div>
            <p className="mt-1 text-[11px] text-emerald-600 font-medium">98.4% online & sensing</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Offline</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-rose-50 text-rose-600">
                <Signal className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{offlineCount}</div>
            <p className="mt-1 text-[11px] text-rose-600 font-medium">No heartbeat link</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Processing</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-amber-50 text-amber-600">
                <Radio className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{processingCount}</div>
            <p className="mt-1 text-[11px] text-slate-500">Depot idle or upload</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">GPS Connected</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-blue-50 text-blue-600">
                <Satellite className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{gpsConnectedCount}</div>
            <p className="mt-1 text-[11px] text-slate-500">Location lock healthy</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Camera Array</span>
              <span className="grid h-8 w-8 place-items-center rounded-md bg-purple-50 text-purple-600">
                <Camera className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{cameraConnectedCount}</div>
            <p className="mt-1 text-[11px] text-slate-500">All 4 channels streaming</p>
          </div>
        </div>

        {/* Filters & Actions Bar */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-xs md:grid-cols-6">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Bus ID or Route..."
              className="h-8 w-full rounded border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* Route Filter */}
          <select
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
            className="h-8 rounded border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
          >
            <option value="all">All Routes</option>
            <option value="B1">Route B1 (WEH Corridor)</option>
            <option value="B2">Route B2 (Bandra-Kurla Link)</option>
            <option value="B3">Route B3 (LBS Marg)</option>
            <option value="B4">Route B4 (Kurla-Sion)</option>
            {customRoutes.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-8 rounded border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="idle">Idle</option>
            <option value="offline">Offline</option>
          </select>

          {/* GPS Status Filter */}
          <select
            value={selectedGps}
            onChange={(e) => setSelectedGps(e.target.value)}
            className="h-8 rounded border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
          >
            <option value="all">All GPS States</option>
            <option value="connected">GPS Connected</option>
            <option value="degraded">GPS Degraded</option>
            <option value="lost">GPS Lost</option>
          </select>

          {/* Camera Status Filter */}
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="h-8 rounded border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
          >
            <option value="all">All Camera States</option>
            <option value="full">Full Array (4/4)</option>
            <option value="degraded">Degraded (&lt; 4)</option>
          </select>

          {/* Add Bus Route Button */}
          <button
            onClick={() => setIsAddRouteOpen(true)}
            className="flex h-8 items-center justify-center gap-1.5 rounded bg-blue-700 px-3 text-xs font-semibold text-white shadow-xs hover:bg-blue-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Bus Route</span>
          </button>
        </div>

        {/* Fleet Table */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 bg-slate-50">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Fleet Operational Registry ({filteredBuses.length} units listed)
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Live sensing feed from public transport depot units
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5">Bus ID</th>
                  <th className="px-4 py-2.5">Route</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">GPS</th>
                  <th className="px-4 py-2.5">Camera Array</th>
                  <th className="px-4 py-2.5">Last Seen</th>
                  <th className="px-4 py-2.5">Issues Detected</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredBuses.map((bus) => (
                  <tr
                    key={bus.id}
                    onClick={() => setActiveDrawerBus(bus)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{bus.id}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-blue-700 block">Route {bus.route}</span>
                      <span className="text-[11px] text-slate-500">{bus.operator}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          bus.status === "active"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : bus.status === "idle"
                            ? "border-amber-300 bg-amber-50 text-amber-800"
                            : "border-slate-300 bg-slate-50 text-slate-700"
                        }`}
                      >
                        {bus.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      <span
                        className={
                          bus.gps === "connected"
                            ? "text-emerald-700 font-semibold"
                            : bus.gps === "degraded"
                            ? "text-amber-700"
                            : "text-rose-600"
                        }
                      >
                        {bus.gps}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-slate-900 font-semibold">
                        {bus.camerasOnline}/{bus.camerasTotal}
                      </span>{" "}
                      <span className="text-[11px] text-slate-500">channels</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                      {bus.lastPacket}
                    </td>
                    <td className="px-4 py-3 text-slate-700 truncate max-w-[200px]">
                      {bus.lastEventLabel}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDrawerBus(bus);
                        }}
                        className="inline-flex items-center gap-1 rounded border border-blue-600 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-600 hover:text-white transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Inspect Unit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bus Detail Drawer */}
      <BusDetailDrawer
        bus={activeDrawerBus}
        onClose={() => setActiveDrawerBus(null)}
      />

      {/* Add Bus Route Modal */}
      <AddBusRouteModal
        isOpen={isAddRouteOpen}
        onClose={() => setIsAddRouteOpen(false)}
        onSuccess={(newRoute) => {
          setCustomRoutes((prev) => [...prev, newRoute.routeName]);
        }}
      />
    </AppShell>
  );
}
