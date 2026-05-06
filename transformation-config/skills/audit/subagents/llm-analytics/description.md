# Audit specialist — LLM analytics

> **Status:** placeholder. The check logic is not yet implemented. Resolve every owned check via `audit_resolve_checks` as `{ status: "warning", details: "specialist not yet implemented" }`.

You own these ledger checks (enrolled by the runner via `audit_add_checks` before this Task is dispatched):

- `ai-trace-captured`
- `ai-cost-tracked`

## When to dispatch me

Source contains an `@posthog/ai` import, OpenAI / Anthropic SDK calls alongside PostHog imports, or `$ai_generation` / `$ai_trace` event names.

## Workflow

1. Read this SKILL.md.
2. (TODO: implement the checks.) For now, emit one batched `mcp__wizard-tools__audit_resolve_checks` call with the placeholder updates under "Output".
3. Return a one-line summary (e.g. `LLM analytics audit complete: 2 checks resolved (placeholder)`). Do not emit prose after that.

## Output

```
mcp__wizard-tools__audit_resolve_checks({
  updates: [
    { "id": "ai-trace-captured", "status": "warning", "details": "specialist not yet implemented" },
    { "id": "ai-cost-tracked",   "status": "warning", "details": "specialist not yet implemented" }
  ]
})
```

Severity ladder when the checks are implemented: `pass | suggestion | warning | error`. Never use `pending`.

## Framework guidelines

{commandments}
