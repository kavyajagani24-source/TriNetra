import { Link, useRouterState } from "@tanstack/react-router";
import {
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

/* ── Authoritative 8 Top-Level Navigation Areas ── */

const COMMAND_NAV = [
  { to: "/overview", label: "Overview", icon: LayoutGrid },
  { to: "/action-center", label: "Action Center", icon: ListTodo },
  { to: "/city-map", label: "City Map", icon: MapIcon },
  { to: "/incidents", label: "Incidents", icon: ShieldAlert },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/fleet", label: "Fleet", icon: Bus },
  { to: "/videos", label: "Video Processing", icon: Video },
] as const;

const SETTINGS_NAV = [
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: readonly { to: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  pathname: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#91A099]">
        {label}
      </div>
      {items.map(({ to, label: navLabel, icon: Icon }) => {
        const active =
          pathname === to ||
          (to === "/overview" && pathname === "/") ||
          (to === "/city-map" && (pathname === "/map" || pathname.startsWith("/city-map"))) ||
          (to === "/fleet" && pathname === "/buses") ||
          (to === "/videos" && (pathname === "/video-processing" || pathname.startsWith("/videos")));

        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-2.5 rounded-md mx-1.5 px-2.5 py-1.5 text-xs transition-all duration-150",
              active
                ? "bg-[#E4F5EC] text-[#26352E] font-semibold border border-[#CBEBDD]"
                : "text-[#64736B] font-medium hover:bg-[#F0F7F3] hover:text-[#26352E]",
            )}
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                active ? "text-[#4BAF7C]" : "text-[#91A099] group-hover:text-[#4BAF7C]",
              )}
            />
            <span className="truncate">{navLabel}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside
      aria-label="Primary Navigation"
      className="flex w-56 shrink-0 flex-col bg-white border-r border-[#DCE9E1] text-[#26352E] select-none"
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center px-3.5 border-b border-[#DCE9E1]">
        <Link to="/" className="flex items-center gap-2.5 min-w-0 transition-opacity hover:opacity-90">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#4BAF7C] p-1 shadow-sm">
            <img
              src="/logos/logo-icon.png"
              alt="TriNetra Icon"
              className="h-6 w-6 object-contain"
            />
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <img
              src="/logos/logo-text.png"
              alt="TriNetra"
              className="h-4 w-auto object-contain object-left"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <p className="text-[9px] font-semibold tracking-wider text-[#91A099] uppercase leading-tight mt-0.5">
              Urban Intelligence
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex flex-1 flex-col py-1.5 overflow-y-auto scroll-thin">
        <NavGroup label="Command" items={COMMAND_NAV} pathname={pathname} />
        <NavGroup label="Settings" items={SETTINGS_NAV} pathname={pathname} />
      </div>

      {/* Footer Status */}
      <div className="border-t border-[#DCE9E1] p-3">
        <div className="flex items-center gap-2 rounded-md bg-[#F0F7F3] px-2.5 py-1.5 text-[11px] text-[#64736B] border border-[#DCE9E1]">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#68C491]" />
          </span>
          <span className="font-medium text-[#26352E]">Operational</span>
          <span className="ml-auto font-data text-[10px] text-[#91A099] font-medium">v2.4</span>
        </div>
      </div>
    </aside>
  );
}
