import { Link } from "@tanstack/react-router";
import { PersonStanding, Bike, School, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/primitives";
import { MapView } from "@/components/maps/MapView";
import { ConfidenceBar, StatusBadge } from "@/components/common/badges";
import { PrivacyPanel } from "@/components/workflow/pieces";
import { Button } from "@/components/ui/button";
import { useStore } from "@/state/app-store";

export function SafetyPage() {
  const { issues, incidents, layers, selectIssue } = useStore();
  const safetyIssues = issues.filter((i) => i.category === "safety" || i.category === "incident");

  return (
    <AppShell>
      <PageHeader
        title="Safety & Incident Intelligence"
        subtitle="Vulnerable road user risk and incident candidates — every item requires human review."
      />
      <div className="grid gap-2 border-b border-border p-2 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Pedestrian risk zones" value={5} icon={PersonStanding} tone="warn" />
        <KpiCard label="Cyclist risk zones" value={2} icon={Bike} tone="warn" />
        <KpiCard label="School-zone crossings" value={7} icon={School} tone="info" />
        <KpiCard
          label="Incident candidates"
          value={incidents.length}
          hint="Human review required"
          icon={ShieldAlert}
          tone="critical"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <div className="relative min-h-[340px] flex-1">
          <MapView
            issues={safetyIssues}
            layers={{ ...layers, defects: false, traffic: false }}
            onSelectIssue={selectIssue}
            className="h-full w-full"
          />
        </div>

        <div className="scroll-thin w-full shrink-0 space-y-2 overflow-y-auto border-l border-border bg-background p-2 xl:w-[440px]">
          <Panel title="Vulnerable road users" bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {issues
                .filter((i) => i.category === "safety")
                .map((i) => (
                  <li key={i.id} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12px] font-medium text-foreground">
                        {i.title} — {i.road}
                      </p>
                      <StatusBadge status={i.status} />
                    </div>
                    <ConfidenceBar value={i.confidence} className="mt-1.5" />
                    <p className="num mt-1 text-[11px] text-muted-foreground">
                      {i.busCount} buses · {i.observationCount} observations · {i.lastObservedLabel}
                    </p>
                  </li>
                ))}
            </ul>
          </Panel>

          <Panel
            title="Incident candidates"
            description="AI proposes; a human officer decides."
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-border">
              {incidents.map((inc) => (
                <li key={inc.id} className="space-y-1.5 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[12px] font-medium text-foreground">
                      {inc.type} · {inc.id}
                    </p>
                    <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[oklch(0.5_0.12_75)]">
                      Human review required
                    </span>
                  </div>
                  <p className="num text-[11px] text-muted-foreground">
                    {inc.location} · {inc.at} · track {inc.trackId} · {inc.supportingFrames} frames
                  </p>
                  <ConfidenceBar value={inc.confidence} />
                  <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
                    <Link to="/incidents">Open evidence viewer</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Privacy processing">
            <PrivacyPanel />
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
