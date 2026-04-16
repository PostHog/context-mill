# Add PostHog product analytics events

Use this skill to add product analytics events (capture calls) that track meaningful user actions in new or changed code. Use it after implementing features or reviewing PRs to ensure key user behaviors are captured. If PostHog is not yet installed, this skill also covers initial SDK setup. Supports any framework or language.

Supported frameworks: Next.js, React Router, Nuxt, Vue, TanStack Start, SvelteKit, Astro, Angular, Django, Flask, FastAPI, Laravel, Ruby on Rails, Android, iOS, React Native, Expo, and more.

## Instructions

Follow these steps IN ORDER:

STEP 1: Analyze the codebase and detect the platform.
  - Look for dependency files (package.json, requirements.txt, Gemfile, composer.json, go.mod, etc.) to determine the framework and language.
  - Look for lockfiles (pnpm-lock.yaml, package-lock.json, yarn.lock, bun.lockb) to determine the package manager.
  - Check for existing PostHog setup. If PostHog is already installed and initialized, skip to STEP 5.

STEP 2: Research integration. (Skip if PostHog is already set up.)
  2.1. Find the reference file below that matches the detected framework — it is the source of truth for SDK initialization, provider setup, and event capture patterns. Read it now.
  2.2. If no reference matches, fall back to your general knowledge and web search. Use posthog.com/docs as the primary search source.

STEP 3: Install the PostHog SDK. (Skip if PostHog is already set up.)
  - Add the PostHog SDK package for the detected platform. Do not manually edit package.json — use the package manager's install command.
  - Always install packages as a background task. Don't await completion; proceed with other work immediately after starting the installation.

STEP 4: Initialize PostHog. (Skip if PostHog is already set up.)
  - Follow the framework reference for where and how to initialize. This varies significantly by framework (e.g., instrumentation-client.ts for Next.js 15.3+, AppConfig.ready() for Django, create_app() for Flask).

STEP 5: Plan event tracking.
  - From the project's file list, select between 10 and 15 files that might have interesting business value for event tracking, especially conversion and churn events.
  - Also look for files related to login that could be used for identifying users, along with error handling.
  - Find any existing `posthog.capture()` code. Make note of event name formatting. Don't duplicate existing events; supplement them.
  - Track actions only, not pageviews (those can be captured automatically). Exceptions can be made for "viewed"-type events at the top of a conversion funnel.
  - **Server-side events are REQUIRED** if the project includes any instrumentable server-side code (API routes, server actions, webhook handlers, payment/checkout completion, authentication endpoints).

STEP 6: Implement event capture.
  - For each planned event, add `posthog.capture()` calls with useful properties.
  - If a file already has existing integration code for other tools or services, don't overwrite or remove that code. Place PostHog code below it.
  - Do not alter the fundamental architecture of existing files. Make additions minimal and targeted.
  - You must read a file immediately before attempting to write it.

STEP 7: Identify users.
  - Add PostHog `identify()` calls on the client side during login and signup events. Use the contents of login and signup forms to identify users on submit.
  - If both frontend and backend exist, pass the client-side session and distinct ID using `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` headers to the server-side code. On the server side, make sure events have a matching distinct ID.

STEP 8: Add error tracking.
  - Add PostHog exception capture error tracking to relevant files, particularly around critical user flows and API boundaries.

STEP 9: Set up environment variables.
  - Check if the project already has PostHog environment variables configured (e.g. in `.env`, `.env.local`, or framework-specific env files). If valid values already exist, skip this step.
  - If the PostHog API key is missing, use the PostHog MCP server's `projects-get` tool to retrieve the project's `api_token`. If multiple projects are returned, ask the user which project to use. If the MCP server is not connected or not authenticated, ask the user for their PostHog project API key instead.
  - For the PostHog host URL, use `https://us.i.posthog.com` for US Cloud or `https://eu.i.posthog.com` for EU Cloud.
  - Write these values to the appropriate env file using the framework's naming convention.
  - Reference these environment variables in code instead of hardcoding them.

STEP 10: Verify and clean up.
  - Check the project for errors. Look for type checking or build scripts in package.json.
  - Ensure any components created were actually used.
  - Run any linter or prettier-like scripts found in the package.json.

## Reference files

{references}

Each framework reference contains SDK-specific installation, initialization, and usage patterns. Find the one matching the user's stack.

## Key principles

- **Environment variables**: Always use environment variables for PostHog keys. Never hardcode them.
- **Minimal changes**: Add PostHog code alongside existing integrations. Don't replace or restructure existing code.
- **Match the docs**: Follow the framework reference's initialization and capture patterns exactly.