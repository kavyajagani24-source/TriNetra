import { useMemo, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronDown, Search, ShieldCheck, User } from "lucide-react";
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
    subtitle: "Real-time situational awareness generated from public transport telemetry.",
  },
  "/": {
    title: "Urban Intelligence Overview",
    subtitle: "Real-time situational awareness generated from public transport telemetry.",
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
    subtitle: "Spatial intelligence layer powered by live vector Mapbox GL JS WebGL.",
  },
  "/map": {
    title: "City Map Intelligence",
    subtitle: "Spatial intelligence layer powered by live vector Mapbox GL JS WebGL.",
  },
  "/incidents": {
    title: "Incidents & Safety Review",
    subtitle: "Human-in-the-loop review console for AI incident candidates.",
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
    title: "Urban Command Center",
    subtitle: "Municipal Urban Intelligence Platform",
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
        primary: `${i.title} (${i.id})`,
        secondary: `${i.road} · ${i.priority}`,
      }));
    const busHits = buses
      .filter((b) => b.id.toLowerCase().includes(q) || b.route.includes(q))
      .slice(0, 3)
      .map((b) => ({
        kind: "bus" as const,
        id: b.id,
        primary: `${b.id} — Route ${b.route}`,
        secondary: `Speed: ${b.speedKph} km/h · ${b.status}`,
      }));
    return [...issueHits, ...busHits];
  }, [query, issues, buses]);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      {/* Title & Context */}
      <div>
        <h1 className="text-sm font-bold text-slate-900">{meta.title}</h1>
        <p className="text-[11px] text-slate-500 hidden sm:block">{meta.subtitle}</p>
      </div>

      {/* Right Controls Area */}
      <div className="flex items-center gap-4">
        {/* Global Search */}
        <div className="relative w-64 hidden lg:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues, roads, buses..."
            className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white"
          />
          {searchResults.length > 0 && (
            <ul className="absolute left-0 right-0 top-9 z-50 rounded-md border border-slate-200 bg-white p-1 shadow-lg max-h-64 overflow-y-auto">
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
                    className="w-full rounded px-2 py-1.5 text-left hover:bg-slate-100"
                  >
                    <span className="block truncate text-xs font-semibold text-slate-900">
                      {r.primary}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500 font-mono">
                      {r.secondary}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Monitoring Health Badge */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-medium text-emerald-800">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Ingest Active</span>
        </div>

        {/* Notifications Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="relative grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
              aria-label="Open notifications"
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 bg-slate-50">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">Notifications</span>
              <Button variant="ghost" size="sm" className="h-6 text-[11px] text-blue-700 hover:text-blue-900" onClick={markAllRead}>
                Mark all read
              </Button>
            </div>
            <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id} className={cn("p-3 text-xs", n.unread ? "bg-blue-50/40" : "bg-white")}>
                  <p className="font-semibold text-slate-900">{n.title}</p>
                  <p className="text-slate-600 text-[11px] mt-0.5">{n.detail}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-1">{n.at}</p>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>

        {/* User Profile & Role Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-white font-bold text-[10px]">
                CM
              </span>
              <div className="text-left hidden md:block leading-tight">
                <span className="block font-semibold text-slate-900 text-[11px]">Command Duty Officer</span>
                <span className="block text-[10px] text-slate-500 font-mono">{ROLE_LABEL[role]}</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-slate-400">Switch Role Context</DropdownMenuLabel>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <DropdownMenuItem
                key={r}
                onClick={() => setRole(r)}
                className={cn("text-xs cursor-pointer", role === r && "font-bold text-blue-700 bg-blue-50")}
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
