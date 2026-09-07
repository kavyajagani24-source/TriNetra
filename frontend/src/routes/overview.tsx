import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "@/pages/OverviewPage";

export const Route = createFileRoute("/overview")({
  head: () => ({
    meta: [
      { title: "Command Center Overview | UrbanPulse" },
      { name: "description", content: "Citywide operational overview of corroborated road, traffic and safety observations." },
      { property: "og:title", content: "Command Center Overview | UrbanPulse" },
      { property: "og:description", content: "Citywide operational overview of corroborated road, traffic and safety observations." },
    ],
  }),
  component: OverviewPage,
});
