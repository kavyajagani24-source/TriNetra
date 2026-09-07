import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/primitives";
import { BusManagement } from "@/components/buses/BusManagement";

export function BusesPage() {
  return (
    <AppShell>
      <PageHeader
        title="Bus Registry & Mobile Sensing Fleet"
        subtitle="Manage transit vehicles, route assignments, and mobile camera sensor nodes."
      />
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
        <BusManagement />
      </div>
    </AppShell>
  );
}
