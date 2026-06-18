# Agent prompts

One `<type>.md` per orchestrator task — the WHAT of the task. The frontmatter
carries the artifacts the executor configures the run with: the model, the
mini-skills to load (the HOW), the tools the task may and may not use, and the
tasks it depends on. `flow` names the program the agent belongs to — the
wizard's registry is scoped per flow, so audit or migration agents live
alongside these — and one prompt per flow is marked `seed: true`: the planner
that seeds the queue, not an enqueueable task type.

The body is intent only — what to do and what done looks like. The client
injects the basics (project context, how to report, how to surface progress),
so a prompt never restates them.

This README is documentation, not data: the build serves every other `.md` in
this folder as an agent prompt.

```markdown
---
type: example
flow: my-flow
model: claude-haiku-4-5-20251001
skills: []
allowedTools: [Read, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: []
---

## Goal

What this task does, in plain prose.

## How you know you succeeded

Plain-text success criteria live here. State what done looks like, and what to
do when the task cannot be completed.
```
