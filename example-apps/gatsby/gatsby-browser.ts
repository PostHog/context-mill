import type { GatsbyBrowser } from "gatsby"
import posthog from "posthog-js"

export const onClientEntry: GatsbyBrowser["onClientEntry"] = () => {
  const rawToken = process.env.GATSBY_POSTHOG_PROJECT_TOKEN
  const token = rawToken?.trim()
  // Leave the client uninitialized when the project token is missing instead of passing an empty or fallback key.
  if (!token) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "GATSBY_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once GATSBY_POSTHOG_PROJECT_TOKEN is configured"
      )
    }
    return
  }

  posthog.init(token, {
    api_host: process.env.GATSBY_POSTHOG_HOST || "https://us.i.posthog.com",
    defaults: "2026-08-30",
    // Gatsby routes with the History API, so capture a $pageview on each route change
    capture_pageview: "history_change",
  })
}
