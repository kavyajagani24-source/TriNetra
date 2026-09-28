import { Link, useRouterState } from "@tanstack/react-router";
import {
  AlertTriangle,
  BarChart3,
  Bus,
  Car,
  LayoutGrid,
  ListTodo,
  Map as MapIcon,
  Settings,
  Shield,
  Video,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Authoritative Navigation Structure ── */

const COMMAND_NAV = [
  { to: "/overview", label: "Overview", icon: LayoutGrid },
  { to: "/videos", label: "Video Processing", icon: Video },
  { to: "/city-map", label: "City Map", icon: MapIcon },
  { to: "/incidents", label: "Incidents & ANPR", icon: Zap },
  { to: "/action-center", label: "Action Center", icon: ListTodo },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

const OPERATIONS_NAV = [
  { to: "/fleet", label: "Fleet Telemetry", icon: Bus },
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
      <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      {items.map(({ to, label: navLabel, icon: Icon }) => {
        const active =
          pathname === to ||
          (to === "/overview" && pathname === "/") ||
          (to === "/city-map" && (pathname === "/map" || pathname.startsWith("/city-map"))) ||
          (to === "/fleet" && pathname === "/buses") ||
          (to === "/videos" && (pathname === "/video-processing" || pathname.startsWith("/videos"))) ||
          (to === "/roads" && (pathname === "/road-intelligence" || pathname.startsWith("/roads"))) ||
          (to === "/traffic" && (pathname === "/traffic-flow" || pathname.startsWith("/traffic"))) ||
          (to === "/safety" && (pathname === "/vru" || pathname.startsWith("/safety"))) ||
          (to === "/incidents" && (pathname === "/anpr" || pathname.startsWith("/incidents")));

        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-2.5 rounded-md mx-1.5 px-2.5 py-1.5 text-xs transition-all duration-150 cursor-pointer",
              active
                ? "bg-primary/10 text-foreground font-semibold border border-primary/20"
                : "text-muted-foreground font-medium hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                active ? "text-primary" : "text-muted-foreground group-hover:text-primary",
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
      className="flex w-56 shrink-0 flex-col bg-card border-r border-border text-foreground select-none transition-colors"
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center px-3.5 border-b border-border">
        <Link to="/" className="flex items-center gap-2.5 min-w-0 transition-opacity hover:opacity-90">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary p-1 shadow-xs">
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
              className="h-4 w-auto object-contain object-left dark:invert dark:brightness-200"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <p className="text-[9px] font-semibold tracking-wider text-muted-foreground uppercase leading-tight mt-0.5">
              Urban Intelligence
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex flex-1 flex-col py-1.5 overflow-y-auto scroll-thin space-y-1">
        <NavGroup label="Command Center" items={COMMAND_NAV} pathname={pathname} />
        <NavGroup label="Operations" items={OPERATIONS_NAV} pathname={pathname} />
      </div>

      {/* Footer Status */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground border border-border">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
          </span>
          <span className="font-medium text-foreground">Operational</span>
          <span className="ml-auto font-data text-[10px] text-muted-foreground font-medium">v2.4</span>
        </div>
      </div>
    </aside>
  );
}
