---
criteria:
  - name: Working PostHog setup
    rubric: >-
      Supported SDKs are initialized in the existing app for its actual runtimes.
      Configuration uses the connected PostHog project and correct regional
      ingestion host. Private credentials are not exposed in client code or
      committed source. Equivalent supported integration patterns are acceptable.
      Browser and server integration fits the Next.js Pages Router architecture.
  - name: Meaningful todo events
    rubric: >-
      Successful creation and transitions to completed produce meaningful events
      once per action, including across browser and server. Failed requests,
      reopening, and repeated completed updates do not count as creations or new
      completions. Useful properties exclude user-entered titles and
      descriptions. Equivalent event names are acceptable.
  - name: Existing behavior preserved
    rubric: >-
      The Pages Router UI and API still support listing, creating, completing,
      reopening, and deleting todos. Changes preserve the routing architecture
      and stay focused on analytics. A build or typecheck shows no new
      compilation errors.
  - name: Runtime verification
    rubric: >-
      Execution evidence connects todo creation and completion in the running app
      to outgoing PostHog events. Browser or API verification is acceptable when
      it exercises the instrumented app paths. A build, isolated SDK probe, or
      code inspection alone does not prove runtime behavior. Ingestion claims
      require evidence attributable to the app actions, not merely existing
      events with the same name. The final answer accurately reports verification
      and limitations.
config:
  agents:
    - agent: CODEX_CLI
      models:
        - gpt-6.1-sol
  sampleCount: 1
  repoUrl: https://github.com/PostHog/wizard-workbench
  repoRef: 2be6bc6a8b6693a79fbfb1a0d4c1396ce0608bc8
  inputs:
    - product-analytics
  mcpRefs:
    - mcp.posthog.com@demo-oauth-v1
  checks:
    paths:
      - context/skills/omnibus/instrument-product-analytics/**
      - context/commandments.yaml
      - context/skip-patterns.yaml
      - context/shared/**
      - context/uri-schema.yaml
      - example-apps/next-pages-router/**
      - scripts/build.js
      - scripts/lib/**
      - scripts/plugins/*.js
      - package.json
      - pnpm-lock.yaml
      - .github/workflows/build.yml
---

In `apps/basic-integration/next-js/15-pages-router-todo`:

I'd like to understand when people create and complete todos. Add PostHog
analytics without collecting the text they enter into titles or
descriptions.

Use my connected PostHog account. Get the app running, check that the analytics
work, and let me know what you verified.
