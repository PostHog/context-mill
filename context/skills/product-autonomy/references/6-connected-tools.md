---
next_step: 7-scouts.md
---

# Step 6 — Connected-tool sources (ask, then connect)

External tools can feed the inbox too: GitHub Issues, Linear, Zendesk, and pganalyze. Each needs a **data warehouse source** before its signal source produces anything — enabling the source row without the warehouse connection is a dead row. Never enable one the user hasn't confirmed.

Two of these the run can connect **itself** (GitHub Issues, Linear — dedicated connector files below); two need the user in the UI because they require pasting API credentials, which this run never collects (Zendesk, pganalyze).

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
   - **Zendesk / pganalyze** → these need API credentials entered in the browser. Send the user in **one batched ask** listing the tools and the new-warehouse-source URL from the run prompt, with options "Done — connected them" / "Skip for now". After "Done", verify with one `external-data-sources-list` call — users sometimes answer "done" optimistically. If the source still isn't there, **nudge once**: tell them you don't see a `<tool>` source yet and re-ask ("I've added it now" / "Skip for now"), then verify one final time. **Stop after that single retry** — unlike Linear, this run can't create the source itself, so there's nothing to wait through more rounds for. If Linear's retry is also pending this round, **batch both into one ask** to save an ask-budget call. Detected on either check → "verified connected" (live responder). Otherwise — still nothing, **or** they pick "Skip for now" — treat it as **picked but not connected**: enable the dormant responder and add a follow-up (harmless; the responder only emits once a warehouse source syncs).

4. Enable the source row (step 5's write recipe) for every tool the user picked — created, verified, and picked-but-not-connected alike (a dormant row is harmless and saves a later trip):

   - GitHub Issues → `github` / `issue`
   - Linear → `linear` / `issue`
   - Zendesk → `zendesk` / `ticket`
   - pganalyze → `pganalyze` / `issue`

5. Record each picked tool's final class honestly — the report consumes these verbatim:

   - **connected by this setup** — the connector flow created the source (you have its id; the first sync starts automatically)
   - **already connected** / **verified connected** — the source row was seen in `external-data-sources-list`
   - **picked but not connected** — the user picked the tool but no live warehouse source exists: they answered "done" yet both checks (the initial verify + one nudge) still show nothing, **or** they chose "Skip for now". **Enable the dormant responder and add a "Connect <tool>…" follow-up** — this is harmless, because a responder only emits once its warehouse source actually syncs, so a dormant row just saves the user a later trip. Record it honestly — never write that the user "confirmed connecting" and never "not used". Phrase it as "you selected <tool>, but no warehouse source was detected — the responder is enabled and stays dormant until you add the source and it starts syncing", plus the follow-up with the new-warehouse-source URL
   - **not used** — the tool was **not picked** in the connected-tools multi-select. No responder, no follow-up; record "skipped (not used)".
