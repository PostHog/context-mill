/**
 * PostHog initialization for vanilla JavaScript.
 *
 * Initializes posthog-js once and exports the instance for use across the app.
 * This file should be imported before any other modules that call PostHog methods.
 */
import posthog from 'posthog-js';

const projectToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
const apiHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

if (!projectToken) {
  if (import.meta.env.DEV) {
    console.warn('VITE_POSTHOG_PROJECT_TOKEN is not set. Skipping PostHog initialization.');
  }
} else {
  posthog.init(projectToken, {
    api_host: apiHost,
    defaults: '2026-08-30',
    // Autocapture is ON by default — tracks clicks, form submissions, pageviews
    // capture_pageview: true (default) — captures $pageview on init
    // For SPAs with History API routing, use: capture_pageview: 'history_change'
  });
}

export default posthog;
