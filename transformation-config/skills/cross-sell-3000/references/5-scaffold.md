---
next_step: 6-verify.md
---

# Step 5: Scaffold the planned integrations

This step applies every `planned` item by editing project source, using parallel subagents — one per edit group. It does NOT run the project's verify command (Step 6) and does NOT write the report (Step 7). The plan is at `/tmp/posthog-cross-sell-plan.json`; the toolchain is at `/tmp/posthog-cross-sell-env.json`.

## Status

Emit:

```
[STATUS] Grouping scaffolds
[STATUS] Scaffolding viable products
```

## Action

### a. Compute edit groups

Read the plan. Take every item with `status: "planned"`. Group them so that **items sharing any file land in the same group** (connected components over each item's `plan.files`). No two subagents will edit the same file, so groups run concurrently without conflict. If no items are `planned`, emit `[STATUS] No scaffolds to apply` and continue.

### b. Dispatch one subagent per group in a single message

Make one `Agent` call per group, **all in a single message**, each on `model: "sonnet"` — scaffolding edits real code, so don't drop below sonnet, and never go above it. Wait for all to return; run no other tool between dispatch and collection.

Each subagent's `description`: `Scaffold <first item id>`. Each subagent's `prompt`, filling `<>` with the group's items copied out of the plan (id, product, and the full `plan` block — files, approach, snippet):

```
You are a cross-sell scaffolding subagent. Apply these PostHog integrations to the project source and return: <comma-separated item ids>.

Integrations (copied from the plan — do not read the plan file yourself):

<for each item: ### <id> — <product> — approach: <approach> — files: <plan.files> — snippet: <plan.snippet>>

Rules:
- Read each target file before editing it. Anchor on the actual current code and adapt the snippet to the file's style (quotes, semicolons, imports). Line numbers in the plan may have drifted — match on code.
- Keep each scaffold minimal and reversible: feature-gate or clearly comment the addition (a brief `// PostHog <product> — scaffolded by cross-sell` marker is good). Default to the project's existing behavior when a flag/exception path is undefined.
- Each item's plan is a single illustrative example (one file). Apply exactly that one change — do not extend it to the other call sites; the report tells the operator to replicate.
- Edit only the files in your items' plans. Create a new file only when the plan's `files` lists it as new.
- If a plan requires an official PostHog package that isn't installed, add it to the dependency manifest with a caret range. Do NOT install it yourself and never add a non-PostHog dependency. Report which package you added so the orchestrator can install once.
- Do not create example/demo routes, placeholder flags wired to nothing, or speculative code beyond the plan.
- If a scaffold can't be applied cleanly (the surface moved, the snippet conflicts with current code), do not guess — report that item as failed with a one-line reason.

Return one line per item: <id> scaffolded|failed — <what changed, file:line | reason> [+pkg:<package> if you added one].
```

### c. Install any added PostHog packages

If any subagent reported adding a PostHog package to the manifest, run the env file's `install_cmd` once from `project_root`. If the install fails, note it on the affected items (Step 6 will catch the resulting build break).

### d. Update the plan

Read the plan, set each item's `status` to `scaffolded` or `failed` and its `notes` to the subagent's one-liner, and write the file back in full.

## Output

Every previously-`planned` item is now `scaffolded` or `failed`. Finish by emitting:

```
[STATUS] Scaffolded: <N> products, <M> failed
```
