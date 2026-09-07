import { createFileRoute } from "@tanstack/react-router";
import { LiveMapPage } from "@/pages/LiveMapPage";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Live GIS Map | UrbanPulse" },
      { name: "description", content: "Live map of bus fleet positions, road condition and open municipal issues." },
      { property: "og:title", content: "Live GIS Map | UrbanPulse" },
      { property: "og:description", content: "Live map of bus fleet positions, road condition and open municipal issues." },
    ],
  }),
  component: LiveMapPage,
});
