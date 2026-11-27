import type { GatsbyConfig } from "gatsby"
import dotenv from "dotenv"

// Loads .env so GATSBY_-prefixed variables get inlined into the browser bundle
dotenv.config({ quiet: true })

// Leave missing tokens unset rather than defaulting to a placeholder string, and warn once outside production.
const rawToken = process.env.GATSBY_POSTHOG_PROJECT_TOKEN
const token = rawToken?.trim()

const globalWarnState = globalThis as typeof globalThis & {
  __posthogGatsbyMissingTokenWarned?: boolean
}

if (!token && process.env.NODE_ENV !== "production" && !globalWarnState.__posthogGatsbyMissingTokenWarned) {
  globalWarnState.__posthogGatsbyMissingTokenWarned = true
  console.warn(
    "GATSBY_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once GATSBY_POSTHOG_PROJECT_TOKEN is configured"
  )
}

const config: GatsbyConfig = {
  siteMetadata: {
    title: "Burrito consideration app",
  },
}

export default config
