---
next_step: 3-extract.md
---

# Step 2 – Scan capture sites (two-phase)

Find every PostHog capture/identify/group SDK call in the codebase, derive the codebase mapping (`area`, `route`, `enclosing`), and extract per-call fields. Write the inventory to disk **without ever materializing the full enriched JSON in a single model turn.**

The previous architecture collapsed enrichment + merge into one orchestrator turn and crashed at `max_tokens` on a 51-file project. This step is split into three phases that respect that limit:

1. **Phase 1 — orchestrator structural pass.** One Grep, write a small base inventory with `file` / `line` / `event_name_hint` per row.
2. **Phase 2 — subagent enrichment fan-out.** All subagents dispatched in **one assistant turn**. Each subagent enriches a slice of rows and writes a part-file. Subagents return a one-line confirmation, never the JSON.
3. **Phase 3 — orchestrator concat via `jq`.** A single Bash call merges part-files into the canonical inventory. Zero output tokens for the merge.

Don't judge severity, don't infer flows, don't call MCP — those come later.

## Status

Emit, in order:

```
[STATUS] Scanning capture sites
[STATUS] Writing base inventory
[STATUS] Enriching capture sites
[STATUS] Merging part-files
```

## Phase 1 — Orchestrator structural pass

### a. Grep for direct SDK calls

Run a single `Grep` for the standard PostHog call shapes. Narrow `--include` to the languages step 1 detected — don't scan `*.kt` if the project is Python.

```
Grep -rn -E 'posthog\??\.(capture|identify|alias|group|setPersonProperties|setPersonPropertiesForFlags|reset)|usePostHog\(\)\??\.(capture|identify)|client\??\.capture|PostHog\??\.(shared|capture)|Posthog\(\)\??\.capture'
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

If the result is empty:
- And the project's manifest had a PostHog SDK in step 1 → the codebase likely wraps the SDK behind a custom helper. Write `{ "rows": [], "wrapper_undetected": true }` to `.posthog-events-inventory.json` and skip phases 2 and 3 (move on to step 3). The data-quality check in the report step will flag this.
- And no SDK was in the manifest either → emit `[ABORT] No capture call sites found in any detected SDK`.

### b. Write the base inventory

Build base rows directly from the grep result text. **Do not read any source files in phase 1.** Each row has only what's available from the grep line itself:

```jsonc
{
  "id": "capture-<short-file-slug>-<line>",
  "file": "src/checkout/Checkout.tsx",
  "line": 88,
  "raw_match": "  posthog.capture(\"purchase_completed\", { revenue, currency });",
  "event_name_hint": "purchase_completed"
}
```

`event_name_hint` is best-effort: extract the first quoted string from `raw_match` (single, double, or backtick-quoted). For multi-line capture calls (`posthog.capture(\n  "...", ...)`) the hint will be `null` — phase 2 resolves the canonical name by reading the file. **Don't try to be clever with regex here.** If the first quoted string is on the same line as the `.capture(` token, take it; otherwise leave `null`.

`Write` `.posthog-events-inventory.json` with the base rows. This file is small (~40 bytes per row × 100 rows ≈ 4KB) so the Write fits in one turn easily.

```jsonc
{
  "rows": [ <base rows> ],
  "wrapper_undetected": false,
  "_phase": "base"
}
```

The `_phase: "base"` marker tells you this file is not yet enriched. Phase 3 overwrites it.

## Phase 2 — Subagent enrichment fan-out

### c. Decide the partition

Count distinct files in the base inventory.

- **≤ 8 distinct files**: skip fan-out. The orchestrator handles enrichment inline (one subagent's worth of work; the merge is small). Skip phase 2's `Agent` dispatch and proceed straight to enrichment via direct `Read` + `Write` of the part-file convention.
- **> 8 distinct files**: fan out. `N = ceil(files / 10)`, capped at 8. Round-robin assign files alphabetically to N groups; each group's row-id list is what the subagent receives. Don't bother estimating file sizes — the orchestrator's job is dispatch, not load-balancing.

### d. Spawn N sub-agents in parallel using the `Agent` tool

Load `Agent` once: `ToolSearch select:Agent`.

**Spawn all N sub-agents in parallel using the `Agent` tool — one assistant turn, N tool_use blocks in the same message.** Sequential dispatch (one Agent per turn) loses ~30s of orchestration latency for no reason; the prior diagnostic confirmed this. Batch them.

Each `Agent` invocation passes the subagent prompt template (below) plus that subagent's row-id list and the partition number N. Set `run_in_background: false` — you want their results before the merge.

### e. Subagent prompt template

Each subagent receives this prompt (substitute `{{N}}` and `{{ROW_IDS}}`):

```
You are an events-audit enrichment subagent. You will read source files and write enriched capture rows to a part-file. Do not return the rows in your final message — write to disk only.

Inputs:
- Read .posthog-events-inventory.json once. The "rows" array contains base rows with id, file, line, raw_match, event_name_hint.
- Process only rows whose id is in this list: {{ROW_IDS}}.

For each assigned row, read its file ONCE (cache by file path; multiple rows in the same file share one Read). For each row, produce an enriched row with these fields:

- id, file, line — copy from the base row
- sdk — one of posthog-js, posthog-node, posthog-python, posthog-ruby, posthog-go, posthog-ios, posthog-android, posthog-react-native, posthog-flutter, posthog-php, posthog-dotnet, posthog-elixir
- call_kind — one of capture, identify, set, set_once, group, alias, reset
- event_name — the literal string in the event-name slot (resolve from the full call expression, not just the grep line). For dynamic names (variable, template literal, expression), set null and is_dynamic: true.
- is_dynamic — true if event_name couldn't be resolved to a literal
- properties — array of property keys from the properties argument (object literal / dict / hash). Empty array if the call passes a variable; empty array for non-capture call_kinds.
- conditional_fire — true if the call sits inside an if/ternary/guard that depends on something other than user identity
- distinct_id_kind — server-side SDKs only: "variable" | "literal" | "missing". null for client-side rows.
- area — codebase bucket from the file path (rules below)
- route — Next.js route if applicable, otherwise null
- enclosing — nearest enclosing function/component name from a backward scan
- status — "pending"
- volume_30d — null
- last_seen — null

Skip $pageview and $pageleave from the SDK — they are SDK-internal except in rare manual setups. If a base row's raw_match shows $pageview/$pageleave, drop it (don't emit a row in your part-file).

When you have all enriched rows, Write .posthog-events-inventory.part-{{N}}.json with a JSON array of the rows (no wrapper object, just [...]). Pretty-print with two-space indent.

Final message: respond with exactly one line — "wrote part-{{N}} with M rows" — where M is the count. Do NOT include the rows in your message. Do NOT recap. Just the one line.

Reference: per-SDK signatures, identification surfaces, area/route/enclosing rules are in the parent skill file at .claude/skills/events-audit/references/2-scan.md (sections "Reference: per-SDK signatures" through "Reference: enclosing"). Read that file once if you need them.
```

### f. Wait for all subagents to return

Each subagent returns a single confirmation line. Verify each part-file exists before phase 3:

```
Bash: for n in 1 2 ... N; do test -f .posthog-events-inventory.part-$n.json || echo "MISSING: part-$n"; done
```

If any part-file is missing, the subagent failed. Re-dispatch only the failed subagent with the same row-id slice. Don't re-run successful subagents.

## Phase 3 — Concat via jq

### g. Merge part-files into the canonical inventory

One `Bash` call:

```
jq -s '{rows: (add | sort_by(.file, .line)), wrapper_undetected: false}' .posthog-events-inventory.part-*.json > .posthog-events-inventory.json && rm .posthog-events-inventory.part-*.json
```

This:
- Slurps every part-file as an array of arrays
- `add` flattens to a single rows array
- `sort_by(.file, .line)` produces a stable, readable order
- Wraps in `{rows, wrapper_undetected}`
- Overwrites the base inventory with the enriched one
- Cleans up part-files

The orchestrator never has to materialize the merged JSON in a model turn — `jq` does the merge in shell, costing zero output tokens.

If `jq` isn't available on the user's system, fall back to a Bash one-liner using `cat` + `python3 -c`:

```
python3 -c "import json,glob; rows=[]
[rows.extend(json.load(open(f))) for f in sorted(glob.glob('.posthog-events-inventory.part-*.json'))]
rows.sort(key=lambda r: (r['file'], r['line']))
json.dump({'rows': rows, 'wrapper_undetected': False}, open('.posthog-events-inventory.json','w'), indent=2)" && rm .posthog-events-inventory.part-*.json
```

Don't try to merge in a model turn. That's the rule that crashed the previous run.

## Reference: per-SDK signatures

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

## Reference: identification surfaces

The scanner records (with `call_kind` set accordingly):

- `posthog.identify(distinctId, $set, $set_once)` → `identify`
- `posthog.setPersonProperties({ ... })` → `set`
- `posthog.setPersonPropertiesForFlags` → `set_once`
- `posthog.group(type, key, properties)` → `group`
- `posthog.alias(alias, distinctId)` → `alias`
- `posthog.reset()` → `reset` (no event name; the identity check uses presence to score cross-device hygiene)

## Reference: `area` rules

Strip a single leading `src/`, `app/`, `pages/`, or `apps/<name>/` (monorepo). Then apply the first matching rule:

| Path shape after stripping | `area` |
|---|---|
| `app/<x>/...` (Next.js app router) | `<x>` |
| `pages/<x>/...` (Next.js pages router) | `<x>` (use `api/<seg>` for `pages/api/<seg>/...`) |
| `components/<x>/...` | `<x>` |
| `features/<x>/...` | `<x>` |
| `screens/<x>/...` | `<x>` (mobile) |
| `routes/<x>/...`, `views/<x>/...`, `controllers/<x>/...` (backend) | `<x>` |
| `hooks/...`, `lib/...`, `utils/...`, `analytics/...`, `services/...`, `helpers/...` | `shared` |
| `app/layout.tsx`, `app/template.tsx`, `_app.tsx`, `_document.tsx`, `app/error.tsx`, `app/not-found.tsx` | `global` |
| Anything else | first path segment after stripping, lowercased |

Strip only the first matching prefix.

## Reference: `route` rules (Next.js only)

- `app/foo/page.tsx` → `/foo`
- `app/foo/bar/page.tsx` → `/foo/bar`
- `app/foo/[id]/page.tsx` → `/foo/[id]`
- `app/(group)/foo/page.tsx` → `/foo` (route groups in parens are ignored)
- `pages/foo.tsx` → `/foo`
- `pages/foo/[id].tsx` → `/foo/[id]`
- `pages/api/<rest>` → `/api/<rest>` (without the file extension)

Set `route: null` for any path that isn't router-shaped.

## Reference: `enclosing` rules

Backward-scan from the capture line. Match these patterns (first match wins above the capture line):

- `function (\w+)\(` (named function)
- `const (\w+) = \(?` / `const (\w+) = async`
- `export (?:default )?function (\w+)\(`
- `export const (\w+) = `
- `class (\w+)`
- `def (\w+)\(` (Python)
- `func (\w+)\(` (Go / Swift)
- `fun (\w+)\(` (Kotlin)
- `def (\w+)` (Ruby)

Take the closest match above the capture line at column 0 or one indent level deeper than the capture's expected wrapper. If nothing matches within ~80 lines above, set `enclosing: null`. Don't read more file context to chase it.

For unnamed default exports (`export default function () { ... }`), use the file's basename without extension as the enclosing name (e.g. `CheckoutPage`).

## Notes on wrapper resolution

This step intentionally does **not** chase wrapper functions (`trackEvent`, `analytics.track`, etc.). Cross-file wrapper resolution doesn't fit cleanly in row-range subagent fan-out, and the reframing principle is "let the PM ask follow-ups."

If `wrapper_undetected: true` (SDK in deps but no direct calls found), the report step's data-quality check surfaces it, and the suggested-follow-ups list points the PM at: *"find calls to `trackEvent`/`logEvent`/`analytics.track` and resolve their callers as additional capture sites."*
