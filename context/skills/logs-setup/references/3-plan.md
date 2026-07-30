---
title: Plan the correlation
next_step: 4-context.md
---

# Step 3, decide how far correlation can go

Correlation needs two values on each record: `posthogDistinctId`, which links the log to a person, and `sessionId`, which links it to a session replay. This step works out where each of them can come from in this codebase, and commits to a tier per surface.

Be honest here rather than optimistic. Steps 4 and 5 build exactly what this plan says, and Step 7 reports it. A plan that claims an identifier it cannot actually reach produces wiring that attaches `undefined` and a report that lies.

## Status

Emit these as you start each sub task.

```
[STATUS] Mapping log emitting surfaces
[STATUS] Tracing identity to log call sites
[STATUS] Choosing correlation tier
[STATUS] Writing correlation plan
```

## Enumerate the surfaces that emit logs

A surface is a coherent place logs come from, not an individual call. Route handlers, server actions, background workers, scheduled jobs, CLI entry points, and middleware are each a surface.

Group them by how a request reaches them, because that determines what identity is available.

- **Request scoped surfaces** run inside an HTTP request. They can see headers and the authenticated session, so they can reach the `session` tier.
- **Detached surfaces** are background jobs, queue consumers, cron tasks, and startup code. No request, therefore no headers and usually no user. They land at `person` if the job knows whose work it is doing, and `none` otherwise. This is expected. Do not contort a worker into faking a session.

## Decide where each value comes from

For `posthogDistinctId`, prefer the authenticated user id you found in Step 1. Fall back to the `X-POSTHOG-DISTINCT-ID` request header for anonymous traffic. The header is set by the browser and is therefore client controlled, so it must never outrank a server known identity.

For `sessionId`, use the `X-POSTHOG-SESSION-ID` request header. There is no server side alternative; the session id belongs to the browser.

Before you commit to either, prove the value actually arrives. Read the code path that will really run and confirm the id is present in the shape that code sees. Frameworks routinely withhold the user id from the object a handler receives, an allow-list on a serialized model, a session callback returning only name and email. Where the id is missing, plan to expose it deliberately at its source. Never substitute an email and never plan to pass a value that can be `undefined`.

If the client does not send the headers yet, that is not a blocker. Step 4 configures the client to send them.

## Choose the tier per surface

Assign each surface `session`, `person`, or `none`, using the definitions in `SKILL.md`. Record why. A one line reason on a `none` surface is what makes the report useful.

The whole project's tier is the best tier its request scoped surfaces reach. Detached surfaces do not drag it down.

## Write the plan file

Write `.posthog-logs-plan.md` at the project root with two sections.

A phase checklist with one line per phase, in this order: `install`, `plan`, `context`, `attach`, `verify`. Use the markdown task syntax. Tick the `install` line with the outcome you carried over from Step 2, and record the region on it. Tick the `plan` line as pass once the file is written. Leave the rest unchecked, later steps tick them.

```
- [x] install — <pass|warning|error> — region <us|eu>, provider in <file>
- [x] plan — pass
- [ ] context
- [ ] attach
- [ ] verify
```

A surfaces table with one row per surface, in this column order.

```
| surface | kind | distinct id source | session id source | tier | status | notes |
```

`kind` is `request` or `detached`. Start each row at `pending`.

Record the project wide decisions underneath the table as a short list, because Steps 4 and 5 need them and should not have to re-derive them: the file that will hold the identity context, the mechanism it uses, the file where the client SDK is initialized, and the single place where attributes will be attached.

If no surface can reach beyond `none`, still write the plan. The export from Step 2 is real value on its own, and Step 7 reports the gap with something concrete for the operator to do about it.

## Rules

Do not edit project source in this step. Only the plan file is written. No WebFetch.

Continue to `4-context.md`.
