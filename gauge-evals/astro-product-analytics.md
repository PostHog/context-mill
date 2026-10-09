---
criteria:
  - name: Working PostHog setup
    rubric: >-
      Supported SDKs are initialized in the existing app for its actual runtimes.
      Configuration uses the connected PostHog project and correct regional
      ingestion host. Private credentials are not exposed in client code or
      committed source. Equivalent supported integration patterns are acceptable.
      The integration fits this Astro site.
  - name: Accurate navigation tracking
    rubric: >-
      The initial load and subsequent client-side page navigations each generate
      one pageview with the current URL. Back and forward navigation are tracked
      appropriately. SDK initialization and navigation handlers do not accumulate
      and duplicate events. Supported automatic or explicit tracking is
      acceptable.
  - name: Existing behavior preserved
    rubric: >-
      The site's pages and client-side transitions still work. The integration
      does not replace soft navigation with full reloads just to obtain
      pageviews. The site builds successfully.
  - name: Runtime verification
    rubric: >-
      Execution evidence connects an initial load, multiple client-side
      navigations, and back/forward navigation to outgoing pageviews. Browser
      execution is needed to establish navigation behavior and counts; fetching
      HTML or querying PostHog alone is insufficient. A build, isolated SDK
      probe, or code inspection alone does not prove runtime behavior. Ingestion
      claims require evidence attributable to the app actions, not merely
      existing events with the same name. The final answer accurately reports
      verification and limitations.
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
      - example-apps/astro-view-transitions/**
      - example-apps/astro-static/**
      - scripts/build.js
      - scripts/lib/**
      - scripts/plugins/*.js
      - package.json
      - pnpm-lock.yaml
      - .github/workflows/build.yml
---

In `apps/basic-integration/astro/astro-view-transitions-marketing`:

Add PostHog so I can see which pages visitors view as they move around this
site. Make sure navigation is tracked accurately, including when pages
change without a full reload.

Use my connected PostHog account. Get the app running, check that the analytics
work, and let me know what you verified.
