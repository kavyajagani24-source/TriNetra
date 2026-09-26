import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsPage } from "@/pages/AnalyticsPage";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "TRINETRA — City Analytics & Intelligence" },
      { name: "description", content: "Longitudinal patterns and trends derived from public transport telemetry." },
    ],
  }),
  component: AnalyticsPage,
});
