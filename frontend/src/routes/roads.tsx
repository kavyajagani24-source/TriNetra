import { createFileRoute } from "@tanstack/react-router";
import { RoadsPage } from "@/pages/RoadsPage";

export const Route = createFileRoute("/roads")({
  head: () => ({
    meta: [
      { title: "Road Condition Intelligence | UrbanPulse" },
      { name: "description", content: "Road surface health, defect discovery and segment-level condition scoring." },
      { property: "og:title", content: "Road Condition Intelligence | UrbanPulse" },
      { property: "og:description", content: "Road surface health, defect discovery and segment-level condition scoring." },
    ],
  }),
  component: RoadsPage,
});
