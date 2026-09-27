import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/pages/LoginPage";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in | TRINETRA" },
      { name: "description", content: "Role-based access to the TriNetra municipal intelligence platform." },
      { property: "og:title", content: "Sign in | TRINETRA" },
      { property: "og:description", content: "Role-based access to the TriNetra municipal intelligence platform." },
    ],
  }),
  component: LoginPage,
});
