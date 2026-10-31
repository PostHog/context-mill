---
title: Workflow graph schema
description: The workflow shape the wizard accepts, a strict subset of PostHog's
---

# Workflow graph schema

A workflow is a list of `actions` (the steps) and `edges` (the arrows between
them). PostHog's editor checks every action against a strict shape. A step that
does not match breaks the editor for the whole workflow, so treat these shapes
as required.

## The workflow body

```json
{
  "name": "Welcome new users (wizard)",
  "description": "One line on what it does.",
  "exit_condition": "exit_on_conversion",
  "conversion": {
    "events": [{ "filters": { "events": [{ "id": "project_created", "name": "project_created", "type": "events" }] } }],
    "filters": [],
    "window": "14d"
  },
  "trigger_masking": { "hash": "{person.id}", "ttl": 2592000 },
  "actions": [],
  "edges": []
}
```

- `name` — ends with ` (wizard)`, so the user can find it in the list.
- `exit_condition` — `exit_on_conversion` with a `conversion` goal, or
  `exit_only_at_end` when there is no goal.
- `conversion.events` — the goal event. An event goal goes in `events`, never in
  `filters`. `window` is a duration up to `365d`.
- `trigger_masking` — optional. `{person.id}` fires the workflow once per
  person within `ttl` seconds (60 to 94608000).
- Never send `id`, `status`, `trigger`, or `bytecode`. PostHog sets them.

## Actions

Every action has an `id` (unique in the workflow), a `name`, a `description`, a
`type`, and a `config`:

```json
{ "id": "email_welcome", "name": "Welcome email", "description": "", "type": "function_email", "config": {} }
```

Use only these six types.

### `trigger` — exactly one

```json
{
  "id": "trigger_node",
  "name": "User signed up",
  "description": "",
  "type": "trigger",
  "config": {
    "type": "event",
    "filters": {
      "events": [{ "id": "user_signed_up", "name": "user_signed_up", "type": "events", "order": 0 }]
    }
  }
}
```

### `delay`

```json
{ "id": "delay_1", "name": "Wait 1 day", "description": "", "type": "delay", "config": { "delay_duration": "1d" } }
```

### `wait_until_condition`

Waits for an event, up to `max_wait_duration`.

```json
{
  "id": "wait_project",
  "name": "Wait for first project",
  "description": "",
  "type": "wait_until_condition",
  "config": {
    "events": [{ "filters": { "events": [{ "id": "project_created", "name": "project_created", "type": "events" }] }, "name": "Created a project" }],
    "max_wait_duration": "3d"
  }
}
```

It needs two outgoing edges: a `branch` edge with `index: 0` for "the event
happened", and a `continue` edge for "the wait ran out".

### `conditional_branch`

Splits on **person properties only**. Event filters are rejected here.

```json
{
  "id": "branch_plan",
  "name": "On a paid plan?",
  "description": "",
  "type": "conditional_branch",
  "config": {
    "conditions": [{ "filters": { "properties": [{ "key": "plan", "value": ["pro"], "operator": "exact", "type": "person" }] }, "name": "Paid" }]
  }
}
```

The `filters` wrapper is required. Condition `N` leaves on the `branch` edge
with `index: N`. The `continue` edge is the "no condition matched" path.

### `function_email`

```json
{
  "id": "email_welcome",
  "name": "Welcome email",
  "description": "",
  "type": "function_email",
  "config": {
    "template_id": "template-email",
    "inputs": {
      "email": {
        "value": {
          "to": { "email": "{{ person.properties.email }}", "name": "" },
          "from": { "email": "", "name": "" },
          "subject": "Welcome to Acme",
          "text": "Hi {{ person.properties.first_name | default: \"there\" }},\n\n..."
        }
      }
    }
  }
}
```

- `template_id` is the literal string `template-email`.
- `to.email` is always `{{ person.properties.email }}`.
- `from` is always `{ "email": "", "name": "" }`. Never set `integrationId`.
- `subject` and `text` are required. Templates use Liquid.

### `exit`

```json
{ "id": "exit_node", "name": "Exit", "description": "", "type": "exit", "config": { "reason": "Done" } }
```

## Edges

```json
{ "from": "trigger_node", "to": "email_welcome", "type": "continue" }
{ "from": "wait_project", "to": "exit_node", "type": "branch", "index": 0 }
```

- `continue` — the next step in sequence, the timeout path of a wait, or the
  no-match path of a branch.
- `branch` — needs `index`. It is the "matched" path of a wait (`index: 0`) or
  of branch condition `index`.
- Every action except `exit` needs an outgoing edge.

## Durations

`delay_duration`, `max_wait_duration`, and `conversion.window` match
`^\d*\.?\d+[dhms]$`, such as `30m`, `2h`, `1d`. Per-unit caps are clamped
without an error: `m` up to 60, `h` up to 24, `d` up to 30. Use the larger unit.
