import { createFileRoute } from "@tanstack/react-router";
import { IncidentsPage } from "@/pages/IncidentsPage";

export const Route = createFileRoute("/incidents")({
  head: () => ({
    meta: [
      { title: "Evidence Viewer | UrbanPulse" },
      { name: "description", content: "Computer-vision evidence inspection for incident candidates and defect detections." },
      { property: "og:title", content: "Evidence Viewer | UrbanPulse" },
      { property: "og:description", content: "Computer-vision evidence inspection for incident candidates and defect detections." },
    ],
  }),
  component: IncidentsPage,
});
