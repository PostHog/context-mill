---
next_step: 4-query.md
---

# Step 3 – Enrich capture sites (subagent fan-out)

For each row in the base inventory, read its file once and produce the full enrichment fields: `sdk`, `call_kind`, `properties`, `conditional_fire`, `distinct_id_kind`, `package`, `area`, `route`, `enclosing`. Also retroactively resolve `event_name` for rows step 2 left dynamic (Pattern A: same-file constant inlining; Pattern B: same-file enum dispatch).

Preserve `via_wrapper` from the base row unchanged. For `via_wrapper != null` rows, look up the alias in the inventory's top-level `wrapper_aliases` to assign `sdk` — wrapper call sites look like ordinary function calls, so the syntax-based heuristic doesn't apply.

Subagent enrichment fans out across files in parallel; the orchestrator never materializes the full enriched JSON in a single model turn.

## Output discipline

**Don't re-emit the enriched JSON in assistant text before `Write`.** Build rows in memory, `Write` the part-file, reply with the single-line confirmation. The merge runs in shell via `jq`/`python3`.

The step has three phases:

1. **Phase 1 — orchestrator structural pass.** Decide partition based on distinct file count.
2. **Phase 2 — subagent enrichment fan-out.** All subagents dispatched in **one assistant turn**. Each subagent enriches a slice of rows and writes a part-file.
3. **Phase 3 — orchestrator concat via `jq`.** A single Bash call merges part-files into the canonical inventory.

## Tools

Load `Read`, `Write`, and `Bash` via `ToolSearch select:Read,Write,Bash` once at the start of this step. Load `Agent` only inside Phase 2 if fan-out is needed (see partition rules below). `mcp__wizard-tools__audit_resolve_checks` is already loaded from step 1.

## Supporting files

This step uses two supporting reference files (not part of the chain):

- `references/3-enrich-subagent-prompt.md` — verbatim subagent prompt template. Orchestrator reads it once at phase 2 start, substitutes `{{N}}` and `{{ROW_IDS}}`, passes the result to each `Agent` invocation.
- `references/3-enrich-reference.md` — per-SDK call signatures, identification surfaces, `package` / `area` / `route` / `enclosing` rules. Subagents read it once during enrichment; the orchestrator does not.

## Status

Emit, in order:

```
[STATUS] Spawning sub-agents for synthesis
[STATUS] Enriching capture sites
[STATUS] Merging part-files
```

## Phase 1 — Decide the partition

`Read` `.posthog-events-inventory.json` once. If `rows[]` is empty, skip phases 2 and 3 entirely and continue to step 4.

Count distinct files in the base inventory.

- **≤ 8 distinct files**: skip fan-out. The orchestrator handles enrichment inline (one subagent's worth of work; the merge is small). Read each file directly, apply the subagent enrichment rules from `3-enrich-reference.md`, and write a single part-file `.posthog-events-inventory.part-1.json`. Then proceed to phase 3.

  Emit `[STATUS] Enriching file N of M` after each file Read so the spinner stays live.
- **> 8 distinct files**: fan out. `N = ceil(files / 10)`, capped at 8. Round-robin assign files alphabetically to N groups; each group's row-id list is what the subagent receives. Don't bother estimating file sizes — the orchestrator's job is dispatch, not load-balancing.

## Phase 2 — Spawn N sub-agents in parallel

Load `Agent` once: `ToolSearch select:Agent`.

Read `references/3-enrich-subagent-prompt.md`, then substitute:

- `{{N}}` — the partition number for that subagent (`1`, `2`, ..., up to N)
- `{{ROW_IDS}}` — JSON array of the row IDs assigned to that subagent

The substituted text is the full prompt for that subagent.

**Spawn all N sub-agents in parallel using the `Agent` tool — one assistant turn, N tool_use blocks in the same message.** Sequential dispatch (one Agent per turn) loses ~30s of orchestration latency for no reason. Batch them.

Set `run_in_background: false` — you want their results before the merge.

### Wait for all subagents to return

Each subagent returns a single confirmation line (`"wrote part-N with M rows"`). Verify each part-file exists before phase 3:

```
Bash: for n in 1 2 ... N; do test -f .posthog-events-inventory.part-$n.json || echo "MISSING: part-$n"; done
```

If any part-file is missing, the subagent failed. Re-dispatch only the failed subagent with the same row-id slice. Don't re-run successful subagents.

## Phase 3 — Concat via jq

One `Bash` call:

```
EXCEPTION_SITES=$(jq -c '.exception_sites // []' .posthog-events-inventory.json)
WRAPPER_ALIASES=$(jq -c '.wrapper_aliases // []' .posthog-events-inventory.json)
jq -s --argjson es "$EXCEPTION_SITES" --argjson wa "$WRAPPER_ALIASES" '{rows: (add | sort_by(.file, .line)), exception_sites: $es, wrapper_aliases: $wa, wrapper_undetected: false}' .posthog-events-inventory.part-*.json > .posthog-events-inventory.json.tmp && mv .posthog-events-inventory.json.tmp .posthog-events-inventory.json && rm .posthog-events-inventory.part-*.json
```

This:
- Preserves `exception_sites` and `wrapper_aliases` from the base inventory (step 2 wrote them; the part-files only carry enriched rows)
- Slurps every part-file as an array of arrays
- `add` flattens to a single rows array
- `sort_by(.file, .line)` produces a stable, readable order
- Wraps in `{rows, exception_sites, wrapper_aliases, wrapper_undetected}`
- Overwrites the base inventory with the enriched one
- Cleans up part-files

The orchestrator never has to materialize the merged JSON in a model turn — `jq` does the merge in shell, costing zero output tokens.

If `jq` isn't available on the user's system, fall back to a Bash one-liner using Python:

```
python3 -c "import json,glob
base = json.load(open('.posthog-events-inventory.json'))
rows = []
[rows.extend(json.load(open(f))) for f in sorted(glob.glob('.posthog-events-inventory.part-*.json'))]
rows.sort(key=lambda r: (r['file'], r['line']))
json.dump({'rows': rows, 'exception_sites': base.get('exception_sites', []), 'wrapper_aliases': base.get('wrapper_aliases', []), 'wrapper_undetected': False}, open('.posthog-events-inventory.json','w'), indent=2)" && rm .posthog-events-inventory.part-*.json
```

Don't merge in a model turn — the merge happens in shell.

## Resolve the phase

Once the merged `.posthog-events-inventory.json` is in place, flip the `enrich-sites` row to `pass`:

```json
{
  "updates": [
    { "id": "enrich-sites", "status": "pass" }
  ]
}
```

Continue to step 4.
