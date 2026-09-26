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
  Route,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Group 1: Core Command & Spatial
const MAIN_NAVIGATION = [
  { to: "/overview", label: "Overview", icon: LayoutGrid, altRoute: "/" },
  { to: "/city-map", label: "City Map", icon: MapIcon, altRoute: "/map" },
  { to: "/roads", label: "Road Intelligence", icon: Route, altRoute: "/road-intelligence" },
  { to: "/traffic", label: "Traffic", icon: Video, altRoute: "/videos" },
  { to: "/incidents", label: "Safety & Incidents", icon: ShieldAlert, altRoute: "/safety" },
  { to: "/action-center", label: "Action Center", icon: ListTodo, altRoute: "/work-queue" },
  { to: "/fleet", label: "Fleet", icon: Bus, altRoute: "/buses" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, altRoute: "/analytics" },
] as const;

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside
      aria-label="Primary Command Navigation"
      className="flex w-60 shrink-0 flex-col border-r border-[#D9E2DC] bg-white text-[#1F2933] select-none"
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center gap-3 border-b border-[#D9E2DC] px-4 bg-white">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#245B45] text-white shadow-xs">
          <Activity className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xs font-bold tracking-wider text-[#1F2933] uppercase">
            TRINETRA
          </h1>
          <p className="text-[10px] text-[#66736D] truncate leading-tight">
            Urban Intelligence &amp; Mobility
          </p>
        </div>
      </div>

      {/* Navigation Section */}
      <div className="flex flex-1 flex-col py-3 px-2.5 overflow-y-auto space-y-1">
        <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#66736D]">
          Platform Navigation
        </div>

        <nav className="space-y-0.5">
          {MAIN_NAVIGATION.map(({ to, label, icon: Icon, altRoute }) => {
            const active =
              pathname === to ||
              pathname === altRoute ||
              (to === "/overview" && pathname === "/") ||
              (to === "/roads" && (pathname === "/roads" || pathname === "/road-intelligence"));

            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                  active
                    ? "bg-[#EEF7F1] text-[#245B45] font-semibold border border-[#DDEFE5]"
                    : "text-[#66736D] font-medium hover:bg-[#F3F6F4] hover:text-[#1F2933]",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-[#245B45]" : "text-[#66736D] group-hover:text-[#1F2933]",
                  )}
                />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Navigation & System Status */}
      <div className="border-t border-[#D9E2DC] p-3 bg-[#F8FAF8] space-y-2">
        <Link
          to="/settings"
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
            pathname === "/settings"
              ? "bg-[#EEF7F1] text-[#245B45] font-semibold border border-[#DDEFE5]"
              : "text-[#66736D] font-medium hover:bg-[#F3F6F4] hover:text-[#1F2933]",
          )}
        >
          <Settings className="h-4 w-4 text-[#66736D]" />
          <span>Settings</span>
        </Link>

        <div className="flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-[11px] text-[#66736D] border border-[#D9E2DC]">
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#16A34A]" />
          </span>
          <span className="font-medium text-[#1F2933]">Operational</span>
          <span className="ml-auto text-[10px] text-[#66736D] font-mono">v2.4.0</span>
        </div>
      </div>
    </aside>
  );
}
