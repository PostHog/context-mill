---
criteria:
  - name: Working PostHog setup
    rubric: >-
      Supported SDKs are initialized in the existing app for its actual runtimes.
      Configuration uses the connected PostHog project and correct regional
      ingestion host. Private credentials are not exposed in client code or
      committed source. Equivalent supported integration patterns are acceptable.
      The integration uses an appropriate server SDK for Express.
  - name: Accurate API events
    rubric: >-
      Successful creation and transitions to completed emit meaningful events
      once per action. Invalid requests, missing todos, reopening, and repeated
      completed updates do not count as creations or new completions. Properties
      exclude todo text. The integration does not invent login or use a shared
      placeholder as every user's identity. Supported anonymous or personless
      events are acceptable.
  - name: Reliable delivery and preserved API
    rubric: >-
      Existing API responses and CRUD behavior are preserved. Event delivery uses
      supported server SDK lifecycle handling, including flushing queued events
      on normal shutdown where needed. Analytics failures do not incorrectly turn
      successful app operations into failures.
  - name: Runtime verification
    rubric: >-
      Execution evidence connects successful and unsuccessful requests through
      actual todo API handlers to the expected presence or absence of outgoing
      events, and shows queued events being sent. A build, isolated SDK probe, or
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
      - scripts/build.js
      - scripts/lib/**
      - scripts/plugins/*.js
      - package.json
      - pnpm-lock.yaml
      - .github/workflows/build.yml
---

In `apps/basic-integration/javascript-node/express-todo`:

Add PostHog analytics to this API so I can see when todos are successfully
created and completed. I don't want todo text sent to analytics.

Use my connected PostHog account. Get the app running, check that the analytics
work, and let me know what you verified.
