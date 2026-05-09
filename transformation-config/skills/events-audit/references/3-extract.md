---
next_step: 4-mcp-query.md
---

# Step 3 – Resolve dynamic event names

For inventory rows with `is_dynamic: true` or `event_name: null`, try to resolve the literal name by tracing the local code. Anything that doesn't resolve stays dynamic – the data-quality check in the report step treats unresolved dynamics as undercount risk.

## Status

Emit:

```
[STATUS] Extracting event names
```

## Action

`Read` `.posthog-events-inventory.json`. Filter to rows where `is_dynamic == true` or `event_name == null`. If empty, continue to step 4 immediately.

For each ambiguous row, `Read` its file once and try the patterns below.

### Pattern A – constant inlining

```ts
const EVENT = "signup_completed";
posthog.capture(EVENT, { method });
```

If `EVENT` is a `const` / `final` / `let` / module-level variable in the same file, has a literal initializer, and is never reassigned, inline its value. If it's reassigned anywhere, leave the row dynamic.

### Pattern B – enum / object dispatch

```ts
const EVENTS = {
  SIGNUP_COMPLETED: "signup_completed",
  CHECKOUT_STARTED: "checkout_started",
} as const;

posthog.capture(EVENTS.SIGNUP_COMPLETED, { ... });
```

If the property access targets an object literal in the same module and every value is a literal, inline the resolved value. Don't resolve enums imported from other modules – leave dynamic.

### What you don't resolve

- Names built with template literals: `` `signup_${variant}` ``. Leave dynamic. The data-quality check flags these as undercount risk.
- Names imported from another module (other than the same-file enum pattern). Leave dynamic.
- Names from network responses or feature-flag values. Leave dynamic.
- **Wrapper / function-arg passthrough.** If the dynamic name is a function parameter (`posthog.capture(eventName, ...)` where `eventName` is the enclosing function's argument), leave dynamic — chasing callers across files is intentionally out of scope. The report step's suggested follow-ups list points the PM at this case so they can ask Claude to resolve specific wrappers on demand.

When a row can't be resolved, leave it as `is_dynamic: true` with `event_name: null`. The data-quality check counts these as undercount risk; the report's by-event table omits them (they appear only in a "dynamic captures" footnote).

`Write` the updated inventory back. This is the only step that edits the inventory by hand – keep the two-space indent.
