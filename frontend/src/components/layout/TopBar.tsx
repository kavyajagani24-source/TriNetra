import { useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Laptop,
  Moon,
  Search,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStore } from "@/state/app-store";
import { useTheme } from "@/state/theme";
import type { Role } from "@/types";

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/overview": {
    title: "Urban Intelligence Overview",
    subtitle: "Situational awareness generated from fleet sensor telemetry.",
  },
  "/": {
    title: "Urban Intelligence Overview",
    subtitle: "Situational awareness generated from fleet sensor telemetry.",
  },
  "/action-center": {
    title: "Action Center",
    subtitle: "Centralized operational triage for road defects, traffic, and safety hazards.",
  },
  "/work-queue": {
    title: "Action Center",
    subtitle: "Centralized operational triage for road defects, traffic, and safety hazards.",
  },
  "/city-map": {
    title: "City Map Intelligence",
    subtitle: "Spatial road network analysis & infrastructure condition console.",
  },
  "/map": {
    title: "City Map Intelligence",
    subtitle: "Spatial road network analysis & infrastructure condition console.",
  },
  "/roads": { title: "Road Intelligence", subtitle: "Pavement condition, defect surveys and infrastructure health." },
  "/traffic": {
    title: "Traffic Intelligence",
    subtitle: "Real-time congestion tracking, corridor volume, and intersection bottlenecks.",
  },
  "/incidents": {
    title: "Incident & ANPR Intelligence",
    subtitle: "9-stage neural incident triage, rash driving kinematics, and plate recognition console.",
  },
  "/fleet": {
    title: "Fleet Operations",
    subtitle: "Vehicle tracking, sensor health, and daily survey route telemetry.",
  },
  "/analytics": {
    title: "Infrastructure Analytics",
    subtitle: "Executive municipal infrastructure condition reporting and trends.",
  },
  "/videos": {
    title: "Video Processing",
    subtitle: "Upload bus footage and run multi-module analysis: Road, Traffic, Safety, Incident.",
  },
  "/settings": {
    title: "Platform Settings",
    subtitle: "Configuration, telemetry thresholds, and role administration.",
  },
};

const ROLE_LABEL: Record<Role, string> = {
  pwd: "PWD Engineer",
  traffic: "Traffic Police Officer",
  transport: "Transport Authority",
  executive: "Municipal Commissioner",
};

export function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const {
    issues,
    buses,
    notifications,
    markAllRead,
    role,
    setRole,
    selectIssue,
    demoMode,
    toggleDemoMode,
  } = useStore();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const meta = (pathname === "/city-map" || pathname === "/map")
    ? {
        title: "City Map",
        subtitle: demoMode
          ? "Road & Infrastructure Intelligence • Andheri, Mumbai (Demo)"
          : "Spatial road network analysis & live defect telemetry",
      }
    : PAGE_META[pathname] || {
        title: "TriNetra Command Center",
        subtitle: "Urban Intelligence Platform",
      };

  const unread = notifications.filter((n) => n.unread).length;

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const issueHits = issues
      .filter(
        (i) =>
          i.id.toLowerCase().includes(q) ||
          i.road.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q),
      )
      .slice(0, 4)
      .map((i) => ({
        kind: "issue" as const,
        id: i.id,
        primary: i.title,
        secondary: `${i.road} • ${i.priority}`,
      }));
    const busHits = buses
      .filter((b) => b.id.toLowerCase().includes(q) || b.route.includes(q))
      .slice(0, 3)
      .map((b) => ({
        kind: "bus" as const,
        id: b.id,
        primary: `${b.id} — Route ${b.route}`,
        secondary: `Speed: ${b.speedKph} km/h • ${b.status}`,
      }));
    return [...issueHits, ...busHits];
  }, [query, issues, buses]);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-5 select-none transition-colors">
      {/* Page Title & Context + Mobile Brand Logo */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 md:hidden group">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded bg-primary p-1 shadow-xs">
            <img src="/logos/logo-icon-light.png" alt="TriNetra" className="h-5 w-5 object-contain" />
          </div>
          <span className="font-display font-bold text-foreground">TriNetra</span>
        </Link>
        <div>
          <h1 className="font-display text-base font-bold tracking-tight text-foreground">{meta.title}</h1>
          <p className="font-ui text-xs font-medium text-muted-foreground hidden sm:block">{meta.subtitle}</p>
        </div>
      </div>

      {/* Right Controls Area */}
      <div className="flex items-center gap-2.5">
        {/* Omnisearch */}
        <div className="relative hidden md:block">
          <div className="flex items-center rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground focus-within:border-primary focus-within:bg-card">
            <Search className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search assets, corridors..."
              className="w-48 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden"
            />
          </div>

          {searchResults.length > 0 && (
            <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-md border border-border bg-card shadow-lg">
              <ul className="divide-y divide-border text-xs">
                {searchResults.map((r) => (
                  <li
                    key={`${r.kind}-${r.id}`}
                    onClick={() => {
                      if (r.kind === "issue") {
                        selectIssue(r.id);
                        navigate({ to: "/action-center" });
                      } else {
                        navigate({ to: "/fleet" });
                      }
                      setQuery("");
                    }}
                    className="cursor-pointer p-2.5 hover:bg-muted"
                  >
                    <p className="font-semibold text-foreground">{r.primary}</p>
                    <p className="text-[11px] text-muted-foreground">{r.secondary}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Live System Status Indicator */}
        <div className="flex items-center gap-1.5 rounded-md border border-emerald-600/25 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 shadow-xs">
          <span className="h-2 w-2 rounded-full bg-emerald-600" />
          <span>LIVE MODE</span>
        </div>

        {/* Notifications Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="relative grid h-8 w-8 place-items-center rounded-md border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer"
              aria-label="Open notifications"
            >
              <Bell className="h-4 w-4 text-muted-foreground" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 border border-border shadow-md bg-card">
            <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5 bg-muted/40">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">Notifications</span>
              <Button variant="ghost" size="sm" className="h-6 text-[11px] text-primary hover:text-primary hover:bg-muted" onClick={markAllRead}>
                Mark all read
              </Button>
            </div>
            <ul className="divide-y divide-border max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <li className="p-4 text-center text-xs text-muted-foreground">No new notifications</li>
              ) : (
                notifications.map((n) => (
                  <li key={n.id} className={cn("p-3 text-xs", n.unread ? "bg-primary/5" : "bg-card")}>
                    <p className="font-semibold text-foreground">{n.title}</p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">{n.detail}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-1">{n.at}</p>
                  </li>
                ))
              )}
            </ul>
          </PopoverContent>
        </Popover>

        {/* User Role Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:bg-muted transition-colors cursor-pointer">
              <span className="grid h-6 w-6 place-items-center rounded bg-primary/10 text-[11px] font-bold text-primary">
                {role.slice(0, 2).toUpperCase()}
              </span>
              <span className="hidden md:inline font-medium">{ROLE_LABEL[role]}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border border-border bg-card shadow-md">
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Switch Perspective</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <DropdownMenuItem
                key={r}
                onClick={() => setRole(r)}
                className={cn(
                  "cursor-pointer text-xs",
                  role === r ? "bg-muted text-foreground font-semibold" : "text-foreground",
                )}
              >
                {ROLE_LABEL[r]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
