---
criteria:
  - name: Working PostHog setup
    rubric: >-
      Supported SDKs are initialized in the existing app for its actual runtimes.
      Configuration uses the connected PostHog project and correct regional
      ingestion host. Private credentials are not exposed in client code or
      committed source. Equivalent supported integration patterns are acceptable.
      The integration fits this vanilla JavaScript browser app.
  - name: Useful project and task events
    rubric: >-
      Creating projects and tasks and completing tasks produce meaningful events
      after successful actions, without duplicate counts. Useful properties
      exclude free-form project descriptions and task text. Equivalent event
      names and supported capture patterns are acceptable.
  - name: Correct user attribution
    rubric: >-
      Events use the signed-in user's stable app identity, including after a
      refresh. Logout ends that user's browser analytics identity; signing in as
      another user attributes subsequent actions correctly. Judge app identity
      handling without assuming the remote person profile is new or empty.
  - name: Existing behavior preserved
    rubric: >-
      Login, logout, project management, and task management continue to work.
      The existing localStorage-backed app and authentication flow are preserved.
      The app builds successfully.
  - name: Runtime verification
    rubric: >-
      Execution evidence connects project/task actions and login, refresh,
      logout, and account switching to outgoing events and their identities.
      Browser execution is needed to establish this browser behavior; MCP queries
      alone cannot do so. A build, isolated SDK probe, or code inspection alone
      does not prove runtime behavior. Ingestion claims require evidence
      attributable to the app actions, not merely existing events with the same
      name. The final answer accurately reports verification and limitations.
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

In `apps/basic-integration/javascript-web/saas-dashboard`:

Add PostHog so I can understand who is creating projects and tasks and
completing their work. Keep activity associated with the right person when
they sign in or out, without collecting the text of their projects or
tasks.

Use my connected PostHog account. Get the app running, check that the analytics
work, and let me know what you verified.
