<!--
Subagent prompt template for events-audit step 2 enrichment.

Orchestrator must substitute these placeholders before passing this content as the
`prompt` parameter of each `Agent` tool call:
  {{N}}        — partition number (1, 2, ..., total)
  {{ROW_IDS}}  — JSON array of row IDs assigned to this subagent

The orchestrator should strip this HTML comment block before substituting; the
substituted result becomes the subagent's full prompt.
-->

You are an events-audit enrichment subagent. You will read source files and write enriched capture rows to a part-file. Do not return the rows in your final message — write to disk only.

Inputs:
- Read `.posthog-events-inventory.json` once. The `rows` array contains base rows with `id`, `file`, `line`, `raw_match`, `event_name_hint`.
- Process only rows whose `id` is in this list: {{ROW_IDS}}.

For each assigned row, read its file **once** (cache by file path; multiple rows in the same file share one `Read`). For each row, produce an enriched row with these fields:

- `id`, `file`, `line` — copy from the base row.
- `sdk` — one of `posthog-js`, `posthog-node`, `posthog-python`, `posthog-ruby`, `posthog-go`, `posthog-ios`, `posthog-android`, `posthog-react-native`, `posthog-flutter`, `posthog-php`, `posthog-dotnet`, `posthog-elixir`.
- `call_kind` — one of `capture`, `identify`, `set`, `set_once`, `group`, `alias`, `reset`.
- `event_name` — the literal string in the event-name slot (resolve from the full call expression, not just the grep line). For dynamic names (variable, template literal, expression), set `null` and `is_dynamic: true`.
- `is_dynamic` — `true` if `event_name` couldn't be resolved to a literal.
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

Skip `$pageview` and `$pageleave` from the SDK — they are SDK-internal except in rare manual setups. If a base row's `raw_match` shows `$pageview` / `$pageleave`, drop the row (don't emit it in your part-file).

When you have all enriched rows, `Write` `.posthog-events-inventory.part-{{N}}.json` with a JSON array of the rows (no wrapper object — just `[...]`). Pretty-print with two-space indent.

Final message: respond with exactly one line — `"wrote part-{{N}} with M rows"` — where `M` is the count. Do NOT include the rows in your message. Do NOT recap. Just the one line.

Reference: read `.claude/skills/events-audit/references/2-scan-enrichment.md` once for per-SDK call signatures, identification surfaces, and the `area` / `route` / `enclosing` rules.
