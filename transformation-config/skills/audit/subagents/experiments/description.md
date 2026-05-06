# Audit specialist — Experiments

> **Status:** placeholder. The check logic is not yet implemented. Resolve every owned check via `audit_resolve_checks` as `{ status: "warning", details: "specialist not yet implemented" }`.

You own these ledger checks (enrolled by the runner via `audit_add_checks` before this Task is dispatched):

- `exp-exposure-captured`
- `exp-variant-stable`

## When to dispatch me

Source contains experiment-named feature flags (suffixed `-test`, `-experiment`, `-ab`, or similar), `$feature_flag_called` event captures, or PostHog experiment SDK calls.

## Workflow

1. Read this SKILL.md.
2. (TODO: implement the checks.) For now, emit one batched `mcp__wizard-tools__audit_resolve_checks` call with the placeholder updates under "Output".
3. Return a one-line summary (e.g. `Experiments audit complete: 2 checks resolved (placeholder)`). Do not emit prose after that.

## Output

```
mcp__wizard-tools__audit_resolve_checks({
  updates: [
    { "id": "exp-exposure-captured", "status": "warning", "details": "specialist not yet implemented" },
    { "id": "exp-variant-stable",    "status": "warning", "details": "specialist not yet implemented" }
  ]
})
```

Severity ladder when the checks are implemented: `pass | suggestion | warning | error`. Never use `pending`.

## Framework guidelines

{commandments}
