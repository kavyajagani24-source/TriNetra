import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/pages/SettingsPage";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings & Privacy | UrbanPulse" },
      { name: "description", content: "Role access, detection thresholds, privacy processing and demo controls." },
      { property: "og:title", content: "Settings & Privacy | UrbanPulse" },
      { property: "og:description", content: "Role access, detection thresholds, privacy processing and demo controls." },
    ],
  }),
  component: SettingsPage,
});
