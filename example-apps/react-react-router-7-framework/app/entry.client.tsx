import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

import posthog from 'posthog-js';
import { PostHogProvider } from '@posthog/react'

const posthogToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: '/ingest',
    ui_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST?.includes('eu.') ? 'https://eu.posthog.com' : 'https://us.posthog.com', // The PostHog app for your region
    defaults: '2026-08-30',
    tracing_headers: [ window.location.hostname ],
  });
} else if (import.meta.env.DEV) {
  console.warn('VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is not set. PostHog is disabled.');
}


startTransition(() => {
  hydrateRoot(
    document,
    <PostHogProvider client={posthog}>
      <StrictMode>
        <HydratedRouter />
      </StrictMode>
    </PostHogProvider>,
  );
});
