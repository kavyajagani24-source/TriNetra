import { createFileRoute } from "@tanstack/react-router";
import { VerificationPage } from "@/pages/VerificationPage";

export const Route = createFileRoute("/verification")({
  head: () => ({
    meta: [
      { title: "Verification Center | UrbanPulse" },
      { name: "description", content: "Re-observation based verification of completed repairs with human sign-off." },
      { property: "og:title", content: "Verification Center | UrbanPulse" },
      { property: "og:description", content: "Re-observation based verification of completed repairs with human sign-off." },
    ],
  }),
  component: VerificationPage,
});
