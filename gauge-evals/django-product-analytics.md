---
criteria:
  - name: Working PostHog setup
    rubric: >-
      Supported SDKs are initialized in the existing app for its actual runtimes.
      Configuration uses the connected PostHog project and correct regional
      ingestion host. Private credentials are not exposed in client code or
      committed source. Equivalent supported integration patterns are acceptable.
      The Django integration includes its server-side actions.
  - name: Registration and project events
    rubric: >-
      Successful registration and project creation emit meaningful events once
      per action, attributed to the relevant user with a stable app identity.
      Rejected forms and unauthorized requests do not emit success events.
      Properties exclude project descriptions, passwords, and tokens. Equivalent
      event names are acceptable.
  - name: Existing behavior preserved
    rubric: >-
      Registration, login, and authenticated project creation retain existing
      validation and ownership checks. Instrumentation does not replace
      authentication or require changing billing. Relevant Django checks or tests
      show no new app errors.
  - name: Runtime verification
    rubric: >-
      Execution evidence connects registration and authenticated project creation
      to outgoing events. Browser, HTTP, or Django test-client execution is
      acceptable when it exercises real views and event delivery. Existing remote
      person history is not a failure by itself. A build, isolated SDK probe, or
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
      - example-apps/django/**
      - example-apps/python/**
      - scripts/build.js
      - scripts/lib/**
      - scripts/plugins/*.js
      - package.json
      - pnpm-lock.yaml
      - .github/workflows/build.yml
---

In `apps/basic-integration/django/django3-saas`:

Add PostHog so I can understand which people sign up and then create a
project. Track successful actions without collecting project descriptions
or sensitive account information.

Use my connected PostHog account. Get the app running, check that the analytics
work, and let me know what you verified.
