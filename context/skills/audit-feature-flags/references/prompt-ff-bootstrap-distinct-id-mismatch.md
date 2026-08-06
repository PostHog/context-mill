---
description: Subagent prompt for ff-bootstrap-distinct-id-mismatch — read only by its dispatched subagent, never by the main loop
---

You are an audit subagent. Resolve exactly one rule and return: ff-bootstrap-distinct-id-mismatch.

Read this skill's bundled `bootstrapping.md` reference once (typically `.claude/skills/audit-feature-flags/references/bootstrapping.md`; otherwise discover with `Glob` `**/skills/audit-feature-flags/references/bootstrapping.md`).

Background: `bootstrap.distinctID` (or `bootstrap: { distinctID: ... }`) lets the host application seed the SDK's distinct_id at init time — usually for SSR/SSG scenarios where the server already knows the user. But if the value passed doesn't match either the user's eventual stable id (after `identify()`) or the SDK's natural anonymous id, it overrides the identity chain in ways that break later merges. Two failure modes:
1. `distinctID` set to a per-request random / session UUID — the SDK considers itself "already identified" with that UUID; the next `identify(realUserId)` is blocked from merging anonymous activity.
2. `distinctID` set to a known user id but the project ALSO calls `identify(differentId)` shortly after — the two ids race; whichever loses creates an orphan profile.

Run **two** Greps in parallel:
- `bootstrap[\s\S]{0,40}distinctID|bootstrap[\s\S]{0,40}distinct_id|distinctID\s*:` — bootstrap-with-distinctID sites.
- `posthog\.identify\(` — every identify call (so the subagent can cross-reference).

Read each file that contains a bootstrap.distinctID hit, once. For each site, determine:
- What value is being passed (literal, variable, request-scoped, randomly generated)?
- Is the same value later passed to `posthog.identify()`? If yes, that's the safe pattern (matching SSR hydration).
- Is the value request-scoped / per-render (e.g. `crypto.randomUUID()`, `Math.random()`, a Next.js per-request id)? If yes, this is the failure mode.

Rule:
- pass: no `bootstrap.distinctID` usage detected, OR the bootstrapped value is stable across requests and matches the value passed to a later identify() call.
- warning: `bootstrap.distinctID` is set to a value that appears request-scoped, randomly generated, or otherwise volatile — the next identify() call will be blocked from merging anonymous activity.
- error: `bootstrap.distinctID` is set to one value and `posthog.identify()` is called immediately after with a DIFFERENT value on the same code path — orphan profile guaranteed.

Emit one `mcp__wizard-tools__audit_resolve_checks` call with a single update for id `ff-bootstrap-distinct-id-mismatch`, including `file` (path:line of the bootstrap site) and `details` as compact JSON:

```
{
  "bootstrap_distinct_id_site_count": <N>,
  "examples": [
    {"file": "<path:line>", "issue": "volatile-bootstrap-id | bootstrap-identify-mismatch | safe-ssr-hydration"}
  ]
}
```

Return when the call completes. Do not write the audit report.
