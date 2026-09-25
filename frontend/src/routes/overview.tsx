import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "@/pages/OverviewPage";

export const Route = createFileRoute("/overview")({
  head: () => ({
    meta: [
      { title: "TRINETRA — Urban Intelligence Overview" },
      { name: "description", content: "Citywide operational situational awareness from public transport fleet telemetry." },
    ],
  }),
  component: OverviewPage,
});
