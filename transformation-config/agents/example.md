---
type: example
model: claude-haiku-4-5-20251001
skills: []
allowedTools: [Read, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: []
---

## Goal

This is the canonical example of an agent prompt, the WHAT of an orchestrator
task. The frontmatter carries the artifacts the executor configures the run
with: the model, the mini-skills to load (the HOW), the tools the task may and
may not use, and the tasks it depends on. The body is intent only — what to do
and what done looks like. The client injects the basics (project context, how to
report, how to surface progress), so a prompt never restates them.

## How you know you succeeded

Plain-text success criteria live here. State what done looks like, and what to do
when the task cannot be completed.
