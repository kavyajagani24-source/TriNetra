import { createFileRoute } from "@tanstack/react-router";
import { BusesPage } from "@/pages/BusesPage";

export const Route = createFileRoute("/buses")({
  head: () => ({
    meta: [
      { title: "Bus Fleet Registry | UrbanEye AI" },
      { name: "description", content: "Manage sensing buses, route assignments, and sensor status." },
      { property: "og:title", content: "Bus Fleet Registry | UrbanEye AI" },
      { property: "og:description", content: "Manage sensing buses, route assignments, and sensor status." },
    ],
  }),
  component: BusesPage,
});
