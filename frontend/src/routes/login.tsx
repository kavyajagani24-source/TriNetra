import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/pages/LoginPage";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in | UrbanPulse" },
      { name: "description", content: "Role-based access to the UrbanPulse municipal intelligence platform." },
      { property: "og:title", content: "Sign in | UrbanPulse" },
      { property: "og:description", content: "Role-based access to the UrbanPulse municipal intelligence platform." },
    ],
  }),
  component: LoginPage,
});
