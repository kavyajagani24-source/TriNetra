export type Role = "pwd" | "traffic" | "transport" | "executive";

export type Severity = "minor" | "moderate" | "major" | "critical";

export type Priority = "P1" | "P2" | "P3";

export type IssueStatus =
  | "new"
  | "confirming"
  | "confirmed"
  | "assigned"
  | "under_repair"
  | "verification_pending"
  | "candidate_verified"
  | "resolved"
  | "reopened"
  | "rejected";

export type IssueCategory =
  | "pothole"
  | "crack"
  | "missing_divider"
  | "zebra_crossing"
  | "traffic_sign"
  | "waterlogging"
  | "debris"
  | "traffic"
  | "safety"
  | "incident";

export type Department = "PWD" | "Traffic Police" | "Transport" | "Sanitation";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Detection {
  id: string;
  label: string;
  confidence: number;
  /** normalised 0-1 box: x, y, w, h */
  box: [number, number, number, number];
  /** normalised polygon points for segmentation overlay */
  polygon?: [number, number][];
  trackId?: string;
  note?: string;
  kind: "defect" | "vehicle" | "person" | "sign";
}

export interface EvidenceFrame {
  id: string;
  image: string;
  capturedAt: string;
  busId: string;
  detections: Detection[];
  privacyProcessed: boolean;
  hash: string;
}

export interface Observation {
  id: string;
  issueId: string;
  busId: string;
  at: string;
  confidence: number;
  note: string;
}

export interface Contractor {
  id: string;
  name: string;
  segmentId: string;
  dlpActive: boolean;
  dlpStart: string;
  dlpEnd: string;
}

export interface Issue {
  id: string;
  title: string;
  category: IssueCategory;
  severity: Severity;
  priority: Priority;
  status: IssueStatus;
  confidence: number;
  road: string;
  ward: string;
  segmentId: string;
  position: LatLng;
  heading: string;
  gpsUncertaintyM: number;
  model: string;
  firstObserved: string;
  lastObserved: string;
  lastObservedLabel: string;
  observationCount: number;
  busCount: number;
  department: Department;
  assignedTo?: string;
  slaHoursRemaining: number;
  persistent: boolean;
  reviewRequired: boolean;
  contractorId?: string;
  evidence: {
    before: EvidenceFrame;
    current: EvidenceFrame;
    verification?: EvidenceFrame;
  };
  verification?: {
    confidence: number;
    passes: number;
    recommendation: string;
  };
  tags: string[];
}

export interface Bus {
  id: string;
  route: string;
  operator: string;
  status: "active" | "idle" | "offline";
  gps: "connected" | "degraded" | "lost";
  camerasOnline: number;
  camerasTotal: number;
  lastEventLabel: string;
  bandwidth: "normal" | "reduced" | "low";
  speedKph: number;
  headingDeg: number;
  position: LatLng;
  accuracyM: number;
  lastPacket: string;
  recentObservations: { type: string; at: string; confidence: number }[];
}

export type RoadCondition = 0 | 1 | 2 | 3 | 4;

export interface RoadSegment {
  id: string;
  road: string;
  condition: RoadCondition;
  path: LatLng[];
  lengthKm: number;
}

export interface BusRoute {
  id: string;
  name: string;
  path: LatLng[];
  delayMin: number;
  coverage: number;
}

export interface Corridor {
  id: string;
  name: string;
  avgSpeed: number;
  currentSpeed: number;
  delayMin: number;
  trend: "up" | "down" | "flat";
  level: "low" | "moderate" | "high" | "severe";
}

export interface IncidentCandidate {
  id: string;
  type: string;
  confidence: number;
  at: string;
  location: string;
  position: LatLng;
  vehicleType: string;
  trackId: string;
  plateCandidate: string;
  plateConfidence: number;
  supportingFrames: number;
  status: "human_review" | "proposal_approved" | "rejected" | "flagged";
  evidence: EvidenceFrame;
}

export interface AppNotification {
  id: string;
  title: string;
  detail: string;
  at: string;
  kind: "routing" | "hazard" | "fleet" | "review" | "verification" | "dlp";
  unread: boolean;
}
