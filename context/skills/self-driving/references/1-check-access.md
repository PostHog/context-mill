---
next_step: 2-read-context.md
---

# Step 1 — Check access

Self-driving is in **open beta** — available to every team — so there is no access gate to check here. This step exists only so the run opens with a fast, visible first checkmark. Do no real work: call no tool, fetch nothing.

## Status

Emit:

```
[STATUS] Checking Self-driving access
```

## Do

1. Mark this task `in_progress`, then `completed`, right away — make **both** transitions so the run's step tracking registers the step.
2. **Call no MCP tool here.** No probe, no source list. Step 2 gathers project state and step 4 lists the current sources before it writes, so nothing downstream needs a baseline from this step.

There is nothing to abort on here. The `[ABORT] self-driving is not available for this project` string still exists as a **safety net for the rest of the run**: if the Signals API later turns out to be genuinely unreachable for this project — a hard 403/404 on *every* Signals call, which is unexpected in open beta — emit it then and stop. A single failed source or scout is never an abort; record it as a follow-up and keep going.
