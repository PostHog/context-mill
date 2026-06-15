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
   - **Zendesk / pganalyze** → these need API credentials entered in the browser. Send the user in **one batched ask** listing the tools and the new-warehouse-source URL from the run prompt, with options "Done — connected them" / "Skip for now". After "Done", verify with one `external-data-sources-list` call — users sometimes answer "done" optimistically. If the source still isn't there, **nudge once**: tell them you don't see a `<tool>` source yet and re-ask ("I've added it now" / "Skip for now"), then verify one final time. **Stop after that single retry** — unlike Linear, this run can't create the source itself, so there's nothing to wait through more rounds for. If Linear's retry is also pending this round, **batch both into one ask** to save an ask-budget call. Detected on either check → "verified connected"; still nothing after the retry → "claimed but not detected".

4. Enable the source row (step 5's write recipe) for every tool the user picked — created, verified, and claimed-but-not-detected alike (a dormant row is harmless and saves a later trip):

   - GitHub Issues → `github` / `issue`
   - Linear → `linear` / `issue`
   - Zendesk → `zendesk` / `ticket`
   - pganalyze → `pganalyze` / `issue`

5. Record each picked tool's final class honestly — the report consumes these verbatim:

   - **connected by this setup** — the connector flow created the source (you have its id; the first sync starts automatically)
   - **already connected** / **verified connected** — the source row was seen in `external-data-sources-list`
   - **claimed but not detected** — you asked, the user answered "done", but both checks (the initial verify + one nudge) still show nothing. Enable the dormant responder, but **record it honestly — never write that the user "confirmed connecting" or "connected" it**. Phrase it as "you selected <tool>, but no warehouse source was detected after a re-check — the responder is enabled and stays dormant until the source is added and starts syncing", plus a follow-up with the new-warehouse-source URL
   - **skipped** — picked but declined to connect → **don't enable the responder**; follow-up: "Connect <tool> as a data warehouse source, then enable its responder in the Inbox's Edit sources." Tools not picked → "skipped (not used)".
