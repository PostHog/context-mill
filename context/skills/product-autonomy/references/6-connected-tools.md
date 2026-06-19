---
next_step: 7-scouts.md
---

# Step 6 — Connected-tool sources (ask, then connect)

External tools can feed the inbox too: GitHub Issues, Linear, Zendesk, and pganalyze. Each needs a **data warehouse source** before its signal source produces anything — a source row without the warehouse connection is dormant: harmless, but silent until the source syncs. Never enable one the user hasn't confirmed.

Two of these the run can connect **itself**: GitHub Issues, and Linear via a one-click OAuth link (dedicated connector files below). The other two — Zendesk and pganalyze — need API credentials this run never collects, so the run does **not** send the user to the UI and does **not** check whether they connected: it just arms the dormant responder and records a follow-up. The user finishes those later (a downstream reminder prompts them).

## Status

Emit:

```
[STATUS] Offering issue-tracker integrations
```

## Tools

Load via `ToolSearch select:mcp__wizard-tools__wizard_ask,mcp__posthog-wizard__external-data-sources-list` (the source-config tools from step 5 stay loaded).

## Do

1. Ask **once**, multi-select (seed the option order with any step-2 hints — a tool you saw evidence of goes first):

```
{
  id: "connected-tools",
  prompt: "Signals can also watch your other tools and pull their issues into the inbox. Which of these do you use?",
  kind: "multi",
  options: [
    { label: "GitHub Issues", value: "github-issues" },
    { label: "Linear", value: "linear" },
    { label: "Zendesk", value: "zendesk" },
    { label: "pganalyze", value: "pganalyze" },
    { label: "None of these", value: "none" }
  ]
}
```

2. Call `external-data-sources-list` once (step 2's project profile also lists warehouse sources when it exists). For each picked tool whose source already exists (`source_type` `Github` / `Linear` / `Zendesk` / `PgAnalyze`): record "already connected" — no connector flow needed, just enable its responder row (step 4 below).

3. Dispatch each picked tool that's still missing:

   - **GitHub Issues** → read `references/6a-github.md` and follow it.
   - **Linear** → read `references/6b-linear.md` and follow it.
   - **Zendesk / pganalyze** → this run can't create their sources (it never collects the API credentials they need), so **don't ask the user to connect them and don't verify**. Just enable the dormant responder (step 4) and record "picked but not connected" with a follow-up. A downstream reminder prompts the user to add the warehouse source later; the responder stays dormant (harmless) and starts emitting once that source syncs.

4. Enable the source row (step 5's write recipe) for every tool the user picked — created, verified, and picked-but-not-connected alike (a dormant row is harmless and saves a later trip):

   - GitHub Issues → `github` / `issue`
   - Linear → `linear` / `issue`
   - Zendesk → `zendesk` / `ticket`
   - pganalyze → `pganalyze` / `issue`

5. Record each picked tool's final class honestly — the report consumes these verbatim:

   - **connected by this setup** — the connector flow created the source (you have its id; the first sync starts automatically)
   - **already connected** / **verified connected** — the source row was seen in `external-data-sources-list`
   - **picked but not connected** — the user picked the tool but no live warehouse source exists: Zendesk / pganalyze (never connected in-run), Linear when its integration didn't land, or a GitHub Issues fallback the user skipped. **Enable the dormant responder and add a "Connect <tool>…" follow-up** — this is harmless, because a responder only emits once its warehouse source actually syncs, so a dormant row just saves the user a later trip. Record it honestly — never write that the user "confirmed connecting" and never "not used". Phrase it as "you selected <tool>, but no warehouse source was detected — the responder is enabled and stays dormant until you add the source and it starts syncing", plus the follow-up with the new-warehouse-source URL
   - **not used** — the tool was **not picked** in the connected-tools multi-select. No responder, no follow-up; record "skipped (not used)".
