import { createFileRoute } from "@tanstack/react-router";
import { ActionCenterPage } from "@/pages/ActionCenterPage";

export const Route = createFileRoute("/action-center")({
  head: () => ({
    meta: [
      { title: "TRINETRA — Action Center" },
      { name: "description", content: "Centralized operational triage for road defects, traffic, and safety hazards." },
    ],
  }),
  component: ActionCenterPage,
});
