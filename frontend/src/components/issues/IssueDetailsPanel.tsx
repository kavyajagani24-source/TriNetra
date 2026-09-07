import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronDown,
  ClipboardCheck,
  MapPin,
  ScanEye,
  Send,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfidenceBar, PriorityBadge, SeverityBadge, SlaBadge, StatusBadge } from "@/components/common/badges";
import { MetaRow } from "@/components/common/primitives";
import { DetectionOverlay } from "@/components/evidence/DetectionOverlay";
import { BeforeAfterSlider } from "@/components/evidence/EvidenceViewer";
import { DlpCard, ObservationTimeline, StatusFlowStrip } from "@/components/workflow/pieces";
import { useStore } from "@/state/app-store";
import { DEPARTMENTS } from "@/lib/domain";
import type { Issue } from "@/types";

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-border">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-secondary/50"
      >
        <span className="label-xs">{title}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? <div className="px-3 pb-3">{children}</div> : null}
    </section>
  );
}

function AssignDialog({ issue }: { issue: Issue }) {
  const { assignIssue } = useStore();
  const [dept, setDept] = useState<string>(issue.department);
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 flex-1 text-[11px]">
          <Send className="mr-1 h-3.5 w-3.5" aria-hidden />
          Assign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Assign {issue.id}</DialogTitle>
        </DialogHeader>
        <label className="block text-[12px]">
          <span className="label-xs mb-1 block">Department / ward</span>
          <select
            className="w-full rounded border border-border bg-card px-2 py-1.5 text-[12px]"
            value={dept}
            onChange={(e) => setDept(e.target.value)}
          >
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
            <option>PWD Ward 4</option>
            <option>PWD Ward 15</option>
            <option>Traffic South</option>
            <option>Sanitation Zone 2</option>
          </select>
        </label>
        <DialogFooter>
          <Button
            size="sm"
            onClick={() => {
              assignIssue(issue.id, dept);
              setOpen(false);
              toast.success(`${issue.id} assigned to ${dept}`);
            }}
          >
            Confirm assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IssueDetailsPanel({
  issue,
  onClose,
  className,
}: {
  issue: Issue;
  onClose?: () => void;
  className?: string;
}) {
  const { observations, setStatus } = useStore();

  return (
    <aside
      className={cn(
        "scroll-thin flex w-full min-w-0 flex-col overflow-y-auto border-l border-border bg-card",
        className,
      )}
      aria-label={`Issue details for ${issue.id}`}
    >
      <header className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-card px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <TriangleAlert
            className="h-4 w-4 shrink-0"
            style={{ color: "var(--major)" }}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold uppercase tracking-wide text-foreground">
              {issue.title}
            </p>
            <p className="num truncate text-[11px] text-muted-foreground">
              {issue.id} · {issue.road}
            </p>
          </div>
        </div>
        {onClose ? (
          <button
            onClick={onClose}
            aria-label="Close issue details"
            className="grid h-6 w-6 shrink-0 place-items-center rounded hover:bg-secondary"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </header>

      <div className="p-3">
        <Tabs defaultValue="current">
          <TabsList className="h-7 w-full">
            <TabsTrigger value="before" className="flex-1 text-[11px]">
              Before
            </TabsTrigger>
            <TabsTrigger value="current" className="flex-1 text-[11px]">
              Current
            </TabsTrigger>
            <TabsTrigger value="verify" className="flex-1 text-[11px]">
              Verification
            </TabsTrigger>
          </TabsList>
          <TabsContent value="before" className="mt-2">
            <DetectionOverlay
              frame={issue.evidence.before}
              options={{ boxes: true, segmentation: true, trackIds: false, privacyMask: true }}
              className="aspect-[4/3]"
              compact
            />
          </TabsContent>
          <TabsContent value="current" className="mt-2">
            <DetectionOverlay
              frame={issue.evidence.current}
              options={{ boxes: true, segmentation: true, trackIds: false, privacyMask: true }}
              className="aspect-[4/3]"
              compact
            />
          </TabsContent>
          <TabsContent value="verify" className="mt-2">
            {issue.evidence.verification ? (
              <BeforeAfterSlider
                before={issue.evidence.before}
                after={issue.evidence.verification}
              />
            ) : (
              <p className="rounded border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">
                Waiting for re-observation from a subsequent bus pass.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3">
        <SeverityBadge severity={issue.severity} />
        <PriorityBadge priority={issue.priority} />
        <StatusBadge status={issue.status} />
        {issue.persistent ? (
          <span className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[11px] font-medium">
            Persistent Issue
          </span>
        ) : null}
        {issue.contractorId ? (
          <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[11px] font-semibold text-[oklch(0.5_0.12_75)]">
            Active DLP
          </span>
        ) : null}
      </div>

      <Section title="At a glance">
        <ConfidenceBar value={issue.confidence} className="mb-2" />
        <dl className="grid grid-cols-2 gap-x-3">
          <MetaRow label="Observed by" value={`${issue.busCount} buses`} />
          <MetaRow label="Observations" value={issue.observationCount} />
          <MetaRow label="Last observed" value={issue.lastObservedLabel} />
          <MetaRow label="Assigned" value={issue.assignedTo ?? "Unassigned"} />
          <MetaRow label="Department" value={issue.department} />
          <MetaRow label="SLA" value={<SlaBadge hours={issue.slaHoursRemaining} />} />
        </dl>
      </Section>

      <Section title="Location & capture" defaultOpen={false}>
        <dl>
          <MetaRow label="Location" value={issue.road} />
          <MetaRow
            label="Coordinates"
            value={`${issue.position.lat.toFixed(4)}, ${issue.position.lng.toFixed(4)}`}
          />
          <MetaRow label="Heading" value={issue.heading} />
          <MetaRow label="Detected" value={issue.lastObserved} />
          <MetaRow label="First observed" value={issue.firstObserved} />
          <MetaRow label="Road segment" value={issue.segmentId} />
          <MetaRow label="Model" value={issue.model} />
          <MetaRow label="GPS uncertainty" value={`${issue.gpsUncertaintyM} m`} />
        </dl>
      </Section>

      <Section title="Observation history">
        <ObservationTimeline observations={observations} issue={issue} />
      </Section>

      <Section title="Contractor warranty (DLP)" defaultOpen={false}>
        <DlpCard issue={issue} />
      </Section>

      <Section title="Lifecycle" defaultOpen={false}>
        <StatusFlowStrip status={issue.status} />
      </Section>

      <Section title="Tags" defaultOpen={false}>
        <div className="flex flex-wrap gap-1">
          {issue.tags.map((t) => (
            <span
              key={t}
              className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[11px]"
            >
              + {t}
            </span>
          ))}
        </div>
      </Section>

      <div className="sticky bottom-0 mt-auto space-y-1.5 border-t border-border bg-card p-3">
        <div className="flex gap-1.5">
          <Button asChild size="sm" className="h-7 flex-1 text-[11px]">
            <Link to="/incidents" search={{ issue: issue.id }}>
              <ScanEye className="mr-1 h-3.5 w-3.5" aria-hidden />
              View Evidence
            </Link>
          </Button>
          <AssignDialog issue={issue} />
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 flex-1 text-[11px]"
            onClick={() => {
              setStatus(issue.id, "under_repair");
              toast.success(`${issue.id} marked under repair`);
            }}
          >
            <ClipboardCheck className="mr-1 h-3.5 w-3.5" aria-hidden />
            Mark repair started
          </Button>
          <Button asChild size="sm" variant="outline" className="h-7 flex-1 text-[11px]">
            <Link to="/verification">
              <MapPin className="mr-1 h-3.5 w-3.5" aria-hidden />
              Verification
            </Link>
          </Button>
        </div>
      </div>
    </aside>
  );
}
