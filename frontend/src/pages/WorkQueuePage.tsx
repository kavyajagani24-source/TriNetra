import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Inbox } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, PageHeader } from "@/components/common/primitives";
import { PriorityBadge, SlaBadge, StatusBadge } from "@/components/common/badges";
import { IssueDetailsPanel } from "@/components/issues/IssueDetailsPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/state/app-store";

const FILTERS = ["All", "P1", "P2", "P3", "Review Required", "Assigned", "Verification"] as const;

export function WorkQueuePage() {
  const { issues, selectedIssueId, selectIssue, setStatus } = useStore();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const navigate = useNavigate();

  const rows = issues.filter((i) => {
    if (i.status === "resolved") return false;
    if (filter === "All") return true;
    if (filter === "Review Required") return i.reviewRequired;
    if (filter === "Assigned") return Boolean(i.assignedTo);
    if (filter === "Verification")
      return i.status === "verification_pending" || i.status === "candidate_verified";
    return i.priority === filter;
  });

  const selected = issues.find((i) => i.id === selectedIssueId) ?? null;

  return (
    <AppShell>
      <PageHeader
        title="Priority Work Queue"
        subtitle={`${rows.length} priority issues require action`}
        actions={
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded border px-2 py-1 text-[11px] font-medium transition-colors",
                  filter === f
                    ? "border-primary/50 bg-info-soft text-primary"
                    : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="scroll-thin min-w-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No open items in this view"
              description="All high-priority observations have been routed to the responsible department."
            />
          ) : (
            <table className="w-full min-w-[1040px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-secondary/80 backdrop-blur">
                <tr className="label-xs">
                  {[
                    "Priority",
                    "Issue",
                    "Location",
                    "Department",
                    "Confidence",
                    "Observed by",
                    "DLP",
                    "Status",
                    "SLA",
                    "Action",
                  ].map((h) => (
                    <th key={h} className="border-b border-border px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr
                    key={i.id}
                    className={cn(
                      "border-b border-border text-[12px] hover:bg-secondary/50",
                      i.id === selectedIssueId && "bg-info-soft/70",
                    )}
                  >
                    <td className="px-3 py-2">
                      <PriorityBadge priority={i.priority} />
                    </td>
                    <td className="px-3 py-2">
                      <span className="block font-medium text-foreground">{i.title}</span>
                      <span className="num block text-[11px] text-muted-foreground">{i.id}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{i.road}</td>
                    <td className="px-3 py-2 text-muted-foreground">{i.assignedTo ?? i.department}</td>
                    <td className="num px-3 py-2 font-medium">{Math.round(i.confidence * 100)}%</td>
                    <td className="num px-3 py-2 text-muted-foreground">{i.busCount} buses</td>
                    <td className="px-3 py-2">
                      {i.contractorId ? (
                        <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[oklch(0.5_0.12_75)]">
                          Active DLP
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={i.status} />
                    </td>
                    <td className="px-3 py-2">
                      <SlaBadge hours={i.slaHoursRemaining} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => selectIssue(i.id)}
                        >
                          Review
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => {
                            setStatus(i.id, "assigned");
                            toast.success(`${i.id} routed to ${i.department}`);
                          }}
                        >
                          Assign
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => {
                            selectIssue(i.id);
                            navigate({ to: "/incidents" });
                          }}
                        >
                          Evidence
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-ok" aria-hidden />
            Items are auto-routed above 85% confidence with multi-bus corroboration; everything else
            waits for human review.
          </div>
        </div>

        {selected ? (
          <IssueDetailsPanel
            issue={selected}
            onClose={() => selectIssue(null)}
            className="hidden w-[400px] shrink-0 xl:flex"
          />
        ) : null}
      </div>
    </AppShell>
  );
}
