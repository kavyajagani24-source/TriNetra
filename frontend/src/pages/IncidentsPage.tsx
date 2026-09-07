import { ScanEye } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/primitives";
import { EventTable } from "@/components/events/EventTable";
import { useEvents } from "@/hooks/useEvents";

export function IncidentsPage() {
  const { events, loading, error, refresh } = useEvents({ limit: 100 });

  return (
    <AppShell>
      <PageHeader
        title="Evidence Viewer & Incident Review"
        subtitle="Computer-vision inspection of anonymized evidence packages."
        actions={
          <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground md:inline-flex">
            <ScanEye className="h-3.5 w-3.5" aria-hidden />
            Detections rendered from stored inference output
          </span>
        }
      />

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
        {error ? (
          <p className="mb-3 rounded border border-warn/40 bg-warn-soft px-3 py-2 text-[11px] text-foreground">
            Backend event feed unavailable. Showing available event data.
          </p>
        ) : null}
        <EventTable
          events={events}
          loading={loading}
          onRefresh={refresh}
          title="Detected events"
          subtitle="Select an event to inspect its evidence frame, event label, confidence, and bounding box."
        />
      </div>
    </AppShell>
  );
}
