# Audit specialist — Feature flags

> **Status:** placeholder. The check logic is not yet implemented. Resolve every owned check via `audit_resolve_checks` as `{ status: "warning", details: "specialist not yet implemented" }`.

You own these ledger checks (enrolled by the runner via `audit_add_checks` before this Task is dispatched):

- `ff-eval-after-init`
- `ff-bootstrap-configured`

## When to dispatch me

Source contains any of: `isFeatureEnabled`, `getFeatureFlag`, `useFeatureFlagEnabled`, `getFeatureFlagPayload`, `bootstrap.featureFlags`.

## Workflow

1. Read this SKILL.md.
2. (TODO: implement the checks.) For now, emit one batched `mcp__wizard-tools__audit_resolve_checks` call with the placeholder updates under "Output".
3. Return a one-line summary (e.g. `Feature flags audit complete: 2 checks resolved (placeholder)`). Do not emit prose after that.

## Output

```
mcp__wizard-tools__audit_resolve_checks({
  updates: [
    { "id": "ff-eval-after-init",      "status": "warning", "details": "specialist not yet implemented" },
    { "id": "ff-bootstrap-configured", "status": "warning", "details": "specialist not yet implemented" }
  ]
})
```

Severity ladder when the checks are implemented: `pass | suggestion | warning | error`. Never use `pending`.

## Framework guidelines

{commandments}
