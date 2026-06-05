You are an events-audit enrichment subagent. You will read source files and write enriched capture rows to a part-file. Do not return the rows in your final message — write to disk only.

Inputs:
- Read `.posthog-events-inventory.json` once. Each base row has `id`, `file`, `line`, `raw_match`, `event_name`, `is_dynamic`, `via_wrapper`. Rows with `event_name: null` and `is_dynamic: true` need retroactive resolution (see below). Rows with `via_wrapper != null` came from step 2's wrapper-alias grep — preserve the field unchanged.
- The top-level `wrapper_aliases` array maps each alias to its SDK family. Use it to assign `sdk` for `via_wrapper != null` rows.
- Process only rows whose `id` is in: {{ROW_IDS}}.

For each assigned row, read its file **once** (cache by file path; multiple rows in the same file share one `Read`). For each row, produce an enriched row with these fields:

- `id`, `file`, `line` — copy from the base row.
- `via_wrapper` — copy from the base row.
- `sdk` — one of `posthog-js`, `posthog-node`, `posthog-python`, `posthog-ruby`, `posthog-go`, `posthog-ios`, `posthog-android`, `posthog-react-native`, `posthog-flutter`, `posthog-php`, `posthog-dotnet`, `posthog-elixir`. For `via_wrapper != null` rows, look up the alias in `wrapper_aliases`. For direct-call rows, derive from call syntax.
- `call_kind` — one of `capture`, `identify`, `set`, `set_once`, `group`, `alias`, `reset`. Wrapper-mediated calls almost always have `call_kind: "capture"`; check the wrapper definition if uncertain.
- `event_name` — see "Retroactive name resolution" below. For most rows, copy from the base row. For rows step 2 left dynamic, try Pattern A / Pattern B; otherwise copy `null`.
- `is_dynamic` — `true` if `event_name` couldn't be resolved to a literal (after Pattern A/B retry). `false` once resolution succeeds.
- `properties` — array of property keys from the properties argument (object literal / dict / hash). Empty array if the call passes a variable; empty array for non-capture `call_kind`s.
- `conditional_fire` — `true` if the call sits inside an `if` / ternary / guard that depends on something other than user identity.
- `distinct_id_kind` — server-side SDKs only: `"variable"` | `"literal"` | `"missing"`. `null` for client-side rows.
- `package` — monorepo package name from `apps/<name>/`, `packages/<name>/`, `services/<name>/`, or `projects/<name>/` prefix. `null` for single-app repos. See the `package` rules in the enrichment reference.
- `area` — codebase bucket from the file path (computed *after* the `package` prefix is stripped).
- `route` — Next.js route if applicable, otherwise `null`.
- `enclosing` — nearest enclosing function/component name from a backward scan.
- `status` — `"pending"`.
- `volume_30d` — `null`.
- `last_seen` — `null`.

## Retroactive name resolution (only for rows where `is_dynamic: true` from step 2)

For rows the orchestrator left dynamic, you have the file open already — try the patterns below before falling back to `is_dynamic: true`. Don't try these for rows where step 2 already resolved `event_name`; trust the base row.

### Pattern A — constant inlining

```ts
const EVENT = "signup_completed";
posthog.capture(EVENT, { method });
```

If the capture's first argument is a `const` / `let` / `final` / module-level variable in the same file, has a literal initializer, and is never reassigned, inline its value. If it's reassigned anywhere, leave the row dynamic.

### Pattern B — enum / object dispatch

```ts
const EVENTS = {
  SIGNUP_COMPLETED: "signup_completed",
  CHECKOUT_STARTED: "checkout_started",
} as const;

posthog.capture(EVENTS.SIGNUP_COMPLETED, { ... });
```

If the property access targets an object literal in the same module and every value is a literal, inline the resolved value. Don't resolve enums imported from other modules — leave dynamic.

### What you don't resolve

- Names built with template literals: `` `signup_${variant}` ``. Leave dynamic.
- Names imported from another module (other than the same-file enum pattern). Leave dynamic.
- Names from network responses or feature-flag values. Leave dynamic.
- **Wrapper / function-arg passthrough.** If the dynamic name is a function parameter (`posthog.capture(eventName, ...)` where `eventName` is the enclosing function's argument), leave dynamic — chasing callers across files is intentionally out of scope. The report step's suggested follow-ups list points the reader at this case so they can ask Claude to resolve specific wrappers on demand.

When a row can't be resolved, leave it `is_dynamic: true` with `event_name: null`. The data-quality check counts these as undercount risk; the report's by-event table omits them (they appear only in a "dynamic captures" footnote).

## $pageview / $pageleave

Skip `$pageview` and `$pageleave` from the SDK — they are SDK-internal except in rare manual setups. If a base row's `raw_match` shows `$pageview` / `$pageleave`, drop the row (don't emit it in your part-file). Step 2 already drops these in most cases, but double-check.

## Output

When you have all enriched rows, `Write` `.posthog-events-inventory.part-{{N}}.json` with a JSON array of the rows (no wrapper object — just `[...]`). Pretty-print with two-space indent.

Final message: respond with exactly one line — `"wrote part-{{N}} with M rows"` — where `M` is the count. Do NOT include the rows in your message. Do NOT recap. Just the one line.

References to read once at the start of your run:
- `.claude/skills/events-audit/references/3-enrich-reference.md` — identification surfaces, `package` / `area` / `route` / `enclosing` rules.
- `.claude/skills/events-audit/references/2-scan.md` — only the "Per-SDK call signatures" table, for extracting `event_name` and `properties` from each SDK's call shape.
