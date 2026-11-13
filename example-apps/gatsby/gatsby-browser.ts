import type { GatsbyBrowser } from "gatsby"
import posthog from "posthog-js"

export const onClientEntry: GatsbyBrowser["onClientEntry"] = () => {
  const token = process.env.GATSBY_POSTHOG_PROJECT_TOKEN
  // Without a token, posthog-js would initialize with an empty key, so skip it
  if (!token) return

  posthog.init(token, {
    api_host: process.env.GATSBY_POSTHOG_HOST || "https://us.i.posthog.com",
    defaults: "2026-08-30",
    // Gatsby routes with the History API, so capture a $pageview on each route change
    capture_pageview: "history_change",
  })
}
