---
next_step: 5-verify.md
---

# Step 4: Apply source-code fixes

This step applies every remaining `auto-fix` plan item by editing project source, using parallel subagents — one per edit group. It does NOT run the project's verify command (step 5) and does NOT write the report (step 6). The plan is at `/tmp/posthog-remediation-plan.json`. Dependency items were finished in step 3 — only `status: "planned"` items remain in scope.

## Status

Emit:

```
[STATUS] Planning edit groups
[STATUS] Applying code fixes
```

## Action

### a. Compute edit groups

Read the plan. Take every item with `status: "planned"`. Group them so that **items sharing any file land in the same group** (connected components over the `files` lists — a multi-file fix keeps all its files in one group). This guarantees no two subagents ever edit the same file, so they can run concurrently without conflicts.

### b. Dispatch one subagent per group in a single message

Make one `Agent` tool call per group, **all in a single message** so they run concurrently. Wait for all of them to return; do not run any other tool between dispatch and collection.

Each subagent's `description`: `Remediate <first item id>`. Each subagent's `prompt` — fill in the `<>` placeholders with the group's items copied out of the plan (id, severity, files, summary, and the **full** `recommendation` text including code blocks):

```
You are a remediation subagent. Apply these fixes to the project source and return: <comma-separated item ids>.

Fixes (extracted from the remediation plan — do not read the audit report or the plan file yourself):

<for each item: ### <id> (<severity>) — files: <files> — <summary> — followed by the full recommendation text>

Rules:
- Read each target file before editing it. The audit's snippets and line numbers were written against an earlier read of the file and may have drifted — anchor every edit on the actual code, not on line numbers. Adapt the recommended snippet to the file's current style (quotes, semicolons, import ordering).
- Apply error items first, then warnings, then suggestions.
- Edit only the files listed for your items. Touching an unlisted file is allowed only when the recommendation explicitly describes it (e.g. adding a header to the client call-site that a server route now reads).
- When removing PII from event properties: remove only the named PII keys; keep the remaining properties and the capture call itself unless the recommendation says to delete the whole call.
- When removing a duplicate event: delete exactly the capture call the recommendation names; leave the surviving event untouched.
- When renaming an event: rename every occurrence in source (captures, tests, comments referencing the event name), and nothing else.
- Never run git commands, never install packages, never create new files unless the recommendation explicitly requires one.
- If a fix cannot be applied safely (the code moved, the recommendation conflicts with the file's current state, or two of your items contradict each other), do not guess — report that item as failed with a one-line reason and move on.

Return exactly one line per item: <id> fixed|failed — <what changed, file:line | reason>.
```

### c. Update the plan

After all subagents return, read the plan, set each item's `status` to `fixed` or `failed` and its `notes` to the subagent's one-liner, and write the file back in full.

## Output

Every previously-`planned` item has a terminal `fixed`/`failed` status in the plan. Finish by emitting:

```
[STATUS] Code fixes applied: <N> fixed, <M> failed
```
