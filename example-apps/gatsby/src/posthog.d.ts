// The Gatsby plugin loads posthog-js with a script snippet and exposes it as window.posthog
interface PostHogSnippet {
  identify(distinctId: string, personProperties?: Record<string, unknown>): void
  capture(event: string, properties?: Record<string, unknown>): void
  captureException(error: unknown): void
  isFeatureEnabled(key: string): boolean | undefined
  reset(): void
}

interface Window {
  posthog?: PostHogSnippet
}
