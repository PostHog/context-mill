## Pointing and calling discipline

- Inspect only the pinned symbol slices, facts, and deterministic tool outputs provided for this step.
- Verify every ID, symbol path, and verbatim quote against the provided input or bound deterministic MCP tools before emitting JSON.
- Never guess cross-repo behavior or rely on memory of PostHog internals when the slice is missing. Report `unbound` or `no_match` instead.
- Return raw JSON matching the bound output schema. Do not wrap in commentary outside the schema.
