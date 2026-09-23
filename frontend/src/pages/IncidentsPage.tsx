import { useState } from "react";
import { ScanEye, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/primitives";
import { EventTable } from "@/components/events/EventTable";
import { useEvents } from "@/hooks/useEvents";
import { deleteEvents } from "@/services/api/events";
import { toast } from "sonner";

export function IncidentsPage() {
  const { events, loading, error, refresh } = useEvents({ limit: 100 });
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    if (!window.confirm("Are you sure you want to clear all detected events?")) return;
    try {
      setClearing(true);
      await deleteEvents();
      toast.success("All evidence events cleared successfully.");
      refresh();
    } catch {
      toast.error("Failed to clear events.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Evidence Viewer & Incident Review"
        subtitle="Computer-vision inspection of anonymized evidence packages."
        actions={
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground md:inline-flex">
              <ScanEye className="h-3.5 w-3.5" aria-hidden />
              Detections rendered from stored inference output
            </span>
            {events.length > 0 && (
              <button
                onClick={handleClear}
                disabled={clearing}
                className="inline-flex items-center gap-1.5 rounded border border-critical/40 bg-critical/10 px-2.5 py-1 text-[11px] font-medium text-critical hover:bg-critical/20 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{clearing ? "Clearing..." : "Clear All Events"}</span>
              </button>
            )}
          </div>
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
