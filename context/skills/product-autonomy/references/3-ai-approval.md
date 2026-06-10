---
next_step: 4-github.md
---

# Step 3 — AI data processing approval

Signals drops **every** finding before it reaches the inbox unless the organization has approved AI data processing. There is no API the wizard can read or write for this setting, so the user is the source of truth: ask, point them at the settings page, and record the answer.

Organizations created since mid-2026 are approved by default, so for most users this is a one-tap confirmation — keep it light.

## Status

Emit:

```
[STATUS] Confirming AI data processing approval
```

## Tools

Load via `ToolSearch select:mcp__wizard-tools__wizard_ask`.

If `wizard_ask` is unavailable (CI / non-interactive), emit `[ABORT] requires-interactive-mode` and halt.

## Do

Ask once, with the organization AI settings URL from the run prompt baked into the text:

```
{
  id: "ai-approval",
  prompt: "Signals analyzes your product data with AI, which needs a one-time organization-level approval — without it, findings are silently dropped.\n\nCheck it here (Settings → Organization → AI service providers):\n<org AI settings URL>\n\nIs AI data processing approved for your organization?",
  kind: "single",
  options: [
    { label: "Yes — it's approved (or I just approved it)", value: "approved" },
    { label: "I can't change this — I'm not an org admin", value: "not-admin" },
    { label: "No, and I don't want AI processing enabled", value: "declined" }
  ]
}
```

Then:

- **approved** → record it and continue.
- **not-admin** → continue with setup, but record a **prominent follow-up** for the report: "An organization admin must approve AI data processing (Settings → Organization → AI service providers) — until then, no findings will appear in the inbox." Also: skip the session replay source in step 5 (its create is rejected server-side without approval).
- **declined** → emit exactly:

  ```
  [ABORT] ai data processing approval declined
  ```

  and stop.

Reality check: if step 5 later rejects the session replay source with an approval error even though the user said "approved", believe the server — downgrade your record to "not approved", skip the replay source, and add the follow-up above.
