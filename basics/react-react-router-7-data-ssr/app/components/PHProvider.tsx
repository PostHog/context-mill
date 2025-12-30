import posthog from "posthog-js";
import { PostHogProvider } from "@posthog/react";

// Initialize PostHog only on the client side (SSR-safe)
if (typeof window !== "undefined") {
  posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
    defaults: "2025-11-30",
  });
}

/**
 * PostHog Provider component that handles SSR safely.
 * 
 * Following PostHog's recommended pattern:
 * - Always render PostHogProvider (don't conditionally render)
 * - Initialize posthog with typeof window check
 * - Pass client instance to provider
 * - Provider's useEffect handles initialization timing
 * - Hooks gracefully handle uninitialized state
 */
export function PHProvider({ children }: { children: React.ReactNode }) {
  // Always render PostHogProvider - it handles SSR internally via useEffect
  // The provider doesn't block rendering even if PostHog isn't initialized yet
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}

