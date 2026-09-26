import { createFileRoute } from "@tanstack/react-router";
import { FleetPage } from "@/pages/FleetPage";

export const Route = createFileRoute("/fleet")({
  head: () => ({
    meta: [
      { title: "TRINETRA — Fleet Intelligence & Monitoring" },
      { name: "description", content: "Fleet telemetry, camera health, and public transport sensing unit registry." },
    ],
  }),
  component: FleetPage,
});
