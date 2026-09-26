import { createFileRoute } from "@tanstack/react-router";
import { VideosPage } from "@/pages/VideosPage";

export const Route = createFileRoute("/videos")({
  head: () => ({
    meta: [
      { title: "TRINETRA — Video Ingestion & AI Processing" },
      { name: "description", content: "Operational monitoring for bus video ingestion and YOLO AI inference pipelines." },
    ],
  }),
  component: VideosPage,
});
