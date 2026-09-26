import { useMemo, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
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
  "/roads": {
    title: "Road Intelligence",
    subtitle: "Surface quality metrics, roughness indices, and pavement condition index (PCI).",
  },
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

  const meta = PAGE_META[pathname] || {
    title: "City Map Intelligence",
    subtitle: "Spatial road network analysis & infrastructure condition console.",
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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#D9E2DC] bg-white px-5 select-none">
      {/* Page Title & Context */}
      <div>
        <h1 className="text-sm font-bold text-[#1F2933]">{meta.title}</h1>
        <p className="text-[11px] text-[#66736D] hidden sm:block">{meta.subtitle}</p>
      </div>

      {/* Right Controls Area */}
      <div className="flex items-center gap-3">
        {/* Global Search */}
        <div className="relative w-64 hidden lg:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#66736D]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search streets, defects, vehicles..."
            className="h-8 w-full rounded-md border border-[#D9E2DC] bg-[#F8FAF8] pl-8 pr-3 text-xs text-[#1F2933] placeholder-[#66736D]/70 outline-none focus:border-[#3F8F68] focus:bg-white focus:ring-1 focus:ring-[#3F8F68]/20 transition-all"
          />
          {searchResults.length > 0 && (
            <ul className="absolute left-0 right-0 top-9 z-50 rounded-md border border-[#D9E2DC] bg-white p-1 shadow-md max-h-64 overflow-y-auto">
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
                    className="w-full rounded px-2.5 py-1.5 text-left hover:bg-[#F3F6F4]"
                  >
                    <span className="block truncate text-xs font-semibold text-[#1F2933]">
                      {r.primary}
                    </span>
                    <span className="block truncate text-[11px] text-[#66736D]">
                      {r.secondary}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Monitoring Ingest Badge */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-md border border-[#DDEFE5] bg-[#EEF7F1] px-2.5 py-1 text-[11px] font-medium text-[#245B45]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#245B45]" />
          <span>Ingest Active</span>
        </div>

        {/* Notifications Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="relative grid h-8 w-8 place-items-center rounded-md border border-[#D9E2DC] bg-white hover:bg-[#F3F6F4] text-[#1F2933] transition-colors"
              aria-label="Open notifications"
            >
              <Bell className="h-4 w-4 text-[#66736D]" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#DC2626] px-1 text-[9px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 border border-[#D9E2DC] shadow-md bg-white">
            <div className="flex items-center justify-between border-b border-[#D9E2DC] px-3.5 py-2.5 bg-[#F8FAF8]">
              <span className="text-xs font-bold text-[#1F2933] uppercase tracking-wider">Notifications</span>
              <Button variant="ghost" size="sm" className="h-6 text-[11px] text-[#245B45] hover:text-[#245B45]/80 hover:bg-[#EEF7F1]" onClick={markAllRead}>
                Mark all read
              </Button>
            </div>
            <ul className="divide-y divide-[#D9E2DC] max-h-72 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id} className={cn("p-3 text-xs", n.unread ? "bg-[#EEF7F1]/40" : "bg-white")}>
                  <p className="font-semibold text-[#1F2933]">{n.title}</p>
                  <p className="text-[#66736D] text-[11px] mt-0.5">{n.detail}</p>
                  <p className="text-[10px] text-[#66736D]/80 font-mono mt-1">{n.at}</p>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>

        {/* User Role Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md border border-[#D9E2DC] bg-white px-2.5 py-1 text-xs text-[#1F2933] hover:bg-[#F3F6F4] transition-colors">
              <span className="grid h-6 w-6 place-items-center rounded bg-[#EEF7F1] text-[11px] font-bold text-[#245B45]">
                {role.slice(0, 2).toUpperCase()}
              </span>
              <span className="hidden md:inline font-medium">{ROLE_LABEL[role]}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border border-[#D9E2DC] bg-white shadow-md">
            <DropdownMenuLabel className="text-xs font-semibold text-[#66736D]">Switch Perspective</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#D9E2DC]" />
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <DropdownMenuItem
                key={r}
                onClick={() => setRole(r)}
                className={cn(
                  "cursor-pointer text-xs",
                  role === r ? "bg-[#EEF7F1] text-[#245B45] font-semibold" : "text-[#1F2933]",
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
