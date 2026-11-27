// Log a browser console error in development when POSTHOG_PROJECT_TOKEN is missing and posthog-docusaurus was skipped.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.error(
    "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured"
  )
}
