import type { GatsbyConfig } from "gatsby"
import dotenv from "dotenv"

// Loads .env so GATSBY_-prefixed variables get inlined into the browser bundle
dotenv.config({ quiet: true })

if (!process.env.GATSBY_POSTHOG_PROJECT_TOKEN && process.env.NODE_ENV !== "production") {
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
