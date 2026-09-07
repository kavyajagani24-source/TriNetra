import { cn } from "@/lib/utils";
import type { Detection, EvidenceFrame } from "@/types";

export interface OverlayOptions {
  boxes: boolean;
  segmentation: boolean;
  trackIds: boolean;
  privacyMask: boolean;
}

const KIND_COLOR: Record<Detection["kind"], string> = {
  defect: "var(--cv)",
  vehicle: "#5b9bd5",
  person: "#3fb27f",
  sign: "#e9c26a",
};

export function DetectionOverlay({
  frame,
  options,
  className,
  compact = false,
  lazy = true,
}: {
  frame: EvidenceFrame;
  options: OverlayOptions;
  className?: string;
  compact?: boolean;
  lazy?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded bg-map-deep", className)}>
      <img
        src={frame.image}
        alt={`Road evidence captured by ${frame.busId} at ${frame.capturedAt}`}
        width={1024}
        height={768}
        loading={lazy ? "lazy" : undefined}
        className="block h-full w-full object-cover"
      />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      >
        {options.segmentation &&
          frame.detections
            .filter((d) => d.polygon)
            .map((d) => (
              <polygon
                key={`seg-${d.id}`}
                points={d.polygon!.map(([x, y]) => `${x * 100},${y * 100}`).join(" ")}
                fill={KIND_COLOR[d.kind]}
                fillOpacity="0.45"
                stroke={KIND_COLOR[d.kind]}
                strokeWidth="0.3"
              />
            ))}
        {options.boxes &&
          frame.detections.map((d) => {
            const [x, y, w, h] = d.box;
            return (
              <rect
                key={`box-${d.id}`}
                x={x * 100}
                y={y * 100}
                width={w * 100}
                height={h * 100}
                fill="none"
                stroke={KIND_COLOR[d.kind]}
                strokeWidth="0.45"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        {options.privacyMask &&
          frame.detections
            .filter((d) => d.kind === "person" || d.kind === "vehicle")
            .map((d) => {
              const [x, y, w, h] = d.box;
              return (
                <rect
                  key={`mask-${d.id}`}
                  x={(x + w * 0.22) * 100}
                  y={(y + h * 0.05) * 100}
                  width={w * 56}
                  height={h * 32}
                  rx="0.8"
                  fill="#111827"
                  fillOpacity="0.85"
                />
              );
            })}
      </svg>

      {options.boxes ? (
        <div className="pointer-events-none absolute inset-0">
          {frame.detections.map((d) => {
            const [x, y] = d.box;
            return (
              <span
                key={`lbl-${d.id}`}
                className={cn(
                  "absolute -translate-y-full whitespace-nowrap rounded-t px-1 font-semibold text-white",
                  compact ? "text-[9px]" : "text-[10px]",
                )}
                style={{
                  left: `${x * 100}%`,
                  top: `${y * 100}%`,
                  background: KIND_COLOR[d.kind],
                }}
              >
                {d.label.toLowerCase()} {d.confidence.toFixed(2)}
                {options.trackIds && d.trackId ? ` · ${d.trackId}` : ""}
              </span>
            );
          })}
        </div>
      ) : null}

      {frame.privacyProcessed ? (
        <span
          title="Faces and registration plates are anonymized in retained/transmitted evidence according to configured policy."
          className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/90"
        >
          Privacy processed
        </span>
      ) : null}
    </div>
  );
}
