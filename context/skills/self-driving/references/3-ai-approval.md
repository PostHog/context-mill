---
next_step: 4-github.md
---

# Step 3 — AI data processing approval

Organization-level AI data processing approval (`organization.is_ai_data_processing_approved`) is what lets Signals keep findings — without it every finding is silently dropped. **It is enforced upstream by the wizard's own AI opt-in gate**, which blocks the run before this agent starts unless the organization has approved third-party AI. So by the time you reach this step, approval is **guaranteed granted** — there is nothing to check, ask, or abort on.

## Status

Emit:

```
[STATUS] AI data processing approved
```

## Do

- Do **not** ask the user about AI consent — the wizard already handled it before this run started.
- Do **not** emit any `[ABORT]` for approval.
- Record "approved" so the final report reflects it, then continue to step 4.
