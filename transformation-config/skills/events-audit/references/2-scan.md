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

## Supporting files

This step uses two supporting reference files (not part of the chain):

- `references/2-scan-subagent-prompt.md` — verbatim subagent prompt template. Orchestrator reads it once at phase 2 start, substitutes `{{N}}` and `{{ROW_IDS}}`, passes the result to each `Agent` invocation.
- `references/2-scan-enrichment.md` — per-SDK call signatures, identification surfaces, `area` / `route` / `enclosing` rules. Subagents read it once during enrichment; the orchestrator does not.

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

Read `references/2-scan-subagent-prompt.md`, then substitute:

- `{{N}}` — the partition number for that subagent (`1`, `2`, ..., up to N)
- `{{ROW_IDS}}` — JSON array of the row IDs assigned to that subagent

The substituted text is the full prompt for that subagent.

**Spawn all N sub-agents in parallel using the `Agent` tool — one assistant turn, N tool_use blocks in the same message.** Sequential dispatch (one Agent per turn) loses ~30s of orchestration latency for no reason; the prior diagnostic confirmed this. Batch them.

Set `run_in_background: false` — you want their results before the merge.

### e. Wait for all subagents to return

Each subagent returns a single confirmation line (`"wrote part-N with M rows"`). Verify each part-file exists before phase 3:

```
Bash: for n in 1 2 ... N; do test -f .posthog-events-inventory.part-$n.json || echo "MISSING: part-$n"; done
```

If any part-file is missing, the subagent failed. Re-dispatch only the failed subagent with the same row-id slice. Don't re-run successful subagents.

## Phase 3 — Concat via jq

### f. Merge part-files into the canonical inventory

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

If `jq` isn't available on the user's system, fall back to a Bash one-liner using Python:

```
python3 -c "import json,glob; rows=[]
[rows.extend(json.load(open(f))) for f in sorted(glob.glob('.posthog-events-inventory.part-*.json'))]
rows.sort(key=lambda r: (r['file'], r['line']))
json.dump({'rows': rows, 'wrapper_undetected': False}, open('.posthog-events-inventory.json','w'), indent=2)" && rm .posthog-events-inventory.part-*.json
```

Don't try to merge in a model turn. That's the rule that crashed the previous run.

## Notes on wrapper resolution

This step intentionally does **not** chase wrapper functions (`trackEvent`, `analytics.track`, etc.). Cross-file wrapper resolution doesn't fit cleanly in row-range subagent fan-out, and the reframing principle is "let the reader ask follow-ups."

If `wrapper_undetected: true` (SDK in deps but no direct calls found), the report step's data-quality check surfaces it, and the suggested-follow-ups list points the reader at: *"find calls to `trackEvent`/`logEvent`/`analytics.track` and resolve their callers as additional capture sites."*
