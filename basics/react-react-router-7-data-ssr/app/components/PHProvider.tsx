import { createContext, useContext, useEffect, useState } from "react";

// Create a minimal context that matches PostHog's context structure
// This provides a safe default during SSR so useContext doesn't fail
export const PostHogContext = createContext<{ client: any; bootstrap: any }>({
  client: undefined,
  bootstrap: undefined,
});

/**
 * Minimal PostHog provider for SSR safety.
 * Provides undefined client during SSR, real client after hydration.
 */
function MinimalPostHogProvider({ children, client }: { children: React.ReactNode; client: any }) {
  return (
    <PostHogContext.Provider value={{ client, bootstrap: undefined }}>
      {children}
    </PostHogContext.Provider>
  );
}

/**
 * PostHog Provider component that handles SSR safely.
 * 
 * Following PostHog's Remix SSR pattern with dynamic imports:
 * - Dynamically import both posthog-js and @posthog/react to prevent SSR execution
 * - Use minimal context provider during SSR to prevent useContext errors
 * - Replace with real PostHogProvider after dynamic imports complete (client-side only)
 * - Components using usePostHog handle undefined gracefully with optional chaining
 */
export function PHProvider({ children }: { children: React.ReactNode }) {
  const [PostHogProviderComponent, setPostHogProviderComponent] = useState<React.ComponentType<{ client: any; children: React.ReactNode }> | null>(null);
  const [posthogClient, setPosthogClient] = useState<any>(undefined);

  useEffect(() => {
    // Dynamically import both PostHog packages only on client side
    if (typeof window !== "undefined") {
      Promise.all([
        import("posthog-js"),
        import("@posthog/react")
      ]).then(([posthogModule, reactModule]) => {
        const posthog = posthogModule.default;
        const { PostHogProvider } = reactModule;
        
        posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
          api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
          defaults: "2025-11-30",
        });
        
        setPosthogClient(posthog);
        setPostHogProviderComponent(() => PostHogProvider);
      });
    }
  }, []);

  // During SSR, use minimal provider with undefined client (prevents useContext errors)
  // After hydration, use real PostHogProvider with initialized client
  if (!PostHogProviderComponent) {
    return <MinimalPostHogProvider client={undefined}>{children}</MinimalPostHogProvider>;
  }

  return <PostHogProviderComponent client={posthogClient}>{children}</PostHogProviderComponent>;
}

