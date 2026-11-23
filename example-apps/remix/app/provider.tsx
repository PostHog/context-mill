import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { PostHogProvider } from "@posthog/react";

const token = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;

export function PHProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (token) {
      posthog.init(token, {
        api_host: "/ingest",
        // The PostHog app for your region
        ui_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST?.includes("eu.")
          ? "https://eu.posthog.com"
          : "https://us.posthog.com",
        defaults: "2026-08-30",
        // Sends the PostHog distinct and session ids to this app's own server routes
        tracing_headers: [window.location.hostname],
      });
    } else if (import.meta.env.DEV) {
      console.warn(
        "VITE_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is configured"
      );
    }

    setHydrated(true);
  }, []);

  if (!hydrated) return <>{children}</>;
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
