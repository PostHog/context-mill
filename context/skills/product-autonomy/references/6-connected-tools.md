---
next_step: 7-scouts.md
---

# Step 6 — Connected-tool sources (ask, then connect)

External tools can feed the inbox too: GitHub Issues, Linear, Zendesk, and pganalyze. Each needs a **data warehouse source** connected before its signal source produces anything — enabling the source row without the warehouse connection is a dead row. Never enable one the user hasn't confirmed.

## Status

Emit:

```
[STATUS] Offering issue-tracker integrations
```

## Tools

Load via `ToolSearch select:mcp__wizard-tools__wizard_ask` (the source-config tools from step 5 stay loaded).

## Do

1. Ask **once**, multi-select (seed the option order with any step-2 hints — a tool you saw evidence of goes first):

```
{
  id: "connected-tools",
  prompt: "Signals can also watch your other tools and pull their issues into the inbox. Which of these do you use?",
  kind: "multi",
  options: [
    { label: "Linear", value: "linear" },
    { label: "Zendesk", value: "zendesk" },
    { label: "GitHub Issues", value: "github-issues" },
    { label: "pganalyze", value: "pganalyze" },
    { label: "None of these", value: "none" }
  ]
}
```

2. For each picked tool, check whether its warehouse source is already connected — one `external-data-sources-list` call (load via `ToolSearch select:mcp__posthog-wizard__external-data-sources-list`; step 2's project profile also lists warehouse sources when it exists). For the ones missing, send the user to connect them — **one batched ask**, listing the picked tools and the new-warehouse-source URL from the run prompt, with options "Done — connected them" / "Skip for now".

3. After "Done — connected them", **verify with one more `external-data-sources-list` call** — users sometimes answer "done" optimistically. Classify each picked tool:
   - source found → **verified connected**
   - source absent → **claimed but not detected**

4. Enable the source row (step 5's write recipe) for every tool the user picked (both classes — the row is dormant until its warehouse source syncs, so enabling early is harmless and saves a later trip):
   - Linear → `linear` / `issue`
   - Zendesk → `zendesk` / `ticket`
   - GitHub Issues → `github` / `issue`
   - pganalyze → `pganalyze` / `issue`

   Record the class honestly. "Claimed but not detected" must NOT be reported as connected — report it as "responder enabled, but no <tool> warehouse source was detected; it stays dormant until the source is connected and syncing", plus a follow-up with the new-warehouse-source URL.

5. Tools the user picked but skipped connecting → **don't enable**; record a follow-up: "Connect <tool> as a data warehouse source, then enable its responder in the Inbox's Edit sources." Tools not picked → record "skipped (not used)".
