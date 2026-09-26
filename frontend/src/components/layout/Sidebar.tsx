import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bus,
  LayoutGrid,
  ListTodo,
  Map as MapIcon,
  Settings,
  ShieldAlert,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";

const COMMAND_ITEMS = [
  { to: "/overview", label: "Overview", icon: LayoutGrid, altRoute: "/" },
  { to: "/videos", label: "Video Processing", icon: Video, altRoute: "/video-processing" },
  { to: "/action-center", label: "Action Center", icon: ListTodo, altRoute: "/work-queue" },
  { to: "/city-map", label: "City Map", icon: MapIcon, altRoute: "/map" },
  { to: "/incidents", label: "Incidents", icon: ShieldAlert, altRoute: "/safety" },
] as const;

const OPERATIONS_ITEMS = [
  { to: "/fleet", label: "Fleet", icon: Bus, altRoute: "/buses" },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const renderNavGroup = (items: typeof COMMAND_ITEMS | typeof OPERATIONS_ITEMS) => (
    <nav className="space-y-1">
      {items.map(({ to, label, icon: Icon, altRoute }) => {
        const active =
          pathname === to ||
          pathname === altRoute ||
          (to === "/overview" && pathname === "/");

        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-xs font-semibold transition-colors",
              active
                ? "bg-blue-700 text-white shadow-xs"
                : "text-slate-300 hover:bg-slate-800 hover:text-white",
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                active ? "text-white" : "text-slate-400 group-hover:text-slate-200",
              )}
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <aside
      aria-label="Primary Command Navigation"
      className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-900 text-white"
    >
      {/* Brand Header */}
      <div className="border-b border-slate-800 p-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded bg-blue-600 font-bold text-white shadow-xs">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-wider text-white uppercase">
              TRINETRA
            </h1>
            <p className="text-[10px] leading-tight text-slate-400">
              Urban Intelligence & Mobility Command Center
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Section */}
      <div className="flex flex-1 flex-col p-3 overflow-y-auto space-y-4">
        {/* COMMAND Group */}
        <div>
          <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            COMMAND
          </div>
          {renderNavGroup(COMMAND_ITEMS)}
        </div>

        {/* OPERATIONS Group */}
        <div>
          <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            OPERATIONS
          </div>
          {renderNavGroup(OPERATIONS_ITEMS)}
        </div>
      </div>

      {/* Footer System Status */}
      <div className="border-t border-slate-800 p-3">
        <div className="flex items-center gap-2 rounded bg-slate-950/60 px-2.5 py-2 text-[11px] text-slate-400 border border-slate-800">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="font-mono text-slate-300 font-medium">SYS_ONLINE</span>
          <span className="ml-auto text-[10px] text-slate-500">v2.4.0</span>
        </div>
      </div>
    </aside>
  );
}
