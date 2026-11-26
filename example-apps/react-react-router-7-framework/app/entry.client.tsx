import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { isRouteErrorResponse, type ClientOnErrorFunction } from "react-router";
import { HydratedRouter } from "react-router/dom";

import posthog from 'posthog-js';
import { PostHogProvider } from '@posthog/react'

const posthogToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: '/ingest',
    ui_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST?.includes('eu.') ? 'https://eu.posthog.com' : 'https://us.posthog.com', // The PostHog app for your region
    defaults: '2026-08-30',
    capture_exceptions: true,
    tracing_headers: [ window.location.hostname ],
  });
} else if (import.meta.env.DEV) {
  console.error('VITE_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is configured');
}

// Errors React Router catches in the browser. Skip responses thrown on purpose (404s) and the
// sanitized copy of a server error: the server already captured it with its stack.
const onError: ClientOnErrorFunction = (error) => {
  if (isRouteErrorResponse(error)) return;
  if (error instanceof Error && error.message === "Unexpected Server Error") return;
  posthog.captureException(error);
};

startTransition(() => {
  hydrateRoot(
    document,
    <PostHogProvider client={posthog}>
      <StrictMode>
        <HydratedRouter onError={onError} />
      </StrictMode>
    </PostHogProvider>,
  );
});
