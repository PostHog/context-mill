# Connector — GitHub Issues warehouse source

Creates the GitHub Issues warehouse source directly — zero browser trips on the happy path. Reuses the GitHub App integration verified in step 4; the only thing to establish is **which repository**, and the project you're sitting in already answers that.

**Dependency on step 4:** this can only auto-connect a repo the step-4 App install actually granted. If the repo isn't visible to the App (the validation in step 2 fails), that grant didn't cover it — fall back to the UI path and record a follow-up telling the user to grant this repo to the PostHog GitHub App.

## Status

Emit:

```
[STATUS] Connecting GitHub Issues warehouse source
```

## Tools

Load via `ToolSearch select:mcp__posthog-wizard__integrations-github-repos-retrieve,mcp__posthog-wizard__external-data-sources-create`.

If `integrations-github-repos-retrieve` or `external-data-sources-create` isn't available (older server), skip the auto-create and use the UI fallback (step 5 below) instead. **Not an abort.**

## Do

1. **Infer the repository.** Run `git remote get-url origin` in the project root and parse `owner/repo` from either form (`git@github.com:owner/repo.git` or `https://github.com/owner/repo[.git]`). No remote, or not a github.com remote → go to the fallback (step 5).

2. **Validate it against the integration.** Call `integrations-github-repos-retrieve` with the step-4 GitHub integration id and `search=<repo name>`. The inferred `full_name` appearing in the results means the GitHub App can see it. Not in the results → fallback (step 5) — the App likely wasn't installed on this repo.

3. **Confirm — never create unconfirmed:**

```
{
  id: "github-issues-repo",
  prompt: "Connect GitHub Issues for <owner/repo>? Signals will sync this repo's issues into the warehouse and watch them in the inbox.",
  kind: "single",
  options: [
    { label: "Yes, connect <owner/repo>", value: "yes" },
    { label: "A different repository", value: "other" },
    { label: "Skip GitHub Issues", value: "skip" }
  ]
}
```

   - **other** → ask once more with up to four close matches from `integrations-github-repos-retrieve` (search with fragments of the repo name, then the owner) plus "Skip". Still nothing that fits → fallback (step 5).
   - **skip** → record "picked but not connected" and return to step 6 (enable the dormant responder and add a follow-up — harmless, since it only emits once a warehouse source syncs).

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
   - 400 mentioning credentials or repository access → fallback (step 5).
   - Success returns the source `id` — record "connected by this setup (source id …, first sync started)".

5. **Fallback** (no remote / repo not visible / create failed): one ask — connect GitHub Issues in the UI at the new-warehouse-source URL from the run prompt, options "Done — connected it" / "Skip for now". After "Done", confirm with a single `external-data-sources-list` call — found → "verified connected"; still missing (or "Skip for now") → arm the dormant responder and add a follow-up (don't nag). A failed connector never dead-ends the run.

Return to step 6 (responder enabling and class recording happen there).
