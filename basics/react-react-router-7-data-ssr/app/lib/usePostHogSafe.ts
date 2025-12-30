import { useContext } from "react";
import { PostHogContext } from "../components/PHProvider.js";

/**
 * Safe wrapper for usePostHog that handles SSR.
 * 
 * Uses the PostHog context from PHProvider, which is always available
 * (provides undefined during SSR, real client after hydration).
 * This avoids importing @posthog/react during SSR.
 */
export function usePostHogSafe() {
  const { client } = useContext(PostHogContext);
  return client;
}

