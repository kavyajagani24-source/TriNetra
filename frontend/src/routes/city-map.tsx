import { createFileRoute } from "@tanstack/react-router";
import { CityMapPage } from "@/pages/CityMapPage";

export const Route = createFileRoute("/city-map")({
  head: () => ({
    meta: [
      { title: "TRINETRA — City Map Intelligence" },
      { name: "description", content: "Spatial intelligence layer powered by Mapbox GL JS WebGL vector map tiles." },
    ],
  }),
  component: CityMapPage,
});
