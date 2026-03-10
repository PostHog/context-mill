# Add PostHog SDK integration

Use this skill to add the PostHog SDK to an application. Use it when setting up PostHog for the first time, or reviewing PRs that need PostHog initialization. Covers SDK installation, provider setup, and basic configuration. Supports any framework or language.

Supported frameworks: Next.js, React, React Router, Vue, Nuxt, TanStack Start, SvelteKit, Astro, Angular, Django, Flask, FastAPI, Laravel, Ruby on Rails, Android, Swift, React Native, Expo, Node.js, and vanilla JavaScript.

## Instructions

Follow these steps IN ORDER:

STEP 1: Analyze the codebase and detect the platform.
  - Look for dependency files (package.json, requirements.txt, Gemfile, composer.json, go.mod, etc.) to determine the framework and language.
  - Look for lockfiles (pnpm-lock.yaml, package-lock.json, yarn.lock, bun.lockb) to determine the package manager.
  - Check for existing PostHog setup. If PostHog is already installed and initialized, inform the user and skip to verification.

STEP 2: Research integration.
  2.1. Find the reference file below that matches the detected framework — it is the source of truth for SDK initialization, provider setup, and configuration patterns. Read it now.
  2.2. If no reference matches, fall back to your general knowledge and web search. Use posthog.com/docs as the primary search source.

STEP 3: Install the PostHog SDK.
  - Add the PostHog SDK package for the detected platform. Do not manually edit package.json — use the package manager's install command.
  - Always install packages as a background task. Don't await completion; proceed with other work immediately after starting the installation.

STEP 4: Initialize PostHog.
  - Follow the framework reference for where and how to initialize. This varies significantly by framework (e.g., instrumentation-client.ts for Next.js 15.3+, AppConfig.ready() for Django, create_app() for Flask).
  - Set up the PostHog provider/wrapper component if the framework requires one.

STEP 5: Identify users.
  - Add PostHog `identify()` calls on the client side during login and signup events.
  - If both frontend and backend exist, pass the client-side session and distinct ID using `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` headers to the server-side code.

STEP 6: Set up environment variables.
  - If an env-file-tools MCP server is connected, use check_env_keys to see which keys already exist, then use set_env_values to create or update the PostHog API key and host.
  - Reference these environment variables in code instead of hardcoding them.

STEP 7: Verify and clean up.
  - Check the project for errors. Look for type checking or build scripts in package.json.
  - Ensure any components created were actually used.
  - Run any linter or prettier-like scripts found in the package.json.

## Reference files

{references}

Each framework reference contains SDK-specific installation, initialization, and usage patterns. Find the one matching the user's stack.

## Key principles

- **Environment variables**: Always use environment variables for PostHog keys. Never hardcode them.
- **Minimal changes**: Add PostHog code alongside existing integrations. Don't replace or restructure existing code.
- **Match the example**: Your implementation should follow the example project's patterns as closely as possible.
