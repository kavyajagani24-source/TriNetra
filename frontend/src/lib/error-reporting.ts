/**
 * TriNetra Application Error Diagnostics
 */
export function reportAppError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  if (import.meta.env.DEV) {
    console.error("[TriNetra Diagnostics]", error, {
      route: window.location.pathname,
      ...context,
    });
  }
}
