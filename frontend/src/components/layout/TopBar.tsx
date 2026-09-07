import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, ChevronDown, Search, Signal, Wifi } from "lucide-react";
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

import { SystemStatus } from "@/components/layout/SystemStatus";

const ROLE_LABEL: Record<Role, string> = {
  pwd: "PWD Engineer",
  traffic: "Traffic Police",
  transport: "Transport Authority",
  executive: "Commissioner / Executive",
};

function Logo() {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-primary">
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path
            d="M3 14h3.5l2-6 3 12 3-9 2 3H21"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[13px] font-semibold tracking-tight text-foreground">
          UrbanEye AI
        </span>
        <span className="block truncate text-[10px] text-muted-foreground">
          Centralized Urban Intelligence
        </span>
      </span>
    </span>
  );
}

export function TopBar() {
  const { issues, buses, notifications, markAllRead, role, setRole, selectIssue } = useStore();
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const unread = notifications.filter((n) => n.unread).length;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const issueHits = issues
      .filter(
        (i) =>
          i.id.toLowerCase().includes(q) ||
          i.road.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          i.segmentId.toLowerCase().includes(q),
      )
      .slice(0, 5)
      .map((i) => ({
        kind: "issue" as const,
        id: i.id,
        primary: `${i.title} · ${i.id}`,
        secondary: `${i.road} · ${i.priority} · ${Math.round(i.confidence * 100)}% · ${i.observationCount} observations`,
      }));
    const busHits = buses
      .filter((b) => b.id.toLowerCase().includes(q) || b.route.includes(q))
      .slice(0, 3)
      .map((b) => ({
        kind: "bus" as const,
        id: b.id,
        primary: `${b.id} · Route ${b.route}`,
        secondary: `${b.status} · ${b.lastEventLabel}`,
      }));
    return [...issueHits, ...busHits];
  }, [query, issues, buses]);

  return (
    <header className="grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-card px-3 lg:grid-cols-[240px_minmax(0,1fr)_auto]">
      <Logo />

      <div className="relative hidden min-w-0 lg:block">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search issues, roads, buses, coordinates..."
          aria-label="Global search"
          className="h-8 w-full rounded border border-border bg-background pl-8 pr-3 text-[12px] outline-none focus:border-primary/50 focus:ring-2 focus:ring-ring/25"
        />
        {results.length ? (
          <ul className="panel absolute left-0 right-0 top-9 z-50 max-h-72 overflow-y-auto p-1">
            {results.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <button
                  className="w-full rounded px-2 py-1.5 text-left hover:bg-secondary"
                  onClick={() => {
                    setQuery("");
                    if (r.kind === "issue") {
                      selectIssue(r.id);
                      navigate({ to: "/map" });
                    } else {
                      navigate({ to: "/fleet" });
                    }
                  }}
                >
                  <span className="block truncate text-[12px] font-medium text-foreground">
                    {r.primary}
                  </span>
                  <span className="num block truncate text-[11px] text-muted-foreground">
                    {r.secondary}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <SystemStatus />

        <Popover>
          <PopoverTrigger asChild>
            <button
              className="relative grid h-8 w-8 place-items-center rounded hover:bg-secondary"
              aria-label={`Notifications, ${unread} unread`}
            >
              <Bell className="h-4 w-4 text-muted-foreground" aria-hidden />
              {unread ? (
                <span className="num absolute right-0.5 top-0.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-critical px-1 text-[9px] font-bold text-white">
                  {unread}
                </span>
              ) : null}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <p className="label-xs">Notifications</p>
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={markAllRead}>
                Mark all read
              </Button>
            </div>
            <ul className="scroll-thin max-h-80 divide-y divide-border overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id} className={cn("px-3 py-2", n.unread && "bg-info-soft/60")}>
                  <p className="text-[12px] font-medium text-foreground">{n.title}</p>
                  <p className="text-[11px] text-muted-foreground">{n.detail}</p>
                  <p className="num text-[10px] text-muted-foreground">{n.at}</p>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded border border-border px-2 py-1 hover:bg-secondary">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                KJ
              </span>
              <span className="hidden min-w-0 text-left leading-tight sm:block">
                <span className="block truncate text-[11px] font-medium text-foreground">
                  K. Jagani
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {ROLE_LABEL[role]}
                </span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-[11px]">Switch role (demo)</DropdownMenuLabel>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <DropdownMenuItem
                key={r}
                onClick={() => setRole(r)}
                className={cn("text-[12px]", role === r && "font-semibold text-primary")}
              >
                {ROLE_LABEL[r]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-[12px]" onClick={() => navigate({ to: "/settings" })}>
              <Wifi className="mr-2 h-3.5 w-3.5" aria-hidden />
              System & demo controls
            </DropdownMenuItem>
            <DropdownMenuItem className="text-[12px]" onClick={() => navigate({ to: "/login" })}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
