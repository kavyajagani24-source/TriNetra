import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bus, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useStore } from "@/state/app-store";
import type { Role } from "@/types";

const ROLES: { role: Role; label: string; scope: string }[] = [
  { role: "pwd", label: "PWD Engineer", scope: "Road defects, work queue, verification" },
  { role: "traffic", label: "Traffic Police", scope: "Congestion, incident review, safety" },
  { role: "transport", label: "Transport Authority", scope: "Fleet health, coverage, telemetry" },
  { role: "executive", label: "Commissioner", scope: "City outcomes and department performance" },
];

export function LoginPage() {
  const { setRole } = useStore();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Role>("executive");

  return (
    <main className="grid min-h-screen bg-map-deep lg:grid-cols-[minmax(0,1fr)_460px]">
      <section className="relative hidden overflow-hidden lg:block" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.32_0.05_250)_0%,transparent_55%)]" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(65deg,rgba(255,255,255,0.05)_0_1px,transparent_1px_46px),repeating-linear-gradient(-25deg,rgba(255,255,255,0.04)_0_1px,transparent_1px_62px)]" />
        <div className="absolute bottom-10 left-10 max-w-md">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-2 shadow-lg">
              <img src="/logos/logo-icon-light.png" alt="TriNetra Emblem" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <img src="/logos/logo-text-light.png" alt="त्रिNetra" className="h-6 w-auto object-contain" />
              <p className="text-[10px] font-medium tracking-wider text-[#7DB89A] uppercase mt-0.5">SIH 2026 · AI Urban Sensing</p>
            </div>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-map-foreground/70">
            Smart India Hackathon 2026 · SIH26125
          </p>
          <h2 className="font-display mt-3 text-3xl font-semibold leading-tight text-map-foreground">
            Turning the city bus fleet into a continuous urban sensing network.
          </h2>
          <p className="font-ui mt-3 text-sm text-map-foreground/70">
            Observe → corroborate → prioritize → assign → repair → re-observe → verify → human
            sign-off.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center bg-background px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-start gap-1">
            <img
              src="/logos/logo-full.png"
              alt="त्रिNetra"
              className="h-10 w-auto object-contain"
            />
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground mt-0.5">
              Municipal Urban Sensing & AI Infrastructure Platform
            </p>
          </div>

          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setRole(selected);
              navigate({ to: "/overview" });
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="official-id" className="text-[11px]">
                Official ID
              </Label>
              <Input id="official-id" defaultValue="BBMP-OPS-2041" className="h-9 text-[13px]" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="passphrase" className="text-[11px]">
                Passphrase
              </Label>
              <Input
                id="passphrase"
                type="password"
                defaultValue="demo-access"
                className="h-9 text-[13px]"
              />
            </div>

            <fieldset className="space-y-1.5">
              <legend className="label-xs mb-1">Select operating role</legend>
              {ROLES.map((r) => (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => setSelected(r.role)}
                  aria-pressed={selected === r.role}
                  className={cn(
                    "w-full rounded border px-2.5 py-2 text-left transition-colors",
                    selected === r.role
                      ? "border-primary/50 bg-info-soft"
                      : "border-border hover:bg-secondary",
                  )}
                >
                  <span className="block text-[12px] font-medium text-foreground">{r.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{r.scope}</span>
                </button>
              ))}
            </fieldset>

            <Button type="submit" className="h-9 w-full text-[13px]">
              <Lock className="mr-1.5 h-4 w-4" aria-hidden />
              Enter command center
            </Button>
          </form>

          <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" aria-hidden />
            Demonstration environment. All footage is anonymized on-device; enforcement actions
            always require authorised human approval.
          </p>
        </div>
      </section>
    </main>
  );
}
