import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BUSES, INCIDENTS, ISSUES, NOTIFICATIONS, OBSERVATIONS } from "@/data/mock";
import type {
  AppNotification,
  Bus,
  IncidentCandidate,
  Issue,
  IssueCategory,
  IssueStatus,
  Observation,
  Role,
  Severity,
} from "@/types";

export interface MapFilters {
  categories: IssueCategory[];
  severity: Severity | "all";
  statuses: IssueStatus[];
  timeWindow: "1h" | "today" | "7d" | "custom";
  department: string;
  route: string;
}

export const DEFAULT_FILTERS: MapFilters = {
  categories: [],
  severity: "all",
  statuses: [],
  timeWindow: "today",
  department: "all",
  route: "all",
};

export interface LayerState {
  defects: boolean;
  traffic: boolean;
  safety: boolean;
  incidents: boolean;
  buses: boolean;
  heatmap: boolean;
  roadCondition: boolean;
}

interface Store {
  role: Role;
  setRole: (r: Role) => void;
  issues: Issue[];
  buses: Bus[];
  incidents: IncidentCandidate[];
  observations: Observation[];
  notifications: AppNotification[];
  selectedIssueId: string | null;
  selectIssue: (id: string | null) => void;
  selectedBusId: string | null;
  selectBus: (id: string | null) => void;
  filters: MapFilters;
  setFilters: (f: MapFilters) => void;
  layers: LayerState;
  toggleLayer: (k: keyof LayerState) => void;
  setStatus: (id: string, status: IssueStatus) => void;
  assignIssue: (id: string, to: string) => void;
  setIncidentStatus: (id: string, status: IncidentCandidate["status"]) => void;
  markAllRead: () => void;
  demoEvent: (kind: DemoEvent) => string;
}

export type DemoEvent =
  | "pothole"
  | "congestion"
  | "waterlogging"
  | "incident"
  | "bus_offline"
  | "verification";

const StoreContext = createContext<Store | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("executive");
  const [issues, setIssues] = useState<Issue[]>(ISSUES);
  const [buses, setBuses] = useState<Bus[]>(BUSES);
  const [incidents, setIncidents] = useState<IncidentCandidate[]>(INCIDENTS);
  const [observations, setObservations] = useState<Observation[]>(OBSERVATIONS);
  const [notifications, setNotifications] = useState<AppNotification[]>(NOTIFICATIONS);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const [layers, setLayers] = useState<LayerState>({
    defects: true,
    traffic: true,
    safety: true,
    incidents: true,
    buses: true,
    heatmap: false,
    roadCondition: true,
  });

  const toggleLayer = useCallback((k: keyof LayerState) => {
    setLayers((prev) => ({ ...prev, [k]: !prev[k] }));
  }, []);

  const setStatus = useCallback((id: string, status: IssueStatus) => {
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  }, []);

  const assignIssue = useCallback((id: string, to: string) => {
    setIssues((prev) =>
      prev.map((i) => (i.id === id ? { ...i, assignedTo: to, status: "assigned" } : i)),
    );
  }, []);

  const setIncidentStatus = useCallback((id: string, status: IncidentCandidate["status"]) => {
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  }, []);

  const pushNotification = useCallback((n: AppNotification) => {
    setNotifications((prev) => [n, ...prev]);
  }, []);

  const demoEvent = useCallback(
    (kind: DemoEvent) => {
      const stamp = Date.now().toString().slice(-4);
      if (kind === "bus_offline") {
        let target = "";
        setBuses((prev) => {
          const idx = prev.findIndex((b) => b.status === "active");
          if (idx < 0) return prev;
          const cur = prev[idx]!;
          target = cur.id;
          const next = [...prev];
          next[idx] = {
            ...cur,
            status: "offline",
            gps: "lost",
            camerasOnline: 0,
            bandwidth: "low",
            lastPacket: "just now",
            speedKph: 0,
          };
          return next;
        });
        pushNotification({
          id: `N-${stamp}`,
          title: `Bus ${target || "BUS-042"} offline`,
          detail: "Telemetry link lost — fleet coverage reduced",
          at: "just now",
          kind: "fleet",
          unread: true,
        });
        return target;
      }

      if (kind === "verification") {
        const candidate = issues.find((i) => i.status === "under_repair") ??
          issues.find((i) => i.status === "assigned");
        if (candidate) {
          setIssues((prev) =>
            prev.map((i) =>
              i.id === candidate.id
                ? {
                    ...i,
                    status: "verification_pending",
                    verification: {
                      confidence: 0.94,
                      passes: 2,
                      recommendation:
                        "Next observation strongly indicates the defect has been repaired.",
                    },
                  }
                : i,
            ),
          );
          pushNotification({
            id: `N-${stamp}`,
            title: "Verification candidate ready",
            detail: `${candidate.id} · 2 independent bus passes · 94%`,
            at: "just now",
            kind: "verification",
            unread: true,
          });
          return candidate.id;
        }
        return "";
      }

      const templates: Record<
        Exclude<DemoEvent, "bus_offline" | "verification">,
        Partial<Issue> & { title: string; category: IssueCategory }
      > = {
        pothole: {
          title: "Major Pothole",
          category: "pothole",
          severity: "major",
          priority: "P1",
          road: "Indiranagar 100 Ft Road",
          department: "PWD",
          position: { lat: 12.9784, lng: 77.638 },
          confidence: 0.89,
        },
        congestion: {
          title: "Congestion Corridor",
          category: "traffic",
          severity: "major",
          priority: "P2",
          road: "Sarjapur Road",
          department: "Traffic Police",
          position: { lat: 12.918, lng: 77.672 },
          confidence: 0.92,
        },
        waterlogging: {
          title: "Waterlogging Hotspot",
          category: "waterlogging",
          severity: "moderate",
          priority: "P2",
          road: "Magadi Road",
          department: "Sanitation",
          position: { lat: 12.978, lng: 77.545 },
          confidence: 0.83,
        },
        incident: {
          title: "Incident Candidate — Rash Driving",
          category: "incident",
          severity: "major",
          priority: "P1",
          road: "Bellary Road",
          department: "Traffic Police",
          position: { lat: 13.026, lng: 77.594 },
          confidence: 0.81,
        },
      };

      const t = templates[kind];
      const base = issues[0]!;
      const id = `P-${220 + issues.length}`;
      const newIssue: Issue = {
        ...base,
        ...t,
        id,
        status: "new",
        persistent: false,
        reviewRequired: true,
        observationCount: 3,
        busCount: 2,
        slaHoursRemaining: 24,
        firstObserved: "07 Sep 2026 · 10:46",
        lastObserved: "07 Sep 2026 · 10:46",
        lastObservedLabel: "just now",
        tags: ["New Observation"],
      };
      delete newIssue.assignedTo;
      delete newIssue.contractorId;
      delete newIssue.verification;

      setIssues((prev) => [newIssue, ...prev]);
      setObservations((prev) => [
        {
          id: `O-${stamp}`,
          issueId: id,
          busId: "BUS-042",
          at: "07 Sep · 10:46",
          confidence: t.confidence ?? 0.85,
          note: "New observation ingested",
        },
        ...prev,
      ]);
      pushNotification({
        id: `N-${stamp}`,
        title: `${t.title} detected`,
        detail: `${id} · ${t.road} · awaiting corroboration`,
        at: "just now",
        kind: kind === "incident" ? "review" : "hazard",
        unread: true,
      });
      return id;
    },
    [issues, pushNotification],
  );

  const value = useMemo<Store>(
    () => ({
      role,
      setRole,
      issues,
      buses,
      incidents,
      observations,
      notifications,
      selectedIssueId,
      selectIssue: setSelectedIssueId,
      selectedBusId,
      selectBus: setSelectedBusId,
      filters,
      setFilters,
      layers,
      toggleLayer,
      setStatus,
      assignIssue,
      setIncidentStatus,
      markAllRead,
      demoEvent,
    }),
    [
      role,
      issues,
      buses,
      incidents,
      observations,
      notifications,
      selectedIssueId,
      selectedBusId,
      filters,
      layers,
      toggleLayer,
      setStatus,
      assignIssue,
      setIncidentStatus,
      markAllRead,
      demoEvent,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside AppStoreProvider");
  return ctx;
}

export function useSelectedIssue() {
  const { issues, selectedIssueId } = useStore();
  return issues.find((i) => i.id === selectedIssueId) ?? null;
}

export function filterIssues(issues: Issue[], f: MapFilters) {
  return issues.filter((i) => {
    if (f.categories.length && !f.categories.includes(i.category)) return false;
    if (f.severity !== "all" && i.severity !== f.severity) return false;
    if (f.statuses.length && !f.statuses.includes(i.status)) return false;
    if (f.department !== "all" && i.department !== f.department) return false;
    return true;
  });
}
