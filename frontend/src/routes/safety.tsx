import { createFileRoute } from "@tanstack/react-router";
import { SafetyPage } from "@/pages/SafetyPage";

export const Route = createFileRoute("/safety")({
  head: () => ({
    meta: [
      { title: "Safety & Incident Intelligence | UrbanPulse" },
      { name: "description", content: "Vulnerable road user risk zones and incident candidates awaiting human review." },
      { property: "og:title", content: "Safety & Incident Intelligence | UrbanPulse" },
      { property: "og:description", content: "Vulnerable road user risk zones and incident candidates awaiting human review." },
    ],
  }),
  component: SafetyPage,
});
