# Connector — Google Search Console warehouse source

Creates the Google Search Console warehouse source with at most **one click** from the user. GSC is an OAuth source _and_ the user has to pick which Search Console property to import, so — unlike Linear — the run can't create it from an integration id alone. The PostHog **connect page** does the whole thing in the user's browser (OAuth grant, property pick, source creation); this run just hands over the link, checks **once** whether the source appeared, and either records it connected or leaves a dormant responder. Never nudge or wait through retry rounds.

This is the OAuth equivalent of `5c-credentials.md` — same one-click-then-verify-once posture, but the browser page runs an OAuth grant and a property pick instead of a credential form, and it creates the source itself (so this run verifies by listing sources rather than reading back a stored credential).

## Status

Emit:

```
[STATUS] Connecting Google Search Console warehouse source
```

## Tools

Reach both through the PostHog `exec` tool (`info` then `call`): `data-warehouse-source-connect-link` and `external-data-sources-list`.

## Do

1. **Get the connect link.** Call `data-warehouse-source-connect-link` with `{ "source_type": "GoogleSearchConsole" }`. It returns a `connect_url` (a PostHog page in the user's project) — relay that exact URL, don't build your own.

2. **Send the link.** Ask **once**, decline-first — the user approves Google access and picks a property in the browser, never here:

```
{
  id: "google-search-console-connect",
  prompt: "One page connects Google Search Console: open this link, approve Google access, and pick the property you want to import —\n\n<connect_url>\n\nThen come back.",
  kind: "single",
  options: [
    { label: "Skip Google Search Console", value: "skip" },
    { label: "Done — I've connected it", value: "done" }
  ]
}
```

   - **skip** → record "picked but not connected" and return to step 5 (enable the dormant responder + follow-up — harmless, since it only emits once a warehouse source syncs).

3. **On done, verify once.** Call `external-data-sources-list` and look for a source whose `source_type` is `GoogleSearchConsole`.

   - **Present** → record "connected by this setup (source id …, first sync started)". The connect page syncs `search_analytics_by_query_page` — the table the responder reads — by default, so there is nothing more to enable here.
   - **Absent** (the user didn't finish, or closed the page early) → **don't re-ask or wait** — record "picked but not connected" and return to step 5 (the dormant responder + follow-up cover it; the user can finish the connect page later). This run never nudges.

Return to step 5 (responder enabling and class recording happen there).
