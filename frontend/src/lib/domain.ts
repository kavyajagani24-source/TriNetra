import type { IssueCategory, IssueStatus, Priority, Severity } from "@/types";

export const SEVERITY_META: Record<Severity, { label: string; color: string; bg: string; text: string }> = {
  minor: { label: "Minor", color: "var(--ok)", bg: "bg-ok-soft", text: "text-ok" },
  moderate: { label: "Moderate", color: "var(--warn)", bg: "bg-warn-soft", text: "text-warn" },
  major: { label: "Major", color: "var(--major)", bg: "bg-major-soft", text: "text-major" },
  critical: { label: "Critical", color: "var(--critical)", bg: "bg-critical-soft", text: "text-critical" },
};

export const STATUS_META: Record<IssueStatus, { label: string; tone: "neutral" | "info" | "warn" | "ok" | "critical" }> = {
  new: { label: "New", tone: "info" },
  confirming: { label: "Confirming", tone: "info" },
  confirmed: { label: "Confirmed", tone: "warn" },
  assigned: { label: "Assigned", tone: "warn" },
  under_repair: { label: "Under Repair", tone: "warn" },
  verification_pending: { label: "Verification Pending", tone: "info" },
  candidate_verified: { label: "Candidate Verified", tone: "ok" },
  resolved: { label: "Resolved", tone: "ok" },
  reopened: { label: "Reopened", tone: "critical" },
  rejected: { label: "Rejected", tone: "neutral" },
};

export const STATUS_FLOW: IssueStatus[] = [
  "new",
  "confirming",
  "confirmed",
  "assigned",
  "under_repair",
  "verification_pending",
  "candidate_verified",
  "resolved",
];

export const CATEGORY_META: Record<IssueCategory, { label: string; color: string }> = {
  pothole: { label: "Pothole", color: "var(--major)" },
  crack: { label: "Crack", color: "var(--warn)" },
  missing_divider: { label: "Missing Divider", color: "var(--major)" },
  zebra_crossing: { label: "Zebra Crossing", color: "var(--warn)" },
  traffic_sign: { label: "Traffic Sign", color: "var(--info)" },
  waterlogging: { label: "Waterlogging", color: "var(--info)" },
  debris: { label: "Debris", color: "var(--warn)" },
  traffic: { label: "Traffic", color: "var(--info)" },
  safety: { label: "Safety", color: "var(--critical)" },
  incident: { label: "Incident", color: "var(--critical)" },
};

export const PRIORITY_META: Record<Priority, { label: string; hint: string }> = {
  P1: { label: "P1", hint: "Priority action — auto-routed" },
  P2: { label: "P2", hint: "Scheduled action" },
  P3: { label: "P3", hint: "Routine backlog" },
};

export const DEPARTMENTS = ["PWD", "Traffic Police", "Transport", "Sanitation"] as const;

export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}
