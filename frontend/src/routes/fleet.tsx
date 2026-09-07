import { createFileRoute } from "@tanstack/react-router";
import { FleetPage } from "@/pages/FleetPage";

export const Route = createFileRoute("/fleet")({
  head: () => ({
    meta: [
      { title: "Fleet Intelligence | UrbanPulse" },
      { name: "description", content: "Bus fleet telemetry, camera health and sensing coverage across routes." },
      { property: "og:title", content: "Fleet Intelligence | UrbanPulse" },
      { property: "og:description", content: "Bus fleet telemetry, camera health and sensing coverage across routes." },
    ],
  }),
  component: FleetPage,
});
