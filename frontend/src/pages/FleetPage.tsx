import { useState } from "react";
import { Camera, Radio, Satellite, Signal, ListFilter, Map as MapIcon } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { KpiCard, MetaRow, PageHeader, Panel } from "@/components/common/primitives";
import { MapView } from "@/components/maps/MapView";
import { BusManagement } from "@/components/buses/BusManagement";
import { BUS_ROUTES } from "@/data/geo";
import { cn } from "@/lib/utils";
import { useStore } from "@/state/app-store";

const CAMERAS = ["Front", "Rear", "Left", "Right", "Cabin"];

export function FleetPage() {
  const { buses, issues, layers, selectedBusId, selectBus } = useStore();
  const [activeTab, setActiveTab] = useState<"telemetry" | "registry">("telemetry");
  const selected = buses.find((b) => b.id === selectedBusId) ?? buses[0];

  return (
    <AppShell>
      <PageHeader
        title="Fleet Intelligence & Bus Sensing Registry"
        subtitle="Sensing coverage, telemetry health, camera availability, and onboard sensor bus management."
        actions={
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            <button
              onClick={() => setActiveTab("telemetry")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-medium transition-colors",
                activeTab === "telemetry"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MapIcon className="h-3.5 w-3.5" />
              Live Telemetry Map
            </button>
            <button
              onClick={() => setActiveTab("registry")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-medium transition-colors",
                activeTab === "registry"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ListFilter className="h-3.5 w-3.5" />
              Bus Registry & CRUD
            </button>
          </div>
        }
      />

      {activeTab === "registry" ? (
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
          <BusManagement />
        </div>
      ) : (
        <>
          <div className="grid gap-2 border-b border-border p-2 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Active buses" value={buses.filter((b) => b.status === "active").length + 236} icon={Radio} tone="ok" />
        <KpiCard label="Offline buses" value={buses.filter((b) => b.status === "offline").length + 16} icon={Signal} tone="critical" />
        <KpiCard label="Routes covered" value={BUS_ROUTES.length * 7} />
        <KpiCard label="GPS health" value="96%" icon={Satellite} tone="ok" />
        <KpiCard label="Camera health" value="93%" icon={Camera} tone="ok" />
        <KpiCard label="Fleet coverage" value="82%" tone="info" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <div className="relative min-h-[320px] flex-1">
          <MapView
            issues={issues}
            buses={buses}
            layers={{ ...layers, buses: true }}
            showRoutes
            selectedBusId={selected?.id ?? null}
            onSelectBus={(id) => selectBus(id)}
            className="h-full w-full"
          />
        </div>

        <div className="scroll-thin w-full shrink-0 space-y-2 overflow-y-auto border-l border-border bg-background p-2 xl:w-[460px]">
          <Panel title="Fleet units" description="Select a bus to inspect telemetry" bodyClassName="p-2">
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {buses.map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => selectBus(b.id)}
                    className={cn(
                      "w-full rounded border px-2 py-1.5 text-left transition-colors",
                      b.id === selected?.id
                        ? "border-primary/50 bg-info-soft"
                        : "border-border hover:bg-secondary/60",
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span className="num text-[12px] font-semibold text-foreground">{b.id}</span>
                      <span
                        className={cn(
                          "rounded px-1 text-[10px] font-semibold uppercase",
                          b.status === "active"
                            ? "bg-ok-soft text-ok"
                            : b.status === "idle"
                              ? "bg-warn-soft text-[oklch(0.5_0.12_75)]"
                              : "bg-critical-soft text-critical",
                        )}
                      >
                        {b.status}
                      </span>
                    </span>
                    <span className="num block text-[11px] text-muted-foreground">
                      Route {b.route} · GPS {b.gps} · {b.camerasOnline}/{b.camerasTotal} cameras
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {b.lastEventLabel}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          {selected ? (
            <Panel title={`${selected.id} · Route ${selected.route}`} description={selected.operator}>
              <div className="mb-2 grid grid-cols-5 gap-1">
                {CAMERAS.map((c, i) => (
                  <div
                    key={c}
                    className="relative aspect-video overflow-hidden rounded bg-map-deep"
                    aria-label={`${c} camera feed`}
                  >
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(120deg,rgba(255,255,255,0.05)_0_6px,transparent_6px_12px)]" />
                    <span className="absolute bottom-0.5 left-1 text-[8px] font-semibold uppercase text-map-foreground/80">
                      {c}
                    </span>
                    <span
                      className={cn(
                        "absolute right-1 top-1 h-1.5 w-1.5 rounded-full",
                        i < selected.camerasOnline ? "bg-ok" : "bg-critical",
                      )}
                    />
                  </div>
                ))}
              </div>
              <dl className="grid grid-cols-2 gap-x-3">
                <MetaRow label="Speed" value={`${selected.speedKph} km/h`} />
                <MetaRow label="Heading" value={`${selected.headingDeg}°`} />
                <MetaRow label="Latitude" value={selected.position.lat.toFixed(5)} />
                <MetaRow label="Longitude" value={selected.position.lng.toFixed(5)} />
                <MetaRow label="GPS accuracy" value={`${selected.accuracyM} m`} />
                <MetaRow label="Last packet" value={selected.lastPacket} />
                <MetaRow label="Connection" value={selected.bandwidth} />
                <MetaRow label="Cameras" value={`${selected.camerasOnline}/${selected.camerasTotal}`} />
              </dl>
              <p className="label-xs mt-2">Recent observations</p>
              <ul className="mt-1 divide-y divide-border rounded border border-border">
                {selected.recentObservations.map((o) => (
                  <li key={o.type} className="flex items-center justify-between px-2 py-1 text-[11px]">
                    <span className="text-foreground">{o.type}</span>
                    <span className="num text-muted-foreground">
                      {o.at} · {Math.round(o.confidence * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel title="Route coverage">
            <ul className="space-y-1.5">
              {BUS_ROUTES.map((r) => (
                <li key={r.id}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="truncate text-foreground">{r.name}</span>
                    <span className="num text-muted-foreground">{r.coverage}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${r.coverage}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
      </>
      )}
    </AppShell>
  );
}
