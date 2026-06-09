---
type: plan-capture
label: Plan which events to capture
model: claude-sonnet-4-6
skills: [plan-capture]
allowedTools: [Read, Glob, Grep]
disallowedTools: [Write, Edit, Bash, enqueue_task]
dependsOn: [install, init]
---

## Goal

Decide which events are worth capturing in this app. Read the code to find the
meaningful user actions — the things a product team would want to measure — and
hand off that list. Do not edit code.

## How you know you succeeded

Your handoff is a short, concrete event plan: a handful of named events, each
tied to a real user action and the file where it happens. Prefer a few
high-signal events over an exhaustive list.
