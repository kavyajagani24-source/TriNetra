import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsPage } from "@/pages/AnalyticsPage";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "City Analytics | UrbanPulse" },
      { name: "description", content: "Road health, congestion, resolution and coverage trends for the city network." },
      { property: "og:title", content: "City Analytics | UrbanPulse" },
      { property: "og:description", content: "Road health, congestion, resolution and coverage trends for the city network." },
    ],
  }),
  component: AnalyticsPage,
});
