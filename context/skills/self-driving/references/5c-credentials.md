# Connector — API-credential warehouse source (Zendesk, pganalyze, Jira, …)

Creates the warehouse source for a tool that authenticates with API credentials, with at most **one click** from the user and **no secret in this chat**. The only part this run can't do is the user entering their credentials — they do that on a secure PostHog **connect page** in their browser, PostHog stores them, and this run creates the live source from the stored credential. Hand over the link, wait for the user to confirm, fetch the stored credential **once**, and create the source. If they skip or nothing was stored, leave a dormant responder and move on. Never nudge or wait through retry rounds.

This is the credential equivalent of `5b-linear.md` — same one-click-then-create-once posture, but the "one click" is entering credentials on the connect page instead of approving an OAuth grant.

## Status

Emit (substitute the tool name):

```
[STATUS] Connecting <Tool> warehouse source
```

## Tools

Reach all three through the PostHog `exec` tool (`info` then `call`): `data-warehouse-source-connect-link`, `data-warehouse-stored-credentials-list`, `data-warehouse-source-setup`.

`<Type>` below is the capitalized data-warehouse source type: `Zendesk`, `PgAnalyze`, `Jira` (the same string `external-data-sources-list` reports). The connect page renders the right credential form for that kind on its own.

## Do

1. **Get the connect link.** Call `data-warehouse-source-connect-link` with `{ "source_type": "<Type>" }`. It returns a `connect_url` (a PostHog page in the user's project) — relay that exact URL, don't build your own.

2. **Send the link.** Ask **once**, decline-first — the user enters their credentials in the browser, never here:

```
{
  id: "<tool>-connect",
  prompt: "One page connects <Tool>: open this link and enter your <Tool> credentials in PostHog (never paste them here) —\n\n<connect_url>\n\nThen come back.",
  kind: "single",
  options: [
    { label: "Skip <Tool>", value: "skip" },
    { label: "Done — I've entered them", value: "done" }
  ]
}
```

   - **skip** → record "picked but not connected" and return to step 5 (enable the dormant responder + follow-up — harmless, since it only emits once a warehouse source syncs).

3. **On done, fetch the stored credential once.** Call `data-warehouse-stored-credentials-list` with `{ "source_type": "<Type>" }` and take the **newest** `credential_id`. Stored credentials are single-use and expire after 24 hours, so read it right after the user confirms.

   - **Credential present** → create the source (below).
   - **None present** (the user didn't actually store anything, or it expired) → **don't re-ask or wait** — record "picked but not connected" and return to step 5 (the dormant responder + follow-up cover it; the user can finish the connect page later). This run never nudges.

4. **Create the source** with `data-warehouse-source-setup`, passing the stored credential by reference — never inline secrets:

```json
{
  "source_type": "<Type>",
  "payload": { "credential_id": "<credential id>" }
}
```

   `setup` validates the stored credentials, discovers the tables, and creates the source in one call. It enables **all** discoverable tables (unlike the Linear connector's single `issues` table); that's fine — the responder only reads the actionable one (tickets / issues) and the extra tables are harmless. Note in the report that all tables were enabled so the user can trim them later if they want.

   - Success returns the source `id` → record "connected by this setup (source id …, first sync started)".
   - Any failure (invalid or expired credentials, validation error) → don't loop the user back through the page; record "picked but not connected" and return to step 5 (dormant responder + follow-up). A failed connect never dead-ends the run.

Return to step 5 (responder enabling and class recording happen there).
