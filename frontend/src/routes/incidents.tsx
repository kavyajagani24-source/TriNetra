import { createFileRoute } from "@tanstack/react-router";
import { IncidentsPage } from "@/pages/IncidentsPage";

export const Route = createFileRoute("/incidents")({
  head: () => ({
    meta: [
      { title: "TRINETRA — Incidents & Safety Review" },
      { name: "description", content: "Human-in-the-loop review console for AI incident candidates." },
    ],
  }),
  component: IncidentsPage,
});
