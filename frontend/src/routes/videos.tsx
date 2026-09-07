import { createFileRoute } from "@tanstack/react-router";
import { VideosPage } from "@/pages/VideosPage";

export const Route = createFileRoute("/videos")({
  head: () => ({
    meta: [
      { title: "Video Ingestion & AI Processing | UrbanEye AI" },
      { name: "description", content: "Upload transit video footage and monitor AI pipeline execution." },
      { property: "og:title", content: "Video Ingestion & AI Processing | UrbanEye AI" },
      { property: "og:description", content: "Upload transit video footage and monitor AI pipeline execution." },
    ],
  }),
  component: VideosPage,
});
