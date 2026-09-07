import { useState } from "react";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, MetaRow, PageHeader, Panel } from "@/components/common/primitives";
import { BeforeAfterSlider } from "@/components/evidence/EvidenceViewer";
import { ConfidenceBar, StatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/state/app-store";

const STAGES = [
  "Repair completed",
  "Waiting for re-observation",
  "Candidate verified",
  "Human sign-off",
];

export function VerificationPage() {
  const { issues, setStatus } = useStore();
  const candidates = issues.filter(
    (i) =>
      i.status === "under_repair" ||
      i.status === "verification_pending" ||
      i.status === "candidate_verified" ||
      Boolean(i.verification),
  );
  const [activeId, setActiveId] = useState(candidates[0]?.id ?? "");
  const active = candidates.find((i) => i.id === activeId) ?? candidates[0];

  return (
    <AppShell>
      <PageHeader
        title="Verification Center"
        subtitle="Use subsequent bus observations to verify whether reported issues remain resolved."
      />

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
        {!active ? (
          <EmptyState
            icon={ShieldCheck}
            title="No verification candidates"
            description="Once a repair is marked complete, the next bus passes are matched automatically."
          />
        ) : (
          <div className="grid gap-2 xl:grid-cols-[320px_minmax(0,1fr)]">
            <Panel title="Verification queue" bodyClassName="p-0">
              <ul className="divide-y divide-border">
                {candidates.map((i) => (
                  <li key={i.id}>
                    <button
                      onClick={() => setActiveId(i.id)}
                      className={cn(
                        "w-full px-3 py-2 text-left hover:bg-secondary/60",
                        i.id === active.id && "bg-info-soft/70",
                      )}
                    >
                      <span className="block truncate text-[12px] font-medium text-foreground">
                        {i.title} · {i.id}
                      </span>
                      <span className="num block truncate text-[11px] text-muted-foreground">
                        {i.road} · {i.busCount} buses
                      </span>
                      <span className="mt-1 inline-block">
                        <StatusBadge status={i.status} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>

            <div className="space-y-2">
              <Panel title={`Verification — ${active.id}`} description={active.road}>
                <ol className="mb-3 flex flex-wrap items-center gap-1.5">
                  {STAGES.map((s, i) => {
                    const reached =
                      i === 0 ||
                      (i === 1 && active.status !== "under_repair") ||
                      (i === 2 && Boolean(active.verification)) ||
                      (i === 3 && active.status === "resolved");
                    return (
                      <li key={s} className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded px-2 py-1 text-[11px] font-medium",
                            reached ? "bg-ok-soft text-ok" : "bg-secondary text-muted-foreground",
                          )}
                        >
                          {s}
                        </span>
                        {i < STAGES.length - 1 ? (
                          <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden />
                        ) : null}
                      </li>
                    );
                  })}
                </ol>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
                  {active.evidence.verification ? (
                    <BeforeAfterSlider
                      before={active.evidence.before}
                      after={active.evidence.verification}
                    />
                  ) : (
                    <p className="rounded border border-dashed border-border px-3 py-10 text-center text-[12px] text-muted-foreground">
                      Waiting for a subsequent bus pass over segment {active.segmentId}.
                    </p>
                  )}

                  <div className="space-y-2">
                    {active.verification ? (
                      <>
                        <div>
                          <p className="label-xs">Verification confidence</p>
                          <ConfidenceBar value={active.verification.confidence} />
                        </div>
                        <p className="text-[12px] text-foreground">
                          Evidence: {active.verification.passes} independent bus passes
                        </p>
                        <p className="rounded border border-border bg-secondary/50 px-2 py-1.5 text-[11px] text-foreground">
                          {active.verification.recommendation}
                        </p>
                      </>
                    ) : (
                      <p className="text-[12px] text-muted-foreground">
                        No automated verification proposal yet.
                      </p>
                    )}
                    <dl>
                      <MetaRow label="Segment" value={active.segmentId} />
                      <MetaRow label="Department" value={active.assignedTo ?? active.department} />
                      <MetaRow label="Observations" value={active.observationCount} />
                      <MetaRow label="Last observed" value={active.lastObservedLabel} />
                    </dl>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 flex-1 text-[11px]"
                        onClick={() => {
                          setStatus(active.id, "resolved");
                          toast.success(`${active.id} closed after human sign-off`);
                        }}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                        Approve Closure
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 flex-1 text-[11px]"
                        onClick={() => {
                          setStatus(active.id, "reopened");
                          toast(`${active.id} kept open`);
                        }}
                      >
                        Keep Open
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      The platform proposes verification. A human officer closes the official task.
                    </p>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
