---
next_step: 4-query.md
---

# Step 3 – Enrich capture sites (subagent fan-out)

For each row in the base inventory, read the source file once and produce the full enrichment fields: `sdk`, `call_kind`, `properties`, `conditional_fire`, `distinct_id_kind`, `package`, `area`, `route`, `enclosing`. Also retroactively resolve `event_name` for any row step 2 left dynamic (Pattern A: same-file constant inlining; Pattern B: same-file enum dispatch).

**This is the only step that `Read`s source files.** Step 2 worked from grep output alone; step 3 owns all file I/O. Subagent enrichment fans out across files in parallel, so the orchestrator never materializes the full enriched JSON in a single model turn — that crashed prior runs at `max_tokens`.

The step has three phases:

1. **Phase 1 — orchestrator structural pass.** Decide partition based on distinct file count.
2. **Phase 2 — subagent enrichment fan-out.** All subagents dispatched in **one assistant turn**. Each subagent enriches a slice of rows and writes a part-file.
3. **Phase 3 — orchestrator concat via `jq`.** A single Bash call merges part-files into the canonical inventory.

## Tools

Load `Read`, `Write`, and `Bash` via `ToolSearch select:Read,Write,Bash` once at the start of this step. Load `Agent` only inside Phase 2 if fan-out is needed (see partition rules below).

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
