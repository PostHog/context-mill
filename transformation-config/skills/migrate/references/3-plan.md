---
title: Plan the migration
next_step: 4-migrate.md
---

# Step 3 — Plan the migration

We're making a migration plan for this project. The plan covers exactly three things:

1. **Initialization** — where `<competitor_name>` is initialized today, where PostHog should be initialized in its place.
2. **Identification** — where the user is logged in / signed up, where `posthog.identify()` should fire.
3. **Call site replacement** — every existing call to the `<competitor_name>` API, plus its planned PostHog equivalent.

This step does **not** plan any new event captures, new instrumentation surfaces, or new business-value tracking. The migration is a faithful port — nothing more, nothing less.

Before proceeding, find any existing `posthog.capture()` / `posthog.identify()` / `posthog.init()` code in the project. Make note of event name formatting and any existing PostHog wiring — Step 4 must not duplicate it.

Read `.selected-targets.txt` to confirm the migration target. Read the `migration-source-<competitor_name>` skill installed in Step 1 — its `SKILL.md` and every file in its `references/` directory. The guide (sourced from `<competitor_docs>`) is the canonical replacement reference; the plan must map every call site to a specific replacement pattern from the guide. Do not spawn subagents.

Enumerate every call site of the `<competitor_name>` API in the project. Use `Grep` with the patterns from the migration guide. For each match, read the surrounding code so you understand the call's intent — feature flag evaluation, event capture, init, error report, etc. Categorize each call site into one of: `init`, `capture` (or equivalent event call), `feature-flag-eval`, `error-capture`, `session-replay`, `other`. The migration guide names which categories apply to `<competitor_name>` — use those.

Do not plan additional captures beyond what the migration guide and existing call sites cover. If the project has a login flow but no current identification call, that's an identification *opportunity* and is recorded separately (below). If the project does not currently capture an event, do not add a PostHog capture for it.

Find the project's login and signup flows (whether or not `<competitor_name>` already identifies users). On both client and server, identify() calls should fire when:

- A user logs in (after credentials are validated).
- A user signs up (after the account is created).

Use the contents of login and signup forms to find the user id / email. If both client and server code exist, plan to pass the client-side session and distinct ID through to the server using `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` headers, so user behavior across both domains correlates.

Create a new file at the root of the project: `.posthog-migration-plan.json`. Shape:

```json
{
  "target": "<competitor_name>",
  "init": [
    {
      "file": "lib/<competitor_name>.ts",
      "line": 8,
      "currentSnippet": "<competitor_name> init call",
      "plannedReplacement": "posthog.init(...) per migration-source-<competitor_name> guide"
    }
  ],
  "callSites": [
    {
      "file": "components/banner.tsx",
      "line": 14,
      "kind": "feature-flag-eval",
      "currentSnippet": "<competitor_name> flag evaluation",
      "plannedReplacement": "useFeatureFlagEnabled('show-banner') per migration guide"
    }
  ],
  "identification": [
    {
      "file": "app/login/page.tsx",
      "line": 30,
      "trigger": "login submit",
      "userIdSource": "form.email",
      "plannedCall": "posthog.identify(form.email, { email: form.email })"
    }
  ]
}
```

If a category has no entries, write an empty array. Every entry must have a real `file:line` from the project — no placeholders.

## Status

Status to report in this phase:

- Reading installed skill
- Locating `<competitor_name>` call sites
- Locating identification opportunities
- Writing migration plan
