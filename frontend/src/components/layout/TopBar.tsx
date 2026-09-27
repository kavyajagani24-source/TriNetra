import { useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Search, ShieldCheck, User } from "lucide-react";
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
    title: "Safety & Incidents",
    subtitle: "Vulnerable road user safety events and hazard verification console.",
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
  const { issues, buses, notifications, markAllRead, role, setRole, selectIssue } = useStore();
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const meta = (pathname === "/city-map" || pathname === "/map")
    ? {
        title: "City Map",
        subtitle: "Road & Infrastructure Intelligence â€¢ Andheri, Mumbai",
      }
    : PAGE_META[pathname] || {
        title: "City Map",
        subtitle: "Road & Infrastructure Intelligence â€¢ Andheri, Mumbai",
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
        secondary: `${i.road} â€¢ ${i.priority}`,
      }));
    const busHits = buses
      .filter((b) => b.id.toLowerCase().includes(q) || b.route.includes(q))
      .slice(0, 3)
      .map((b) => ({
        kind: "bus" as const,
        id: b.id,
        primary: `${b.id} â€” Route ${b.route}`,
        secondary: `Speed: ${b.speedKph} km/h â€¢ ${b.status}`,
      }));
    return [...issueHits, ...busHits];
  }, [query, issues, buses]);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#DCE9E1] bg-white px-5 select-none">
      {/* Page Title & Context + Mobile Brand Logo */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 md:hidden group">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded bg-[#4BAF7C] p-1 shadow-sm">
            <img src="/logos/logo-icon-light.png" alt="TriNetra" className="h-5 w-5 object-contain" />
          </div>
          <img src="/logos/logo-text.png" alt="त्रिNetra" className="h-3.5 w-auto object-contain" />
        </Link>
        <div>
          <h1 className="font-display text-base font-bold tracking-tight text-[#26352E]">{meta.title}</h1>
          <p className="font-ui text-xs font-medium text-[#64736B] hidden sm:block">{meta.subtitle}</p>
        </div>
      </div>

      {/* Right Controls Area */}
      <div className="flex items-center gap-3">
        {/* Global Search */}
        <div className="relative w-64 hidden lg:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#91A099]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roads, issues or buses"
            className="h-8 w-full rounded-md border border-[#DCE9E1] bg-[#F7FAF8] pl-8 pr-3 font-ui text-xs text-[#26352E] placeholder-[#91A099] outline-none focus:border-[#4BAF7C] focus:bg-white focus:ring-1 focus:ring-[#4BAF7C]/20 transition-all"
          />
          {searchResults.length > 0 && (
            <ul className="absolute left-0 right-0 top-9 z-50 rounded-md border border-[#DCE9E1] bg-white p-1 shadow-md max-h-64 overflow-y-auto">
              {searchResults.map((r) => (
                <li key={`${r.kind}-${r.id}`}>
                  <button
                    onClick={() => {
                      setQuery("");
                      if (r.kind === "issue") {
                        selectIssue(r.id);
                        navigate({ to: "/action-center" });
                      }
                    }}
                    className="w-full rounded px-2.5 py-1.5 text-left hover:bg-[#F0F7F3]"
                  >
                    <span className="block truncate text-xs font-semibold text-[#26352E]">
                      {r.primary}
                    </span>
                    <span className="block truncate text-[11px] text-[#64736B]">
                      {r.secondary}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Monitoring Ingest Badge */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-md border border-[#CBEBDD] bg-[#E4F5EC] px-2.5 py-1 text-[11px] font-medium text-[#26352E]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#4BAF7C]" />
          <span>Ingest Active</span>
        </div>

        {/* Notifications Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="relative grid h-8 w-8 place-items-center rounded-md border border-[#DCE9E1] bg-white hover:bg-[#F0F7F3] text-[#26352E] transition-colors"
              aria-label="Open notifications"
            >
              <Bell className="h-4 w-4 text-[#64736B]" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#E27676] px-1 text-[9px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 border border-[#DCE9E1] shadow-md bg-white">
            <div className="flex items-center justify-between border-b border-[#DCE9E1] px-3.5 py-2.5 bg-[#F7FAF8]">
              <span className="text-xs font-bold text-[#26352E] uppercase tracking-wider">Notifications</span>
              <Button variant="ghost" size="sm" className="h-6 text-[11px] text-[#4BAF7C] hover:text-[#3F9F70] hover:bg-[#E4F5EC]" onClick={markAllRead}>
                Mark all read
              </Button>
            </div>
            <ul className="divide-y divide-[#DCE9E1] max-h-72 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id} className={cn("p-3 text-xs", n.unread ? "bg-[#EAF7F0]/50" : "bg-white")}>
                  <p className="font-semibold text-[#26352E]">{n.title}</p>
                  <p className="text-[#64736B] text-[11px] mt-0.5">{n.detail}</p>
                  <p className="text-[10px] text-[#91A099] font-mono mt-1">{n.at}</p>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>

        {/* User Role Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md border border-[#DCE9E1] bg-white px-2.5 py-1 text-xs text-[#26352E] hover:bg-[#F0F7F3] transition-colors">
              <span className="grid h-6 w-6 place-items-center rounded bg-[#E4F5EC] text-[11px] font-bold text-[#4BAF7C]">
                {role.slice(0, 2).toUpperCase()}
              </span>
              <span className="hidden md:inline font-medium">{ROLE_LABEL[role]}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border border-[#DCE9E1] bg-white shadow-md">
            <DropdownMenuLabel className="text-xs font-semibold text-[#64736B]">Switch Perspective</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#DCE9E1]" />
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <DropdownMenuItem
                key={r}
                onClick={() => setRole(r)}
                className={cn(
                  "cursor-pointer text-xs",
                  role === r ? "bg-[#E4F5EC] text-[#26352E] font-semibold" : "text-[#26352E]",
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


