import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bus,
  Gauge,
  Inbox,
  LayoutGrid,
  LogOut,
  Map as MapIcon,
  Route as RouteIcon,
  Settings,
  ShieldAlert,
  ShieldCheck,
  TrafficCone,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NAV = [
  { to: "/overview", label: "Overview", icon: LayoutGrid },
  { to: "/videos", label: "Video Ingestion & AI", icon: Video },
  { to: "/map", label: "Live Map", icon: MapIcon },
  { to: "/roads", label: "Road Intelligence", icon: RouteIcon },
  { to: "/traffic", label: "Traffic Intelligence", icon: TrafficCone },
  { to: "/safety", label: "Safety & Incidents", icon: ShieldAlert },
  { to: "/incidents", label: "Evidence Viewer", icon: Activity },
  { to: "/buses", label: "Bus Registry", icon: Bus },
  { to: "/fleet", label: "Fleet Telemetry", icon: Gauge },
  { to: "/work-queue", label: "Work Queue", icon: Inbox },
  { to: "/verification", label: "Verification", icon: ShieldCheck },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Primary"
      className="flex w-[64px] shrink-0 flex-col items-center border-r border-border bg-card py-2"
    >
      <div className="flex flex-1 flex-col items-center gap-0.5">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || (to === "/overview" && pathname === "/");
          return (
            <Tooltip key={to}>
              <TooltipTrigger asChild>
                <Link
                  to={to}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative grid h-10 w-10 place-items-center rounded transition-colors",
                    active
                      ? "bg-info-soft text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {active ? (
                    <span className="absolute left-0 h-5 w-0.5 rounded-r bg-primary" />
                  ) : null}
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-[11px]">
                {label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-1 border-t border-border pt-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="grid h-8 w-8 place-items-center" aria-label="System operational">
              <span className="h-2 w-2 rounded-full bg-ok" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-[11px]">
            System operational · ingest healthy
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/login"
              aria-label="Sign out"
              className="grid h-8 w-8 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-[11px]">
            Sign out
          </TooltipContent>
        </Tooltip>
      </div>
    </nav>
  );
}
