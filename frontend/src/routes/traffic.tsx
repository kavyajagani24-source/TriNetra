import { createFileRoute } from "@tanstack/react-router";
import { TrafficPage } from "@/pages/TrafficPage";

export const Route = createFileRoute("/traffic")({
  head: () => ({
    meta: [
      { title: "Traffic & Congestion | UrbanPulse" },
      { name: "description", content: "Corridor congestion, delay analysis and network flow states across the city." },
      { property: "og:title", content: "Traffic & Congestion | UrbanPulse" },
      { property: "og:description", content: "Corridor congestion, delay analysis and network flow states across the city." },
    ],
  }),
  component: TrafficPage,
});
