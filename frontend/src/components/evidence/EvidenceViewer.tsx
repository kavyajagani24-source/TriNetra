import { useRef, useState } from "react";
import { Boxes, Fingerprint, Scan, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { DetectionOverlay, type OverlayOptions } from "./DetectionOverlay";
import type { EvidenceFrame } from "@/types";

const CONTROLS: { key: keyof OverlayOptions; label: string; icon: typeof Boxes }[] = [
  { key: "boxes", label: "Bounding Boxes", icon: Boxes },
  { key: "segmentation", label: "Segmentation", icon: Scan },
  { key: "trackIds", label: "Tracking IDs", icon: Fingerprint },
  { key: "privacyMask", label: "Privacy Mask", icon: ShieldCheck },
];

export function EvidenceViewer({ frame, className }: { frame: EvidenceFrame; className?: string }) {
  const [options, setOptions] = useState<OverlayOptions>({
    boxes: true,
    segmentation: true,
    trackIds: false,
    privacyMask: true,
  });

  return (
    <div className={cn("grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]", className)}>
      <div className="panel overflow-hidden p-0">
        <DetectionOverlay frame={frame} options={options} className="aspect-[4/3]" lazy={false} />
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border p-2">
          {CONTROLS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              aria-pressed={options[key]}
              onClick={() => setOptions((o) => ({ ...o, [key]: !o[key] }))}
              className={cn(
                "inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium transition-colors",
                options[key]
                  ? "border-primary/40 bg-info-soft text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel flex min-w-0 flex-col">
        <div className="border-b border-border px-3 py-2">
          <p className="label-xs">Detections</p>
          <p className="num text-[12px] text-muted-foreground">
            {frame.detections.length} objects · {frame.busId} · {frame.capturedAt}
          </p>
        </div>
        <ul className="divide-y divide-border">
          {frame.detections.map((d) => (
            <li key={d.id} className="flex items-center gap-2 px-3 py-2">
              <span
                className="h-6 w-1 shrink-0 rounded"
                style={{
                  background:
                    d.kind === "defect"
                      ? "var(--cv)"
                      : d.kind === "vehicle"
                        ? "#5b9bd5"
                        : "#3fb27f",
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-foreground">
                  {d.label}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {d.note}
                  {d.trackId ? ` · ${d.trackId}` : ""}
                </span>
              </span>
              <span className="num shrink-0 text-[12px] font-semibold text-foreground">
                {Math.round(d.confidence * 100)}%
              </span>
            </li>
          ))}
          {frame.detections.length === 0 ? (
            <li className="px-3 py-4 text-[12px] text-muted-foreground">
              No defect detections in this frame — surface reads as restored.
            </li>
          ) : null}
        </ul>
        <div className="mt-auto space-y-1 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <p>
            Evidence integrity · <span className="num text-foreground">SHA-256 {frame.hash}</span>
          </p>
          <p>Privacy · ANONYMIZED · Raw frame NOT RETAINED</p>
        </div>
      </div>
    </div>
  );
}

export function BeforeAfterSlider({
  before,
  after,
  className,
}: {
  before: EvidenceFrame;
  after: EvidenceFrame;
  className?: string;
}) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const opts: OverlayOptions = { boxes: true, segmentation: true, trackIds: false, privacyMask: true };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div ref={ref} className="relative overflow-hidden rounded border border-border">
        <DetectionOverlay frame={after} options={{ ...opts, boxes: false, segmentation: false }} className="aspect-[4/3]" />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
          <div className="h-full" style={{ width: ref.current?.clientWidth ?? "100%" }}>
            <DetectionOverlay frame={before} options={opts} className="h-full" />
          </div>
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90"
          style={{ left: `${pos}%` }}
        />
        <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
          Before
        </span>
        <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
          After
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Compare before and after evidence"
        className="w-full accent-[oklch(0.52_0.12_253)]"
      />
    </div>
  );
}
