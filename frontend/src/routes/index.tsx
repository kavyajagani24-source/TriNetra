import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "@/pages/OverviewPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UrbanPulse — Urban Intelligence Command Center" },
      { name: "description", content: "Live municipal command center: bus-sourced road, traffic and safety intelligence for the city." },
      { property: "og:title", content: "UrbanPulse — Urban Intelligence Command Center" },
      { property: "og:description", content: "Live municipal command center: bus-sourced road, traffic and safety intelligence for the city." },
    ],
  }),
  component: OverviewPage,
});
