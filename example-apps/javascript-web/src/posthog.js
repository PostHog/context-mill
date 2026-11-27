/**
 * PostHog initialization for vanilla JavaScript.
 *
 * Initializes posthog-js once and exports the instance for use across the app.
 * This file should be imported before any other modules that call PostHog methods.
 */
import posthog from 'posthog-js';

const projectToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN?.trim();
const apiHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

// Leave missing tokens unset and leave the client uninitialized rather than passing an empty or placeholder key.
if (!projectToken) {
  if (import.meta.env.DEV) {
    console.error('VITE_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_PROJECT_TOKEN is configured');
  }
} else {
  posthog.init(projectToken, {
    api_host: apiHost,
    defaults: '2026-08-30',
    // Autocapture is on by default and tracks clicks, form submissions, and pageviews.
    // capture_pageview defaults to true and captures $pageview on init.
    // For SPAs with History API routing, set capture_pageview to 'history_change'.
  });
}

export default posthog;
