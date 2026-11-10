import dotenv from "dotenv"
import type { Config } from "@docusaurus/types"
import type * as Preset from "@docusaurus/preset-classic"

dotenv.config({ quiet: true })

const token = process.env.POSTHOG_PROJECT_TOKEN
const host = process.env.POSTHOG_HOST || "https://us.i.posthog.com"

if (!token && process.env.NODE_ENV !== "production") {
  console.warn(
    "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured"
  )
}

const config: Config = {
  title: "Burrito docs",
  url: "https://example.com",
  baseUrl: "/",
  onBrokenLinks: "throw",

  presets: [
    [
      "classic",
      {
        docs: { routeBasePath: "/", sidebarPath: "./sidebars.ts" },
        blog: false,
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    // The plugin throws without an apiKey, so only register it when a token is set
    ...(token
      ? [
          [
            "posthog-docusaurus",
            {
              apiKey: token,
              appUrl: host,
              // Load PostHog during `docusaurus start` too
              enableInDevelopment: true,
              // Extra options are passed through to posthog.init()
              defaults: "2026-08-30",
              // The plugin captures a $pageview on every route change, including the first
              capture_pageview: false,
            },
          ] as [string, Record<string, unknown>],
        ]
      : []),
  ],

  themeConfig: {
    navbar: {
      title: "Burrito docs",
      items: [{ to: "/burrito", label: "Burrito demo", position: "left" }],
    },
  } satisfies Preset.ThemeConfig,
}

export default config
