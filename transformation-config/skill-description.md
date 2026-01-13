# PostHog integration for {display_name}

This skill helps you add PostHog analytics to {display_name} applications.

## Reference files

{references}

Review the example project first to understand the pattern, then consult the documentation for API details.

## Key principles

- **Environment variables**: Always use environment variables for PostHog keys. Never hardcode them.
- **Minimal changes**: Add PostHog code alongside existing integrations. Don't replace or restructure existing code.
- **Match the example**: Your implementation should follow the example project's patterns as closely as possible.

## Framework guidelines

{commandments}

## Identifying users

Call `posthog.identify()` on the client side during login and signup events. Use form contents to identify users on submit. If server-side code exists, pass the client-side session and distinct ID to maintain correlation.

## Error tracking

Add PostHog error tracking to relevant files, particularly around critical user flows and API boundaries.
