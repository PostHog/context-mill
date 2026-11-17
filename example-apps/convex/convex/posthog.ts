import { PostHog } from "@posthog/convex"
import { components } from "./_generated/api"

// Credentials live on the component (see convex.config.ts), so the client only
// needs the component reference. Convex functions are short-lived isolates, so
// there is nothing to flush or shut down.
export const posthog = new PostHog(components.posthog)
