---
next_step: 3-enrich.md
---

# Step 2 – Scan capture sites

Find every PostHog capture/identify/group SDK call in the codebase via a single `Grep` and write a base inventory. **Read-only via Grep.** Don't `Read` any source files in this step — file-level enrichment happens in step 3.

This step is one Grep, one Write. No file Reads, no subagents, no MCP. Severity, flows, and identity analysis come later.

## Tools

Load via `ToolSearch select:Grep,Write` once at the start of this step. `mcp__wizard-tools__audit_resolve_checks` is already loaded from step 1.

## Status

Emit, in order:

```
[STATUS] Scanning SDK capture sites
[STATUS] Writing base event inventory
```

## Action

### a. Grep for direct SDK calls (with context)

Run a single `Grep` for the standard PostHog call shapes. Use `-A 3` so multi-line capture calls are visible without opening the file. Narrow `--include` to the languages step 1 detected — don't scan `*.kt` if the project is Python.

```
Grep -rn -B 0 -A 3 -E 'posthog\??\.(capture|identify|alias|group|setPersonProperties|setPersonPropertiesForFlags|reset)|usePostHog\(\)\??\.(capture|identify)|client\??\.capture|PostHog\??\.(shared|capture)|Posthog\(\)\??\.capture'
```

The `\??\.` matches both `posthog.capture(...)` and `posthog?.capture(...)` (optional chaining). JS/TS codebases routinely guard SDK calls with `?.` when the SDK may be uninitialised — missing this pattern undercounts the inventory by half or more.

Common include patterns:

- Python: `--include='*.py'`
- JS/TS web: `--include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.vue' --include='*.svelte' --include='*.html'`
- Ruby: `--include='*.rb'`
- Go: `--include='*.go'`
- Java/Kotlin/Android: `--include='*.java' --include='*.kt'`
- iOS/Swift: `--include='*.swift'`
- Flutter: `--include='*.dart'`
- C#/.NET: `--include='*.cs'`
- Elixir: `--include='*.ex' --include='*.exs'`

**Exclude test files.** Drop hits in paths matching `*.test.*`, `*.spec.*`, `__tests__/**`, `tests/**`, `spec/**`. They pollute the inventory.

#### Per-SDK call signatures (covered by the regex above)

Canonical reference for what a PostHog capture call looks like in each SDK. The grep regex above is a union of these shapes; step 3 subagents also use this table to find `event_name` and `properties` slots when extracting (they `Read` this file once at start).

| SDK | Capture pattern | Event-name position | Properties position |
|-----|-----------------|---------------------|---------------------|
| posthog-js | `posthog.capture("event", { props })` | positional 1 | positional 2 (object literal) |
| posthog-js (hook) | `usePostHog().capture("event", { props })` | positional 1 | positional 2 |
| posthog-node | `client.capture({ distinctId, event, properties })` | object key `event` | object key `properties` |
| posthog-python | `posthog.capture(distinct_id, "event", properties)` | positional 2 | positional 3 (dict) |
| posthog-ruby | `posthog.capture({ distinct_id:, event:, properties: })` | hash key `event` | hash key `properties` |
| posthog-go | `client.Enqueue(posthog.Capture{Event: "...", Properties: posthog.NewProperties()...})` | struct field `Event` | struct field `Properties` |
| posthog-ios | `PostHog.shared.capture("event", properties: ["k": "v"])` | positional 1 | named `properties` |
| posthog-android | `PostHog.capture("event", properties = mapOf("k" to "v"))` | positional 1 | named `properties` |
| posthog-react-native | Same shape as posthog-js | positional 1 | positional 2 |
| posthog-flutter | `Posthog().capture(eventName: "...", properties: { ... })` | named `eventName` | named `properties` |
| posthog-php | `PostHog::capture(['distinctId' => ..., 'event' => '...', 'properties' => [...]])` | array key `event` | array key `properties` |
| posthog-dotnet | `client.Capture(distinctId, "event", new() { ["k"] = "v" })` | positional 2 | positional 3 |
| posthog-elixir | `Posthog.capture("event", distinct_id, %{ k: v })` | positional 1 | positional 3 |

If the result is empty:

- And the project's manifest had a PostHog SDK in step 1 → the codebase likely wraps the SDK behind a custom helper. Write `{ "rows": [], "wrapper_undetected": true }` to `.posthog-events-inventory.json` and skip the rest of this step (move on to step 3, which will short-circuit on empty rows). The data-quality check in the report step will flag this.
- And no SDK was in the manifest either → emit `[ABORT] No capture call sites found in any detected SDK`.

### b. Parse grep output into row groups

`Grep -A 3` emits one trigger line plus up to three following lines per match, separated by `--` divider lines (when running across files) or contiguous when matches are adjacent. For each match:

- The trigger line is `path:line:content` — the `.capture(` / `.identify(` / etc. site.
- The following 0–3 lines are continuations from the same file.
- Group them as a "slice" — the trigger line plus its trailing context lines.

The slice is what you reason about in step (c). You don't need to re-grep or open the file.

### c. Build base rows

For each grouped slice, build one row:

```jsonc
{
  "id": "capture-<short-file-slug>-<line>",
  "file": "src/checkout/Checkout.tsx",
  "line": 88,
  "raw_match": "<the trigger line + up to 3 continuation lines, joined by \\n>",
  "event_name": "purchase_completed",
  "is_dynamic": false
}
```

`event_name` resolution rule: extract the **first quoted string literal** (single, double, or backtick-quoted) found anywhere in the slice. If the first non-whitespace argument inside the parentheses is a quoted literal, take it. Otherwise:

- The slice contains a quoted literal but it's clearly a property value (e.g. `{ revenue: "USD" }`) and not the event name → keep scanning forward to find the event-name slot, or fall through to dynamic.
- The slice contains no quoted literal at all → set `event_name: null`, `is_dynamic: true`. Step 3's subagents will retry via Pattern A/B (same-file constant / enum) when they read the file.
- The argument is a template literal (`` `name_${...}` ``), variable, or expression → set `event_name: null`, `is_dynamic: true`.

**Don't try to be clever.** If the slice doesn't make the literal obvious, leave it dynamic — step 3 has the file open and will resolve what it can.

Skip `$pageview` and `$pageleave` matches entirely — they're SDK-internal in most setups. Drop those rows; they don't go into the inventory.

### d. Write the base inventory

`Write` `.posthog-events-inventory.json` with the rows:

```jsonc
{
  "rows": [ <base rows> ],
  "wrapper_undetected": false
}
```

This file is small (~80 bytes per row × 100 rows ≈ 8KB) so the Write fits in one turn easily.

### e. Resolve the phase

Flip the `scan-sites` row to `pass`:

```json
{
  "updates": [
    { "id": "scan-sites", "status": "pass" }
  ]
}
```

If the grep returned zero rows and you set `wrapper_undetected: true`, still resolve `scan-sites` to `pass` — the wrapper-undetected condition is a finding the data-quality panel surfaces, not a phase failure.

## Notes on wrapper resolution

This step intentionally does **not** chase wrapper functions (`trackEvent`, `analytics.track`, etc.). Cross-file wrapper resolution doesn't fit cleanly in row-range subagent fan-out, and the reframing principle is "let the reader ask follow-ups."

If `wrapper_undetected: true` (SDK in deps but no direct calls found), the report step's data-quality check surfaces it, and the suggested-follow-ups list points the reader at: *"find calls to `trackEvent`/`logEvent`/`analytics.track` and resolve their callers as additional capture sites."*
