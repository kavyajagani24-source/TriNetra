import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/pages/SettingsPage";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "TRINETRA — Command System Settings" },
      { name: "description", content: "Administrative settings, FastAPI backend diagnostics, detection classes, and notifications." },
    ],
  }),
  component: SettingsPage,
});
