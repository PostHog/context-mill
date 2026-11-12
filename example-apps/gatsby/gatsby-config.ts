import type { GatsbyConfig } from "gatsby"
import dotenv from "dotenv"

dotenv.config({ quiet: true })

const token = process.env.GATSBY_POSTHOG_PROJECT_TOKEN
const host = process.env.GATSBY_POSTHOG_HOST || "https://us.i.posthog.com"

if (!token && process.env.NODE_ENV !== "production") {
  console.warn(
    "GATSBY_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once GATSBY_POSTHOG_PROJECT_TOKEN is configured"
  )
}

const config: GatsbyConfig = {
  siteMetadata: {
    title: "Burrito consideration app",
  },
  plugins: [
    // Without a token the plugin would initialize PostHog with an empty key, so leave it out
    ...(token
      ? [
          {
            resolve: "gatsby-plugin-posthog",
            options: {
              apiKey: token,
              apiHost: host,
              // Load PostHog during `gatsby develop` too
              isEnabledDevMode: true,
              // Passed through to posthog.init()
              initOptions: {
                defaults: "2026-08-30",
                // The plugin captures a $pageview on every route change, including the first
                capture_pageview: false,
              },
            },
          },
        ]
      : []),
  ],
}

export default config
