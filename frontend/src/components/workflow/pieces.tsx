import { ArrowDown, FileText, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TRIAGE, CONTRACTORS } from "@/data/mock";
import { STATUS_FLOW, STATUS_META } from "@/lib/domain";
import type { Issue, IssueStatus, Observation } from "@/types";

export function TriageFunnel({ className }: { className?: string }) {
  const steps = [
    { label: "Raw observations", value: TRIAGE.raw, hint: "Ingested from fleet cameras" },
    { label: "Deduplicated", value: TRIAGE.deduplicated, hint: "Spatial + temporal clustering" },
    { label: "Confirmed issues", value: TRIAGE.confirmed, hint: "Multi-bus corroboration" },
    { label: "Priority actions", value: TRIAGE.priority, hint: "Routed to departments" },
  ];
  return (
    <div className={cn("space-y-1.5", className)}>
      {steps.map((s, i) => (
        <div key={s.label}>
          <div className="flex items-center justify-between rounded border border-border bg-secondary/40 px-2.5 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-foreground">{s.label}</p>
              <p className="truncate text-[11px] text-muted-foreground">{s.hint}</p>
            </div>
            <p className="num text-[15px] font-semibold text-foreground">
              {s.value.toLocaleString("en-IN")}
            </p>
          </div>
          {i < steps.length - 1 ? (
            <div className="flex justify-center py-0.5">
              <ArrowDown className="h-3 w-3 text-muted-foreground" aria-hidden />
            </div>
          ) : null}
        </div>
      ))}
      <div className="rounded border border-border bg-info-soft px-2.5 py-1.5 text-[11px] text-foreground">
        <span className="font-semibold">Triage policy · </span>
        auto-process routine events, require human review at 60–85% confidence or high
        consequence, auto-route above 85% with multi-bus corroboration.
      </div>
    </div>
  );
}

export function StatusFlowStrip({ status }: { status: IssueStatus }) {
  const idx = STATUS_FLOW.indexOf(status);
  return (
    <ol className="flex flex-wrap items-center gap-1">
      {STATUS_FLOW.map((s, i) => (
        <li key={s} className="flex items-center gap-1">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium",
              i < idx
                ? "bg-ok-soft text-ok"
                : i === idx
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground",
            )}
          >
            {STATUS_META[s].label}
          </span>
          {i < STATUS_FLOW.length - 1 ? (
            <span className="text-[10px] text-muted-foreground">→</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function ObservationTimeline({
  observations,
  issue,
}: {
  observations: Observation[];
  issue: Issue;
}) {
  const rows = observations.filter((o) => o.issueId === issue.id);
  return (
    <div className="space-y-2">
      <div className="rounded border border-primary/25 bg-info-soft px-2.5 py-2">
        <p className="num text-[13px] font-semibold text-foreground">
          {issue.observationCount} observations consolidated into 1 persistent issue
        </p>
        <p className="text-[11px] text-muted-foreground">
          Corroborated by {issue.busCount} buses · duplicate observations removed
        </p>
      </div>
      <ol className="relative space-y-2 border-l border-border pl-3">
        {(rows.length
          ? rows
          : [
              {
                id: "x1",
                issueId: issue.id,
                busId: issue.evidence.before.busId,
                at: issue.firstObserved,
                confidence: issue.confidence - 0.03,
                note: "First observation",
              },
              {
                id: "x2",
                issueId: issue.id,
                busId: issue.evidence.current.busId,
                at: issue.lastObserved,
                confidence: issue.confidence,
                note: "Latest observation",
              },
            ]
        ).map((o) => (
          <li key={o.id} className="relative">
            <span className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full bg-primary" />
            <p className="num text-[11px] text-muted-foreground">{o.at}</p>
            <p className="text-[12px] font-medium text-foreground">
              {o.busId} · {o.note}
            </p>
            <p className="num text-[11px] text-muted-foreground">
              Confidence {Math.round(o.confidence * 100)}%
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function DlpCard({ issue }: { issue: Issue }) {
  const contractor = CONTRACTORS.find((c) => c.id === issue.contractorId);
  const [open, setOpen] = useState(false);
  if (!contractor) {
    return (
      <p className="text-[11px] text-muted-foreground">
        No contractor warranty (DLP) record linked to segment {issue.segmentId}.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Contractor</dt>
          <dd className="font-medium text-foreground">{contractor.name}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Road segment</dt>
          <dd className="num font-medium text-foreground">{contractor.segmentId}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">DLP window</dt>
          <dd className="num font-medium text-foreground">
            {contractor.dlpStart} → {contractor.dlpEnd}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Defect detected</dt>
          <dd className="num font-medium text-foreground">{issue.lastObserved}</dd>
        </div>
      </dl>
      <p
        className={cn(
          "rounded px-2 py-1 text-[11px] font-semibold",
          contractor.dlpActive ? "bg-warn-soft text-[oklch(0.5_0.12_75)]" : "bg-secondary text-muted-foreground",
        )}
      >
        {contractor.dlpActive
          ? "ACTIVE DLP · potential warranty-covered defect"
          : "DLP expired · municipal budget repair"}
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 text-[11px]">
            <FileText className="mr-1 h-3.5 w-3.5" aria-hidden />
            Generate Notice
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Draft DLP Notice — {issue.id}</DialogTitle>
            <DialogDescription className="text-[12px]">
              Draft only. Issued after departmental approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded border border-border bg-secondary/40 p-3 text-[12px] leading-5 text-foreground">
            <p>To: {contractor.name}</p>
            <p>
              Subject: Defect observed within Defect Liability Period on segment{" "}
              {contractor.segmentId} ({issue.road}).
            </p>
            <p>
              An automated observation package corroborated by {issue.busCount} public transport
              vehicles records a {issue.title.toLowerCase()} at {issue.position.lat.toFixed(4)},{" "}
              {issue.position.lng.toFixed(4)} on {issue.lastObserved}, with model confidence{" "}
              {Math.round(issue.confidence * 100)}%. Rectification is requested under the DLP terms
              valid until {contractor.dlpEnd}.
            </p>
            <p className="text-muted-foreground">
              Evidence package: anonymized frames, GPS trace, observation history.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>
              Send for approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PrivacyPanel({ compact = false }: { compact?: boolean }) {
  const rows = [
    "Face anonymization active",
    "Plate anonymization active",
    "Raw frames written to disk: 0",
    "Evidence transmitted: anonymized only",
    "Audit logging: active",
  ];
  return (
    <div className="space-y-1.5">
      {!compact ? (
        <p className="text-[11px] text-muted-foreground">
          Designed with privacy-by-design controls. Faces and registration plates are anonymized in
          retained and transmitted evidence according to configured policy.
        </p>
      ) : null}
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r} className="flex items-center gap-2 text-[12px] text-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-ok" aria-hidden />
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SecurityPanel() {
  const rows = [
    "TLS Transport",
    "Device Authentication",
    "RBAC",
    "Audit Logging",
    "Evidence Hashing",
    "Privacy Processor",
  ];
  return (
    <ul className="grid gap-1 sm:grid-cols-2">
      {rows.map((r) => (
        <li
          key={r}
          className="flex items-center justify-between rounded border border-border px-2 py-1.5 text-[12px]"
        >
          <span className="flex items-center gap-2 text-foreground">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            {r}
          </span>
          <span className="text-[11px] font-semibold text-ok">ACTIVE</span>
        </li>
      ))}
    </ul>
  );
}
