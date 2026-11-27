import dotenv from "dotenv"
import type { Config } from "@docusaurus/types"
import type * as Preset from "@docusaurus/preset-classic"

dotenv.config({ quiet: true })

// Leave missing tokens unset rather than passing a default or placeholder key to posthog-docusaurus.
const token = process.env.POSTHOG_PROJECT_TOKEN?.trim()
const host = process.env.POSTHOG_HOST || "https://us.i.posthog.com"

const globalWarnState = globalThis as typeof globalThis & {
  __posthogMissingTokenWarned?: boolean
}

if (!token && process.env.NODE_ENV !== "production" && !globalWarnState.__posthogMissingTokenWarned) {
  globalWarnState.__posthogMissingTokenWarned = true
  console.warn(
    "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured"
  )
}

const config: Config = {
  title: "Burrito docs",
  url: "https://example.com",
  baseUrl: "/",
  onBrokenLinks: "throw",

  // In development builds without a token, load a client module so the browser console also surfaces the missing-token error.
  clientModules: !token && process.env.NODE_ENV !== "production" ? ["./src/posthog-client.ts"] : [],

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
    // posthog-docusaurus throws without an apiKey, so skip registering it instead of passing a placeholder token.
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
