# PostHog integration for {display_name}

This skill helps you add PostHog analytics to {display_name} applications using the official PostHog Elixir SDK documentation.

## Instructions

1. Detect the existing Elixir app structure. Check `mix.exs`, `mix.lock`, `config/`, `lib/`, `application.ex`, Phoenix endpoint/router files, Plug pipelines, and existing Logger/error handling.
2. Read the reference files below before changing code. They are the source of truth for SDK installation, configuration, event capture, context, feature flags, group analytics, and error tracking.
3. Install the SDK by adding `{:posthog, "~> 2.0"}` to `mix.exs` and running `mix deps.get`, unless the project already uses a newer compatible version.
4. Configure PostHog through `config/config.exs` or runtime config using environment variables for `api_key` and `api_host`. Never hardcode secrets.
5. Add captures at meaningful request, job, or business-action boundaries. Use a stable `distinct_id` that matches the frontend/user identity.
6. Verify with the project's normal Mix commands, such as `mix test`, `mix format --check-formatted`, or the repository's existing checks.

## Reference files

{references}

## Region and host URL

PostHog has two cloud regions. Check the `projects-get` MCP response for a `region` field — `US` maps to `https://us.i.posthog.com`, `EU` maps to `https://eu.i.posthog.com`. If the region is not available from the MCP response or from existing project configuration (e.g. an already-set `POSTHOG_HOST` env var), ask the user: "Are you on PostHog US Cloud or EU Cloud?" Do not assume US Cloud.

## Key principles

- **Environment variables**: Always use environment variables for PostHog keys. Never hardcode them.
- **Minimal changes**: Add PostHog code alongside existing integrations. Don't replace or restructure existing code.
- **Match the docs**: Follow the Elixir reference's installation, configuration, capture, context, feature flag, and error tracking patterns exactly.
- **Analytics contract**: Treat event names, property names, and feature flag keys as part of an analytics contract. Reuse existing names and patterns found in the project. When introducing new ones, make them clear, descriptive, and consistent with existing conventions.

## Framework guidelines

{commandments}
