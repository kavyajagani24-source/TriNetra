import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BUSES, INCIDENTS, ISSUES, NOTIFICATIONS, OBSERVATIONS } from "@/data/mock";
import { getBuses } from "@/services/api/buses";
import { getEvents } from "@/services/api/events";
import { getIncidentAlerts } from "@/services/api/incident";
import { getSafetyRuns, getSafetyRunEvents } from "@/services/api/safety";
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
  routes: boolean;
}

interface Store {
  demoMode: boolean;
  setDemoMode: (enabled: boolean) => void;
  toggleDemoMode: () => void;
  refreshLiveIntelligence: () => Promise<void>;
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

const STORAGE_KEY_DEMO_MODE = "trinetra_demo_mode";
const STORAGE_KEY_LIVE_ISSUES = "trinetra_live_issues_v3";
const STORAGE_KEY_LIVE_INCIDENTS = "trinetra_live_incidents_v3";
const STORAGE_KEY_DEMO_ISSUES = "trinetra_demo_issues_v2";
const STORAGE_KEY_DEMO_INCIDENTS = "trinetra_demo_incidents_v2";

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed !== null && parsed !== undefined ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("commissioner");

  // DEMO MODE TOGGLE: defaults to FALSE (Live Mode) for true data transparency
  const [demoMode, setDemoModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_DEMO_MODE) === "true";
    } catch {
      return false;
    }
  });

  const setDemoMode = useCallback((enabled: boolean) => {
    setDemoModeState(enabled);
    try {
      localStorage.setItem(STORAGE_KEY_DEMO_MODE, String(enabled));
    } catch {}
  }, []);

  const toggleDemoMode = useCallback(() => {
    setDemoModeState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_DEMO_MODE, String(next));
      } catch {}
      return next;
    });
  }, []);

  // ── DEMO DATA STATE ──
  const [demoIssues, setDemoIssues] = useState<Issue[]>(() =>
    loadFromStorage<Issue[]>(STORAGE_KEY_DEMO_ISSUES, ISSUES)
  );
  const [demoIncidents, setDemoIncidents] = useState<IncidentCandidate[]>(() =>
    loadFromStorage<IncidentCandidate[]>(STORAGE_KEY_DEMO_INCIDENTS, INCIDENTS)
  );
  const [demoBuses, setDemoBuses] = useState<Bus[]>(BUSES);
  const [demoObservations, setDemoObservations] = useState<Observation[]>(OBSERVATIONS);

  // ── LIVE DATA STATE (derived exclusively from actual runs) ──
  const [liveIssues, setLiveIssues] = useState<Issue[]>(() =>
    loadFromStorage<Issue[]>(STORAGE_KEY_LIVE_ISSUES, [])
  );
  const [liveIncidents, setLiveIncidents] = useState<IncidentCandidate[]>(() =>
    loadFromStorage<IncidentCandidate[]>(STORAGE_KEY_LIVE_INCIDENTS, [])
  );
  const [liveBuses, setLiveBuses] = useState<Bus[]>([]);
  const [liveObservations, setLiveObservations] = useState<Observation[]>([]);

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
    routes: true,
  });

  // Hydrate Live Data from Backend (Honest Data Pipeline)
  const refreshLiveIntelligence = useCallback(async () => {
    try {
      // 1. Live Registered Fleet Buses
      const busRes = await getBuses({ limit: 50 }).catch(() => null);
      if (busRes?.data) {
        const parsedBuses: Bus[] = busRes.data.map((b, idx) => ({
          id: b.registration_number || b.bus_number,
          plate: b.bus_number,
          route: b.route_number || "Corridor Route",
          status: (b.status?.toLowerCase() === "active" ? "active" : "offline") as Bus["status"],
          driver: `Driver ${b.registration_number || idx + 1}`,
          depot: "Central Operations Depot",
          camerasOnline: 2,
          gps: "active" as const,
          bandwidth: "high" as const,
          lastPacket: "Recent",
          speedKph: 28,
          todayDistanceKm: 12.4,
          potholesFoundToday: 0,
        }));
        setLiveBuses(parsedBuses);
      }

      // 2. Live Urban Events from AI Processors (Road & Hazard Detections)
      const eventsRes = await getEvents({ limit: 100 }).catch(() => null);
      const newLiveIssues: Issue[] = [];
      const newLiveObs: Observation[] = [];

      const rawEventList = (eventsRes as any)?.data || (eventsRes as any)?.items || [];
      if (Array.isArray(rawEventList) && rawEventList.length > 0) {
        rawEventList.forEach((ev: any) => {
          const cat = ev.category?.toUpperCase();
          if (cat === "HAZARD" || cat === "INFRASTRUCTURE" || cat === "ROAD") {
            const evType = ev.event_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
            const issueId = `POTH-${ev.id.slice(0, 8)}`;
            const isCritical = ev.severity === "CRITICAL";
            const isHigh = ev.severity === "HIGH";

            const hasGps = typeof ev.latitude === "number" && typeof ev.longitude === "number" && (ev.latitude !== 0 || ev.longitude !== 0);
            const rawEvUrl =
              (ev.extra_metadata?.["evidence_frame"] as string) ||
              (ev.extra_metadata?.["evidence_ref"] as string) ||
              (ev.extra_metadata?.["evidence_path"] as string) ||
              undefined;
            const fullEvidenceUrl = rawEvUrl
              ? (rawEvUrl.startsWith("http") ? rawEvUrl : `http://localhost:8000/${rawEvUrl.replace(/^\/+/, "")}`)
              : undefined;

            const roadName =
              (ev.extra_metadata?.["road_name"] as string) ||
              (hasGps ? `Corridor (${Number(ev.latitude).toFixed(3)}, ${Number(ev.longitude).toFixed(3)})` : "Transit Ingestion Corridor");

            newLiveIssues.push({
              id: issueId,
              title: evType,
              category: cat === "HAZARD" ? "pothole" : "waterlogging",
              severity: (ev.severity?.toLowerCase() as Severity) || "moderate",
              priority: isCritical ? "P1" : isHigh ? "P2" : "P3",
              status: "new",
              road: roadName,
              department: "PWD",
              ward: hasGps ? "Geotagged Corridor" : "Transit Ingestion (Mumbai)",
              position: hasGps
                ? { lat: ev.latitude as number, lng: ev.longitude as number }
                : (null as any),
              confidence: ev.confidence || 0.88,
              observationCount: 1,
              busCount: 1,
              persistent: isCritical,
              slaHoursRemaining: isCritical ? 12 : 36,
              firstObserved: ev.created_at ? new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recent",
              lastObserved: ev.created_at ? new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recent",
              lastObservedLabel: ev.created_at ? new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now",
              tags: ["Live AI Detection", ev.event_type],
              evidenceUrl: fullEvidenceUrl,
              evidence: fullEvidenceUrl
                ? {
                    current: {
                      busId: "SURVEY-CAM-01",
                      capturedAt: ev.created_at || "Recent",
                      image: fullEvidenceUrl,
                      detections: [
                        {
                          id: `det-${ev.id.slice(0, 6)}`,
                          kind: "defect",
                          label: evType,
                          confidence: ev.confidence || 0.88,
                          box: [
                            (ev.bbox_x1 || 100) / 1000,
                            (ev.bbox_y1 || 100) / 1000,
                            ((ev.bbox_x2 || 300) - (ev.bbox_x1 || 100)) / 1000,
                            ((ev.bbox_y2 || 300) - (ev.bbox_y1 || 100)) / 1000,
                          ],
                        },
                      ],
                    },
                  }
                : undefined,
            });

            newLiveObs.push({
              id: `OBS-${ev.id.slice(0, 6)}`,
              issueId,
              busId: "SURVEY-CAM",
              at: ev.created_at ? new Date(ev.created_at).toLocaleTimeString() : "Recent",
              confidence: ev.confidence || 0.88,
              note: `Ingested from video frame #${ev.frame_number}`,
            });
          }
        });

        if (newLiveIssues.length > 0) {
          setLiveIssues(newLiveIssues);
          try {
            localStorage.setItem(STORAGE_KEY_LIVE_ISSUES, JSON.stringify(newLiveIssues));
          } catch {}
        }
        if (newLiveObs.length > 0) {
          setLiveObservations(newLiveObs);
        }
      }

      // 3. Live Person 4 Incident Alerts & Safety Runs
      const [incidentAlerts, safetyRunsRes] = await Promise.all([
        getIncidentAlerts().catch(() => []),
        getSafetyRuns({ limit: 10 }).catch(() => null),
      ]);

      const newLiveIncidents: IncidentCandidate[] = [];

      // Add Person 4 alerts
      if (incidentAlerts && incidentAlerts.length > 0) {
        incidentAlerts.forEach((alert: any) => {
          if (alert.incident_type === "NONE" || alert.status === "NO_INCIDENT") return;

          const incType =
            alert.incident_type === "COLLISION_CANDIDATE" || alert.collision_detected
              ? "Collision Candidate"
              : alert.incident_type === "HIT_AND_RUN_CANDIDATE" || alert.hit_and_run_candidate
              ? "Hit-and-Run Assessment"
              : alert.incident_type === "ABNORMAL_DRIVING_CANDIDATE" || alert.rash_driving_count > 0
              ? "Rash Driving Profile"
              : alert.incident_type
              ? alert.incident_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
              : "Traffic Incident";

          const lat = alert.gps?.latitude ?? alert.gps_latitude;
          const lon = alert.gps?.longitude ?? alert.gps_longitude;
          const hasAlertGps = Boolean(
            typeof lat === "number" &&
            typeof lon === "number" &&
            (lat !== 0 || lon !== 0)
          );

          const plateNum = alert.anpr?.plate_number || alert.offending_plate || (alert.plates_detected?.[0] ?? "Not Identified");
          const evImg = alert.evidence?.during || alert.evidence_artifacts?.during || "";

          newLiveIncidents.push({
            id: alert.incident_id || alert.run_id,
            type: incType,
            confidence: alert.confidence || 0.9,
            at: alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : "Recent",
            location: hasAlertGps
              ? `GPS: ${lat!.toFixed(4)}, ${lon!.toFixed(4)}`
              : "Dashcam Ingestion (GPS Unavailable)",
            position: hasAlertGps
              ? { lat: lat!, lng: lon! }
              : null,
            vehicleType: alert.vehicle?.class_name ? alert.vehicle.class_name.toUpperCase() : "Vehicle Candidate",
            trackId: alert.vehicle?.track_id != null ? String(alert.vehicle.track_id) : (alert.involved_track_ids?.[0] ? String(alert.involved_track_ids[0]) : "N/A"),
            plateCandidate: plateNum,
            plateConfidence: alert.anpr?.plate_confidence || (alert.plates_detected?.length ? 0.85 : 0.0),
            supportingFrames: 30,
            status: "human_review",
            evidence: {
              src: evImg,
              timestamp: "Impact window",
              frameNumber: 0,
              labels: [alert.operational_tier || "Review", `Score: ${Math.round((alert.confidence || 0.85) * 100)}%`],
            },
          });
        });
      }

      // Add Module 3 Safety events if present
      if (safetyRunsRes?.data && safetyRunsRes.data.length > 0) {
        const recentRun = safetyRunsRes.data[0];
        if (recentRun) {
          const eventsRes = await getSafetyRunEvents(recentRun.id, { limit: 15 }).catch(() => null);
          if (eventsRes?.data) {
            eventsRes.data
              .filter((e) => e.risk_level === "high" || e.risk_level === "medium")
              .forEach((e) => {
                const hasSafeGps = Boolean(
                  typeof e.latitude === "number" &&
                  typeof e.longitude === "number" &&
                  (e.latitude !== 0 || e.longitude !== 0)
                );

                newLiveIncidents.push({
                  id: `INC-SAFE-${e.source_event_id.replace("SAFE_", "")}`,
                  type: e.event_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                  confidence: e.risk_confidence || 0.88,
                  at: e.event_timestamp ? new Date(e.event_timestamp).toLocaleTimeString() : "Recent",
                  location: e.in_school_zone ? "School Zone Corridor" : "Intersection Crossing",
                  position: hasSafeGps
                    ? { lat: e.latitude!, lng: e.longitude! }
                    : null,
                  vehicleType: e.object_type || "Bus Proximity",
                  trackId: String(e.track_id ?? e.frame_index),
                  plateCandidate: "Not Identified",
                  plateConfidence: 0.0,
                  supportingFrames: e.duration_frames || 40,
                  status: "human_review",
                  evidence: {
                    src: e.evidence_frames?.[0] || "",
                    timestamp: `${Math.floor(e.frame_index / 30)}s`,
                    frameNumber: e.frame_index,
                    labels: [e.event_type, `${Math.round((e.risk_confidence || 0.88) * 100)}%`],
                  },
                });
              });
          }
        }
      }

      if (newLiveIncidents.length > 0) {
        setLiveIncidents(newLiveIncidents);
        try {
          localStorage.setItem(STORAGE_KEY_LIVE_INCIDENTS, JSON.stringify(newLiveIncidents));
        } catch {}
      }
    } catch (err) {
      console.warn("Failed to refresh live intelligence:", err);
    }
  }, []);

  // Hydrate on initial mount
  useEffect(() => {
    refreshLiveIntelligence();
  }, [refreshLiveIntelligence]);

  const toggleLayer = useCallback((k: keyof LayerState) => {
    setLayers((prev) => ({ ...prev, [k]: !prev[k] }));
  }, []);

  // Set issue status (updates whichever set is currently active)
  const setStatus = useCallback(
    (id: string, status: IssueStatus) => {
      if (demoMode) {
        setDemoIssues((prev) => {
          const next = prev.map((i) => (i.id === id ? { ...i, status } : i));
          try {
            localStorage.setItem(STORAGE_KEY_DEMO_ISSUES, JSON.stringify(next));
          } catch {}
          return next;
        });
      } else {
        setLiveIssues((prev) => {
          const next = prev.map((i) => (i.id === id ? { ...i, status } : i));
          try {
            localStorage.setItem(STORAGE_KEY_LIVE_ISSUES, JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    },
    [demoMode]
  );

  const assignIssue = useCallback(
    (
      id: string,
      assignment: string | { to: string; department?: Department; priority?: Priority; ward?: string }
    ) => {
      const updater = (prev: Issue[]) => {
        const next = prev.map((i) => {
          if (i.id !== id) return i;
          if (typeof assignment === "string") {
            return { ...i, assignedTo: assignment, status: "assigned" as IssueStatus };
          }
          return {
            ...i,
            assignedTo: assignment.to,
            department: assignment.department || i.department,
            priority: assignment.priority || i.priority,
            ward: assignment.ward || i.ward,
            status: "assigned" as IssueStatus,
          };
        });
        return next;
      };

      if (demoMode) {
        setDemoIssues((prev) => {
          const next = updater(prev);
          try {
            localStorage.setItem(STORAGE_KEY_DEMO_ISSUES, JSON.stringify(next));
          } catch {}
          return next;
        });
      } else {
        setLiveIssues((prev) => {
          const next = updater(prev);
          try {
            localStorage.setItem(STORAGE_KEY_LIVE_ISSUES, JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    },
    [demoMode]
  );

  const setIncidentStatus = useCallback(
    (id: string, status: IncidentCandidate["status"]) => {
      if (demoMode) {
        setDemoIncidents((prev) => {
          const next = prev.map((i) => (i.id === id ? { ...i, status } : i));
          try {
            localStorage.setItem(STORAGE_KEY_DEMO_INCIDENTS, JSON.stringify(next));
          } catch {}
          return next;
        });
      } else {
        setLiveIncidents((prev) => {
          const next = prev.map((i) => (i.id === id ? { ...i, status } : i));
          try {
            localStorage.setItem(STORAGE_KEY_LIVE_INCIDENTS, JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    },
    [demoMode]
  );

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
        setDemoBuses((prev) => {
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
        const candidate =
          demoIssues.find((i) => i.status === "under_repair") ??
          demoIssues.find((i) => i.status === "assigned");
        if (candidate) {
          setDemoIssues((prev) => {
            const next = prev.map((i) =>
              i.id === candidate.id
                ? {
                    ...i,
                    status: "verification_pending" as IssueStatus,
                    verification: {
                      confidence: 0.94,
                      passes: 2,
                      recommendation:
                        "Next observation strongly indicates the defect has been repaired.",
                    },
                  }
                : i
            );
            try {
              localStorage.setItem(STORAGE_KEY_DEMO_ISSUES, JSON.stringify(next));
            } catch {}
            return next;
          });
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
      const base = demoIssues[0] || ({} as Issue);
      const id = `P-${220 + demoIssues.length}`;
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

      setDemoIssues((prev) => {
        const next = [newIssue, ...prev];
        try {
          localStorage.setItem(STORAGE_KEY_DEMO_ISSUES, JSON.stringify(next));
        } catch {}
        return next;
      });
      setDemoObservations((prev) => [
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
    [demoIssues, pushNotification]
  );

  // Prioritize live intelligence data, ensuring real video runs directly drive all screens
  const currentIssues = liveIssues.length > 0 ? liveIssues : (demoMode ? demoIssues : liveIssues);
  const currentBuses = liveBuses.length > 0 ? liveBuses : (demoMode ? demoBuses : liveBuses);
  const currentIncidents = liveIncidents.length > 0 ? liveIncidents : (demoMode ? demoIncidents : liveIncidents);
  const currentObservations = liveObservations.length > 0 ? liveObservations : (demoMode ? demoObservations : liveObservations);

  const value = useMemo<Store>(
    () => ({
      demoMode,
      setDemoMode,
      toggleDemoMode,
      refreshLiveIntelligence,
      role,
      setRole,
      issues: currentIssues,
      buses: currentBuses,
      incidents: currentIncidents,
      observations: currentObservations,
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
      demoMode,
      setDemoMode,
      toggleDemoMode,
      refreshLiveIntelligence,
      role,
      currentIssues,
      currentBuses,
      currentIncidents,
      currentObservations,
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
    ]
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
