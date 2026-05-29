# PostHog integration for {display_name}

This skill helps you add PostHog analytics to {display_name} applications.

## Workflow

Follow these steps in order to complete the integration:

{workflow}

## Reference files

{references}

The example project shows the target implementation pattern. Consult the documentation for API details.

## Region and host URL

PostHog has two cloud regions. Check the `projects-get` MCP response for a `region` field — `US` maps to `https://us.i.posthog.com`, `EU` maps to `https://eu.i.posthog.com`. If the region is not available from the MCP response or from existing project configuration (e.g. an already-set `POSTHOG_HOST` env var), ask the user: "Are you on PostHog US Cloud or EU Cloud?" Do not assume US Cloud.

## Key principles

- **Environment variables**: Always use environment variables for PostHog keys and host URL. Never hardcode them.
- **Minimal changes**: Add PostHog code alongside existing integrations. Don't replace or restructure existing code.
- **Match the example**: Your implementation should follow the example project's patterns as closely as possible.

## Framework guidelines

{commandments}

## Identifying users

Identify users during login and signup events. Refer to the example code and documentation for the correct identify pattern for this framework. If both frontend and backend code exist, pass the client-side session and distinct ID using `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` headers to maintain correlation.

## Error tracking

Add PostHog error tracking to relevant files, particularly around critical user flows and API boundaries.
