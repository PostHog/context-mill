/**
 * PostHog initialization for vanilla JavaScript.
 *
 * Initializes posthog-js once and exports the instance for use across the app.
 * This file should be imported before any other modules that call PostHog methods.
 */
import posthog from 'posthog-js';

const apiKey = import.meta.env.VITE_POSTHOG_KEY;
const apiHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

if (!apiKey) {
  console.warn(
    'PostHog not configured (VITE_POSTHOG_KEY not set).',
    'App will work but analytics will not be tracked.',
  );
} else {
  posthog.init(apiKey, {
    api_host: apiHost,
    // Autocapture is ON by default — tracks clicks, form submissions, pageviews
    // capture_pageview: true (default) — captures $pageview on init
    // For SPAs with History API routing, use: capture_pageview: 'history_change'
  });
}

export default posthog;
