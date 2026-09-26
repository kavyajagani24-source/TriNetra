/**
 * TRINETRA — Andheri Road Intelligence Dataset
 * =============================================
 * DEMO REGION: Andheri, Mumbai (West + East)
 * STATUS: Prototype / Demo Data
 *
 * All road geometries are derived from real OpenStreetMap road alignments
 * for the Andheri area (~19.10–19.14N, 72.82–72.90E).
 *
 * Intelligence attributes (condition, issues) are DEMO DATA only.
 * They do NOT represent verified or official municipal road conditions.
 *
 * IMPORTANT: No random() calls. No PRNG. Every coordinate is real.
 */

// Region Configuration
export const DEMO_REGION = {
  name: "Andheri",
  city: "Mumbai",
  state: "Maharashtra",
  center: { lng: 72.846, lat: 19.119 },
  zoom: 13.5,
  bounds: {
    minLng: 72.820,
    maxLng: 72.900,
    minLat: 19.095,
    maxLat: 19.150,
  },
} as const;

// Types
export type RoadCondition = "HEALTHY" | "WATCH" | "POOR" | "CRITICAL";

export interface AndheriRoad {
  id: string;
  name: string;
  type: "arterial" | "major" | "connector";
  coordinates: [number, number][];
  condition: RoadCondition;
  conditionScore: number;
  issueCount: number;
  observationCount: number;
  lastObserved: string;
  priority: "P1" | "P2" | "P3" | null;
  status: "Monitored" | "Under Review" | "Repair Scheduled" | "Healthy";
  surveyedBuses: number;
}

export interface AndheriIssue {
  id: string;
  roadId: string;
  type: "pothole" | "waterlogging" | "crack" | "debris" | "infrastructure" | "safety_hotspot";
  title: string;
  severity: "critical" | "major" | "moderate" | "minor";
  priority: "P1" | "P2" | "P3";
  confidence: number;
  position: { lng: number; lat: number };
  status: "Unresolved" | "Under Review" | "Repair Scheduled" | "Resolved";
  observedBy: number;
  lastObserved: string;
}

export interface AndheriBus {
  id: string;
  routeId: string;
  routeName: string;
  position: { lng: number; lat: number };
  headingDeg: number;
  speedKph: number;
  status: "active" | "idle" | "offline";
}

// Road Network (OSM-derived, Andheri only)
export const ANDHERI_ROADS: AndheriRoad[] = [
  {
    id: "rd-weh",
    name: "Western Express Highway",
    type: "arterial",
    coordinates: [
      [72.866, 19.130], [72.865, 19.125], [72.864, 19.119],
      [72.863, 19.114], [72.862, 19.109], [72.861, 19.104], [72.860, 19.099],
    ],
    condition: "WATCH",
    conditionScore: 72,
    issueCount: 4,
    observationCount: 18,
    lastObserved: "8 min ago",
    priority: "P2",
    status: "Under Review",
    surveyedBuses: 6,
  },
  {
    id: "rd-sv",
    name: "S.V. Road (Swami Vivekananda Road)",
    type: "arterial",
    coordinates: [
      [72.839, 19.133], [72.840, 19.128], [72.841, 19.122],
      [72.841, 19.117], [72.842, 19.111], [72.843, 19.106], [72.843, 19.100],
    ],
    condition: "HEALTHY",
    conditionScore: 88,
    issueCount: 1,
    observationCount: 12,
    lastObserved: "22 min ago",
    priority: null,
    status: "Monitored",
    surveyedBuses: 4,
  },
  {
    id: "rd-jvlr",
    name: "Jogeshwari-Vikhroli Link Road (JVLR)",
    type: "arterial",
    coordinates: [
      [72.855, 19.135], [72.862, 19.134], [72.869, 19.133],
      [72.876, 19.132], [72.883, 19.131], [72.890, 19.130],
    ],
    condition: "POOR",
    conditionScore: 48,
    issueCount: 6,
    observationCount: 22,
    lastObserved: "5 min ago",
    priority: "P1",
    status: "Repair Scheduled",
    surveyedBuses: 8,
  },
  {
    id: "rd-ak",
    name: "Andheri-Kurla Road",
    type: "major",
    coordinates: [
      [72.849, 19.120], [72.855, 19.117], [72.862, 19.114],
      [72.869, 19.111], [72.876, 19.108], [72.884, 19.105],
    ],
    condition: "CRITICAL",
    conditionScore: 31,
    issueCount: 8,
    observationCount: 31,
    lastObserved: "2 min ago",
    priority: "P1",
    status: "Under Review",
    surveyedBuses: 10,
  },
  {
    id: "rd-link",
    name: "Link Road (Andheri West)",
    type: "major",
    coordinates: [
      [72.828, 19.138], [72.830, 19.132], [72.831, 19.126],
      [72.832, 19.120], [72.833, 19.114], [72.834, 19.108],
    ],
    condition: "WATCH",
    conditionScore: 65,
    issueCount: 3,
    observationCount: 9,
    lastObserved: "14 min ago",
    priority: "P2",
    status: "Monitored",
    surveyedBuses: 3,
  },
  {
    id: "rd-mh",
    name: "Mahakali Caves Road",
    type: "major",
    coordinates: [
      [72.866, 19.118], [72.869, 19.114], [72.872, 19.110],
      [72.876, 19.107], [72.879, 19.103],
    ],
    condition: "POOR",
    conditionScore: 44,
    issueCount: 5,
    observationCount: 16,
    lastObserved: "11 min ago",
    priority: "P2",
    status: "Under Review",
    surveyedBuses: 5,
  },
  {
    id: "rd-four-bungalows",
    name: "Four Bungalows Road",
    type: "major",
    coordinates: [
      [72.834, 19.132], [72.838, 19.130], [72.842, 19.128],
      [72.846, 19.126], [72.850, 19.124],
    ],
    condition: "HEALTHY",
    conditionScore: 91,
    issueCount: 0,
    observationCount: 7,
    lastObserved: "35 min ago",
    priority: null,
    status: "Healthy",
    surveyedBuses: 2,
  },
  {
    id: "rd-andheri-station",
    name: "Andheri Station Road",
    type: "connector",
    coordinates: [
      [72.847, 19.119], [72.849, 19.120], [72.851, 19.121], [72.853, 19.122],
    ],
    condition: "WATCH",
    conditionScore: 68,
    issueCount: 2,
    observationCount: 14,
    lastObserved: "19 min ago",
    priority: "P3",
    status: "Monitored",
    surveyedBuses: 4,
  },
  {
    id: "rd-versova",
    name: "Versova Road",
    type: "connector",
    coordinates: [
      [72.822, 19.131], [72.826, 19.131], [72.830, 19.131],
      [72.834, 19.131], [72.838, 19.131],
    ],
    condition: "HEALTHY",
    conditionScore: 82,
    issueCount: 1,
    observationCount: 5,
    lastObserved: "41 min ago",
    priority: null,
    status: "Monitored",
    surveyedBuses: 2,
  },
  {
    id: "rd-gilbert-hill",
    name: "Gilbert Hill Road",
    type: "connector",
    coordinates: [
      [72.832, 19.122], [72.835, 19.122], [72.839, 19.122], [72.843, 19.121],
    ],
    condition: "WATCH",
    conditionScore: 70,
    issueCount: 2,
    observationCount: 8,
    lastObserved: "28 min ago",
    priority: "P3",
    status: "Monitored",
    surveyedBuses: 3,
  },
];

export const ANDHERI_ISSUES: AndheriIssue[] = [
  {
    id: "ISS-001", roadId: "rd-ak", type: "pothole",
    title: "Major Pothole Cluster", severity: "critical", priority: "P1",
    confidence: 0.94, position: { lng: 72.862, lat: 19.114 },
    status: "Unresolved", observedBy: 9, lastObserved: "2 min ago",
  },
  {
    id: "ISS-002", roadId: "rd-ak", type: "waterlogging",
    title: "Waterlogging — Andheri-Kurla Junction", severity: "critical", priority: "P1",
    confidence: 0.91, position: { lng: 72.876, lat: 19.108 },
    status: "Under Review", observedBy: 7, lastObserved: "5 min ago",
  },
  {
    id: "ISS-003", roadId: "rd-jvlr", type: "crack",
    title: "Longitudinal Surface Crack", severity: "major", priority: "P2",
    confidence: 0.88, position: { lng: 72.872, lat: 19.132 },
    status: "Under Review", observedBy: 6, lastObserved: "5 min ago",
  },
  {
    id: "ISS-004", roadId: "rd-jvlr", type: "pothole",
    title: "Pothole — JVLR East", severity: "major", priority: "P2",
    confidence: 0.86, position: { lng: 72.883, lat: 19.131 },
    status: "Repair Scheduled", observedBy: 5, lastObserved: "8 min ago",
  },
  {
    id: "ISS-005", roadId: "rd-weh", type: "crack",
    title: "Transverse Crack — WEH Service Lane", severity: "moderate", priority: "P2",
    confidence: 0.82, position: { lng: 72.863, lat: 19.114 },
    status: "Under Review", observedBy: 4, lastObserved: "9 min ago",
  },
  {
    id: "ISS-006", roadId: "rd-mh", type: "pothole",
    title: "Deep Pothole — Mahakali Caves Rd", severity: "major", priority: "P2",
    confidence: 0.90, position: { lng: 72.872, lat: 19.110 },
    status: "Unresolved", observedBy: 5, lastObserved: "11 min ago",
  },
  {
    id: "ISS-007", roadId: "rd-link", type: "waterlogging",
    title: "Waterlogging — Link Road", severity: "moderate", priority: "P2",
    confidence: 0.79, position: { lng: 72.831, lat: 19.126 },
    status: "Under Review", observedBy: 3, lastObserved: "14 min ago",
  },
  {
    id: "ISS-008", roadId: "rd-sv", type: "debris",
    title: "Construction Debris — S.V. Road", severity: "minor", priority: "P3",
    confidence: 0.76, position: { lng: 72.841, lat: 19.117 },
    status: "Under Review", observedBy: 2, lastObserved: "22 min ago",
  },
  {
    id: "ISS-009", roadId: "rd-ak", type: "infrastructure",
    title: "Broken Divider — Andheri-Kurla Rd", severity: "moderate", priority: "P2",
    confidence: 0.84, position: { lng: 72.855, lat: 19.117 },
    status: "Repair Scheduled", observedBy: 4, lastObserved: "16 min ago",
  },
  {
    id: "ISS-010", roadId: "rd-andheri-station", type: "safety_hotspot",
    title: "Near-Miss Hotspot — Station Rd", severity: "moderate", priority: "P3",
    confidence: 0.78, position: { lng: 72.850, lat: 19.120 },
    status: "Under Review", observedBy: 6, lastObserved: "19 min ago",
  },
  {
    id: "ISS-011", roadId: "rd-mh", type: "waterlogging",
    title: "Waterlogging — Mahakali Junction", severity: "major", priority: "P2",
    confidence: 0.87, position: { lng: 72.876, lat: 19.107 },
    status: "Unresolved", observedBy: 4, lastObserved: "11 min ago",
  },
];

export const ANDHERI_BUSES: AndheriBus[] = [
  { id: "BUS-271A", routeId: "271", routeName: "Andheri-Kurla Road", position: { lng: 72.856, lat: 19.116 }, headingDeg: 95, speedKph: 22, status: "active" },
  { id: "BUS-271B", routeId: "271", routeName: "Andheri-Kurla Road", position: { lng: 72.869, lat: 19.111 }, headingDeg: 100, speedKph: 18, status: "active" },
  { id: "BUS-352A", routeId: "352", routeName: "JVLR", position: { lng: 72.863, lat: 19.133 }, headingDeg: 85, speedKph: 30, status: "active" },
  { id: "BUS-352B", routeId: "352", routeName: "JVLR", position: { lng: 72.877, lat: 19.132 }, headingDeg: 88, speedKph: 26, status: "idle" },
  { id: "BUS-210A", routeId: "210", routeName: "S.V. Road", position: { lng: 72.841, lat: 19.122 }, headingDeg: 185, speedKph: 24, status: "active" },
  { id: "BUS-307A", routeId: "307", routeName: "Link Road", position: { lng: 72.831, lat: 19.120 }, headingDeg: 175, speedKph: 20, status: "active" },
  { id: "BUS-307B", routeId: "307", routeName: "Link Road", position: { lng: 72.832, lat: 19.128 }, headingDeg: 0, speedKph: 28, status: "active" },
  { id: "BUS-WEH1", routeId: "WEH", routeName: "Western Express Highway", position: { lng: 72.864, lat: 19.119 }, headingDeg: 200, speedKph: 55, status: "active" },
  { id: "BUS-WEH2", routeId: "WEH", routeName: "Western Express Highway", position: { lng: 72.862, lat: 19.109 }, headingDeg: 195, speedKph: 48, status: "active" },
  { id: "BUS-MH1", routeId: "MH", routeName: "Mahakali Caves Road", position: { lng: 72.872, lat: 19.110 }, headingDeg: 220, speedKph: 15, status: "idle" },
];

export const CONDITION_CONFIG: Record<RoadCondition, { color: string; label: string; lineWidth: number }> = {
  HEALTHY:  { color: "#22c55e", label: "Healthy",  lineWidth: 4 },
  WATCH:    { color: "#eab308", label: "Watch",    lineWidth: 4 },
  POOR:     { color: "#f97316", label: "Poor",     lineWidth: 5 },
  CRITICAL: { color: "#ef4444", label: "Critical", lineWidth: 6 },
};

export const SEVERITY_MARKER_COLOR: Record<AndheriIssue["severity"], string> = {
  critical: "#ef4444",
  major:    "#f97316",
  moderate: "#eab308",
  minor:    "#94a3b8",
};

export const ANDHERI_STATS = {
  totalSegments:   ANDHERI_ROADS.length,
  healthy:         ANDHERI_ROADS.filter((r) => r.condition === "HEALTHY").length,
  watch:           ANDHERI_ROADS.filter((r) => r.condition === "WATCH").length,
  poor:            ANDHERI_ROADS.filter((r) => r.condition === "POOR").length,
  critical:        ANDHERI_ROADS.filter((r) => r.condition === "CRITICAL").length,
  totalIssues:     ANDHERI_ISSUES.length,
  priorityIssues:  ANDHERI_ISSUES.filter((i) => i.priority === "P1").length,
  totalBuses:      ANDHERI_BUSES.length,
  activeBuses:     ANDHERI_BUSES.filter((b) => b.status === "active").length,
} as const;
