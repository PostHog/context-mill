# Connector — GitHub Issues warehouse source

Creates the GitHub Issues warehouse source directly — no browser trips. Reuses the GitHub App integration verified in step 3; the only thing to establish is **which repository**, and the project you're sitting in already answers that.

**Dependency on step 3:** this can only auto-connect a repo the step-3 App install actually granted. If the repo isn't visible to the App (the validation in step 2 fails), that grant didn't cover it — leave GitHub Issues as a dormant source and record a follow-up telling the user to grant this repo to the PostHog GitHub App. No browser trip — same dormant posture as Zendesk.

## Status

Emit:

```
[STATUS] Connecting GitHub Issues warehouse source
```

## Tools

Load via `ToolSearch select:mcp__posthog-wizard__integrations-github-repos-retrieve,mcp__posthog-wizard__external-data-sources-create`.

## Do

1. **Infer the repository.** Run `git remote get-url origin` in the project root and parse `owner/repo` from either form (`git@github.com:owner/repo.git` or `https://github.com/owner/repo[.git]`). No remote, or not a github.com remote → go to the dormant fallback (below).

2. **Validate it against the integration.** Call `integrations-github-repos-retrieve` with the step-3 GitHub integration id and `search=<repo name>`. The inferred `full_name` appearing in the results means the GitHub App can see it. Not in the results → dormant fallback (below) — the App isn't installed on this repo, so don't redirect or re-prompt.

3. **Confirm — never create unconfirmed:**

```
{
  id: "github-issues-repo",
  prompt: "Connect GitHub Issues for <owner/repo>? Self-driving will sync this repo's issues into the warehouse and watch them in the inbox.",
  kind: "single",
  options: [
    { label: "Skip GitHub Issues", value: "skip" },
    { label: "Yes, connect <owner/repo>", value: "yes" },
    { label: "A different repository", value: "other" }
  ]
}
```

   - **other** → ask once more with **"Skip" first**, then up to four close matches from `integrations-github-repos-retrieve` (search with fragments of the repo name, then the owner). Still nothing that fits → dormant fallback (below).
   - **skip** → record "picked but not connected" and return to step 5 (enable the dormant responder and add a follow-up — harmless, since it only emits once a warehouse source syncs).

4. **Create the source** with `external-data-sources-create`:

```json
{
  "source_type": "Github",
  "payload": {
    "auth_method": { "selection": "oauth", "github_integration_id": <integration id> },
    "repository": "<owner/repo>",
    "schemas": [
      {
        "name": "issues",
        "should_sync": true,
        "sync_type": "incremental",
        "incremental_field": "updated_at",
        "incremental_field_type": "datetime"
      }
    ]
  }
}
```

   Sync **only** `issues` — it's the one table Signals consumes; the user can enable more tables in the UI later (note this in the report).

   - 400 "Prefix is required" (a Github source already exists) → retry once with `prefix` set to the repo name sanitized to letters/numbers/underscores.
   - 400 mentioning credentials or repository access → dormant fallback (below).
   - Success returns the source `id` — record "connected by this setup (source id …, first sync started)".

5. **Dormant fallback** (no remote / repo not visible / create failed): don't redirect the user and don't re-prompt — record **"picked but not connected"** and return to step 5, where the dormant responder is enabled and the follow-up recorded (same harmless posture as Zendesk — it only emits once a warehouse source syncs). When the cause was the repo not being visible to the App, the follow-up also tells the user to grant this repo to the PostHog GitHub App. A failed connector never dead-ends the run.

Return to step 5 (responder enabling and class recording happen there).
