import { createFileRoute } from "@tanstack/react-router";
import { ExecutivePage } from "@/pages/ExecutivePage";

export const Route = createFileRoute("/executive")({
  head: () => ({
    meta: [
      { title: "Executive Summary | UrbanPulse" },
      { name: "description", content: "City-level outcomes, ward performance and department accountability." },
      { property: "og:title", content: "Executive Summary | UrbanPulse" },
      { property: "og:description", content: "City-level outcomes, ward performance and department accountability." },
    ],
  }),
  component: ExecutivePage,
});
