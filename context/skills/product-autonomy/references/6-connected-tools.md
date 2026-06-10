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

2. For each picked tool, check whether its warehouse source is already connected (step 2's project profile lists warehouse sources). For the ones missing, send the user to connect them — **one batched ask**, listing the picked tools and the new-warehouse-source URL from the run prompt, with options "Done — connected them" / "Skip for now". Verify nothing here beyond the user's word; warehouse syncs take time and the source row tolerates arriving first by a moment.

3. Enable the source row (step 5's write recipe) **only** for tools the user confirmed connected:
   - Linear → `linear` / `issue`
   - Zendesk → `zendesk` / `ticket`
   - GitHub Issues → `github` / `issue`
   - pganalyze → `pganalyze` / `issue`

4. Tools the user picked but skipped connecting → **don't enable**; record a follow-up: "Connect <tool> as a data warehouse source, then enable its responder in the Inbox's Edit sources." Tools not picked → record "skipped (not used)".
