import { createFileRoute } from "@tanstack/react-router";
import { WorkQueuePage } from "@/pages/WorkQueuePage";

export const Route = createFileRoute("/work-queue")({
  head: () => ({
    meta: [
      { title: "Priority Work Queue | UrbanPulse" },
      { name: "description", content: "Prioritized municipal work queue with department routing and SLA tracking." },
      { property: "og:title", content: "Priority Work Queue | UrbanPulse" },
      { property: "og:description", content: "Prioritized municipal work queue with department routing and SLA tracking." },
    ],
  }),
  component: WorkQueuePage,
});
