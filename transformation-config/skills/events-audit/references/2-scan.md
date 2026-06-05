---
next_step: 3-enrich.md
---

# Step 2 – Scan capture sites

Find every PostHog event-capture call site in the codebase — both **direct SDK calls** (`posthog.capture(...)`) and calls through **typed wrappers** (`captureEvent(...)`, `track(...)`, etc.) — then write a unified base inventory.

The flow:

1. **(a) Direct-SDK grep** for the standard PostHog call shapes.
2. **(b) SDK init grep** to anchor wrapper detection.
3. **(c) Read each init file** to extract in-file wrappers and the SDK instance name.
4. **(d) One cross-file import hop** to find wrappers anywhere in the codebase that import the SDK instance — no directory restriction.
5. **(e) Wrapper-alias grep** for every call site of every wrapper found.
6. **(f)–(i)** parse, build rows, write the inventory, resolve the phase.

Hard rule: **stop after one cross-file import hop from each init file.** No further chasing — don't read files outside the init set and their one-hop importers.

Severity, flows, and identity analysis come later.

## Tools

Load via `ToolSearch select:Grep,Glob,Read,Write` once at the start of this step. `mcp__wizard-tools__audit_resolve_checks` is already loaded from step 1.

## Status

Emit, in order:

```
[STATUS] Scanning direct SDK capture sites
[STATUS] Locating SDK initialization
[STATUS] Reading wrapper definitions
[STATUS] Scanning wrapper call sites
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

If this grep returns zero rows it doesn't mean there are no events — wrapper-mediated codebases routinely have zero direct SDK calls. Continue to sub-steps (b)–(e); only fall back to the empty-inventory path if every scan below also comes up empty:

- Direct-SDK grep empty **and** wrapper scan (b–e) empty **and** a PostHog SDK was in the manifest → write `{ "rows": [], "exception_sites": [], "wrapper_undetected": true }` and skip to step 3. The data-quality check surfaces it.
- Direct-SDK grep empty **and** no SDK in manifest either → emit `[ABORT] No capture call sites found in any detected SDK`.

### b. Grep for SDK initialization

Run a single `Grep -rn -l` for SDK init patterns, scoped to the languages step 1 detected. Use only the patterns for SDKs step 1 found:

| SDK | Init pattern |
|---|---|
| posthog-js | `posthog\.init\(`, `<PostHogProvider`, `usePostHog\s*\(\s*\)` |
| posthog-node | `new PostHog\(`, `PostHog\.client\(`, `posthog\.PostHog\(` |
| posthog-python | `Posthog\s*\(`, `posthog\.api_key\s*=`, `posthog\.project_api_key\s*=` |
| posthog-ruby | `PostHog::Client\.new\(` |
| posthog-go | `posthog\.New\(`, `posthog\.NewWithConfig\(` |
| posthog-php | `PostHog::init\(` |
| posthog-dotnet | `new PostHogClient\(`, `services\.AddPostHog\(` |
| posthog-ios / android | `PostHog\.setup\(`, `PostHog\.with\(` |
| posthog-flutter | `Posthog\(\)\.setup\(` |
| posthog-elixir | `Posthog\.start\(` |

Combine the relevant patterns into one alternation. Use the same `--include` set as sub-step (a). Capture the resulting file paths as `INIT_FILES` — typically 1–3 entries.

If `INIT_FILES` is empty, skip sub-steps (c)–(e) and fall back to the direct-SDK rows only. Empty init is not an error condition.

### c. Read each init file

`Read` every file in `INIT_FILES` fully. For each, collect:

1. **SDK instance** — the variable/hook/class holding the initialized SDK (`posthog`, `posthogClient`, `client`, `PostHog.shared`). Record as `<sdk_instance>`.
2. **In-file wrappers** — exported functions in this file that call `<sdk_instance>.capture(...)` or `<sdk_instance>.identify(...)`. Add each name to `WRAPPER_ALIASES`, tagged with the SDK family from step 1.
3. **Re-exports of the SDK instance** — `export { posthog }`, `export default client`, etc. Record as `<reexport_name>` for sub-step (d)'s grep.

Read each file in full — wrappers sometimes chain (`captureSystem` → `capture` → SDK).

### d. One cross-file import hop

Wrappers may live anywhere in the codebase — same dir as init, different package, different subtree. The importer grep finds them by import string, not directory.

For each file in `INIT_FILES`, grep the whole codebase for any file that imports it. Match three import shapes in a single combined regex per init file:

- **Relative** — `['"](\.\.?/)+([\w\-]+/)*<init_basename>['"]` (covers `./posthog`, `../../../lib/posthog`, etc.)
- **Aliased** — `['"]([@~][\w\-]*/)([\w\-]+/)*<init_basename>['"]` (covers `@/lib/posthog`, `~/lib/posthog`, `@app/lib/posthog`, etc.)
- **Absolute / package** — `['"]<full-package-path>['"]` when a `package.json`/`pyproject.toml` name re-exports the init module

Run with no directory restriction. Typical hit count 1–5; a typed-wrapper layer can legitimately be imported by 20+ files — read them all.

`Read` each importing file. For each, look for exported functions that call `<sdk_instance>.capture(...)` (match aliased imports like `import { posthog as <local_name> }` too) or that call any wrapper already in `WRAPPER_ALIASES`. Add both shapes to `WRAPPER_ALIASES`.

**Stop after one hop.** Do not chase importers-of-importers. Higher-level wrappers built on lower-level wrappers (`trackPurchase` calling `track`) are inventoried via sub-step (e)'s grep finding the lower-level call inside `trackPurchase`'s body.

### e. Grep for wrapper call sites

If `WRAPPER_ALIASES` is empty, skip this sub-step.

Otherwise run one `Grep -rn -B 0 -A 3` per coherent alias batch:

```
Grep -rn -B 0 -A 3 -E '\b(<alias_1>|<alias_2>|...)\s*\('
```

Use the same `--include` set as sub-step (a). Exclude every file in `INIT_FILES` and every file `Read` during sub-step (d) so the wrapper's own `posthog.capture(...)` doesn't double-count. If client-side and server-side wrappers live in different packages and need different excludes, do one grep per package. Don't truncate matches.

### f. Parse grep output into row groups

`Grep -A 3` emits one trigger line plus up to three following lines per match, separated by `--` divider lines (when running across files) or contiguous when matches are adjacent. For each match:

- The trigger line is `path:line:content` — the `.capture(` / `.identify(` / `<wrapper_alias>(` site.
- The following 0–3 lines are continuations from the same file.
- Group them as a "slice" — the trigger line plus its trailing context lines.

Combine slices from sub-step (a) and sub-step (e) into one set. Tag each slice with its origin so sub-step (g) can set the row's `via_wrapper` field correctly.

### g. Build base rows

For each grouped slice, build one row:

```jsonc
{
  "id": "capture-<short-file-slug>-<line>",
  "file": "src/checkout/Checkout.tsx",
  "line": 88,
  "raw_match": "<the trigger line + up to 3 continuation lines, joined by \\n>",
  "event_name": "purchase_completed",
  "is_dynamic": false,
  "via_wrapper": null
}
```

Set `via_wrapper` to the wrapper alias name (e.g. `"captureEvent"`, `"track"`) for rows from sub-step (e); leave `null` for rows from sub-step (a).

`event_name` resolution rule: extract the **first quoted string literal** (single, double, or backtick-quoted) found anywhere in the slice. If the first non-whitespace argument inside the parentheses is a quoted literal, take it. Otherwise:

- The slice contains a quoted literal but it's clearly a property value (e.g. `{ revenue: "USD" }`) and not the event name → keep scanning forward to find the event-name slot, or fall through to dynamic.
- The slice contains no quoted literal at all → set `event_name: null`, `is_dynamic: true`. Step 3's subagents will retry via Pattern A/B (same-file constant / enum) when they read the file.
- The argument is a template literal (`` `name_${...}` ``), variable, or expression → set `event_name: null`, `is_dynamic: true`.

**Don't try to be clever.** If the slice doesn't make the literal obvious, leave it dynamic — step 3 has the file open and will resolve what it can.

Skip `$pageview` and `$pageleave` matches entirely — they're SDK-internal in most setups. Drop those rows; they don't go into the inventory.

**Skip `captureException` matches.** The capture regex matches `posthog.captureException(...)`, but that's a distinct SDK method (always emits `$exception`, takes an Error). Drop any slice whose trigger line contains `.captureException(` before building rows. Collect those locations into a separate list:

```jsonc
{
  "exception_sites": [
    { "file": "src/api/users.ts", "line": 42, "raw_match": "..." }
  ]
}
```

### h. Write the base inventory

`Write` `.posthog-events-inventory.json`:

```jsonc
{
  "rows": [ <base rows> ],
  "exception_sites": [ <captureException locations, if any> ],
  "wrapper_aliases": [ <names from sub-step (c)/(d), or [] if none> ],
  "wrapper_undetected": false
}
```

### i. Resolve the phase

Flip the `scan-sites` row to `pass`:

```json
{
  "updates": [
    { "id": "scan-sites", "status": "pass" }
  ]
}
```

If every scan (direct + wrapper) returned zero rows and you set `wrapper_undetected: true`, still resolve `scan-sites` to `pass` — the wrapper-undetected condition is a finding the data-quality panel surfaces, not a phase failure.

