# PostHog integration for {display_name}

This skill helps you add PostHog analytics to {display_name} applications.

## Workflow

Follow these steps in order to complete the integration:

{workflow}

## Reference files

{references}

The example project demonstrates SDK usage patterns (initialization, event capture, user identification, error tracking). Use it to understand the PostHog API, but adapt your implementation to match the actual project's architecture and conventions.

## Key principles

- **Environment variables**: Always use environment variables for PostHog keys. Never hardcode real API keys. If the project has no build step or runtime that supports environment variables (e.g. vanilla HTML), use placeholder values like `'YOUR_POSTHOG_API_KEY'` and instruct the user to replace them in the setup report.
- **Minimal changes**: Add PostHog code alongside existing integrations. Don't replace or restructure existing code.
- **Adapt to the project**: Follow the SDK documentation for how to integrate, but find the right place in the project's architecture to put it. Every project is structured differently — look for the natural entry point.
- **Explore first**: Read the project's key files before writing any code. Understand what the project does, where requests are handled, where users authenticate, and where errors are caught.

## SDK guardrails

{commandments}

## Identifying users

Always add `identify()` on login and signup flows. Refer to the SDK and identify documentation for the correct pattern. Never use raw emails or IP addresses as the distinct ID.

## Error tracking

Always add exception capture around critical user flows. Refer to the error tracking installation documentation for the correct pattern for this language.
