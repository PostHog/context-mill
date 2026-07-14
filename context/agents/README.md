# Agent prompts

One `<flow>/<type>.md` per orchestrator task — the WHAT of the task. The folder
is the flow: the wizard's registry is scoped per flow, so audit or migration
agent sets get sibling folders. The frontmatter carries the artifacts the
executor configures the run with: the model, the mini-skills to load (the HOW),
the tools the task may and may not use, and the tasks it depends on. `flow`
repeats the folder name so the file stays self-describing on disk (the build
rejects a mismatch), and one prompt per flow is marked `seed: true`: the
planner that seeds the queue, not an enqueueable task type.

`model` is a gateway model id, not a runner binding — the wizard's switchboard
routes it, and its CLI/flag rungs may override it per run. `allowedTools` /
`disallowedTools` use the wizard's tool vocabulary; the executing harness maps
them to its native tool names.

The body is intent only — what to do and what done looks like. The client
injects the basics (project context, how to report, how to surface progress),
so a prompt never restates them. Frontmatter stays flat: scalars and inline
`[a, b]` arrays only, the wizard's parser is deliberately not a YAML engine.

This README is documentation, not data: the build serves every other `.md`
under a flow folder as an agent prompt.

Each agent names its model per harness profile — `model_pi`/`effort_pi` for the
gpt (pi) run and `model_sdk`/`effort_sdk` for the anthropic (sdk) run — so the
same flow benchmarks either provider. The mapping is not 1:1: a light task can be
luna on pi but sonnet on sdk. Effort is optional and overrides the model default.

```markdown
---
type: example
flow: my-flow
model_pi: openai/gpt-5.6-luna
effort_pi: low
model_sdk: claude-haiku-4-5-20251001
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
