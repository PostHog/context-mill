---
title: Attach identity to every record
next_step: 6-verify.md
---

# Step 5, attach the identity to every log record

One change, applied once, that enriches every record the project emits. A codebase with two hundred log statements should come out of this step with two hundred correlated log statements and roughly one new file.

The two attribute names are exact. PostHog reads `posthogDistinctId` to link a record to a person and `sessionId` to link it to a session replay. Both are camelCase. A misspelling produces a record that arrives, looks fine, and links to nothing.

## Status

Emit these as you work.

```
[STATUS] Adding correlation to the logging pipeline
[STATUS] Checking log call sites are covered
```

## Attach in one place

Use the mechanism the plan named, reading identity from the context you built in Step 4.

**Python.** Add a `logging.Filter` and attach it to the OTel `LoggingHandler` from Step 2. A filter runs on every record passing through the handler, and setting an attribute on the record makes it available to the handler downstream. Read the context var, set `posthogDistinctId` and `sessionId` on the record when they are present, and always return `True` so the filter never drops a record.

This is the whole reason Step 2 attached the handler to the root logger. Every `logging` call in the project already flows through it, so a filter there reaches all of them, including logs from third party libraries, without a single call site changing.

**Next.js.** The OTel logger takes attributes per `emit` call, so the equivalent single point is a thin wrapper around the logger. Export a logger from one module, have it resolve identity and merge the two attributes into whatever the caller passed, then delegate to the underlying OTel logger. Callers pass their own attributes exactly as before.

Merge, do not overwrite. If a caller passes attributes of their own, keep them and add to them.

## Degrade quietly

Identity will be absent sometimes, on a background job, on an anonymous request, during startup. That is normal and it is the `person` and `none` tiers working as designed.

Omit an attribute entirely when its value is missing. Do not attach `undefined`, `null`, `"undefined"`, or an empty string. A record with no `sessionId` is a record PostHog treats as unlinked, which is correct. A record with `sessionId: "undefined"` is a record that looks linked, and is not.

Attachment must never throw. A logging call that raises because identity lookup failed turns an observability improvement into an outage. Wrap the lookup so that any failure results in a record without correlation attributes, and never in a raised exception.

## Next.js, leave the Edge surfaces alone

`middleware.ts`, and any route declaring `export const runtime = 'edge'`, run on the Edge runtime rather than the Node runtime that holds the provider from Step 2. Importing the provider into one of them pulls the OTel SDK into the Edge bundle, and since the batch processor exports on a timer, the invocation ends before anything is flushed. This compiles, it reads correctly in review, and the records quietly never arrive.

Do not emit log records from these surfaces. Record them on the plan as a `warning` at tier `none` with a one line reason, the same as any other call site the shared mechanism cannot reach, and let Step 7 report them.

## Cover the call sites

With the shared mechanism in place, confirm it actually reaches the surfaces in the plan.

Check a request scoped surface and a detached one. For each, follow the code from the log statement to the attachment point and satisfy yourself the record really passes through it.

Some call sites will not be covered by the shared mechanism, most often bare `console.log` in a project that otherwise uses a logger, or a library configured with its own transport. Do not rewrite these one by one. Record them on the plan as a `warning` with the file and a one line reason, and let Step 7 report them as follow ups.

If a surface's real tier turns out lower than Step 3 predicted, update the row. The plan is a working document, and the report is only as honest as the plan it comes from.

## Rules

Do not add new log statements to prove the mechanism works. Step 6 emits exactly one test record.

Do not change log levels, messages, or formats.

Do not edit more than a couple of individual call sites. If it takes more than that, the shared mechanism is in the wrong place; go back and move it.

## Update the plan file

Edit `.posthog-logs-plan.md`. Update each surface row's `tier`, `status`, and `notes`. Then tick the `attach` phase line with the worst outcome across the rows: error if any row errored, warning if any warned and none errored, pass otherwise.

```
- [x] attach — <pass|warning|error> — <one line summary>
```

Continue to `6-verify.md`.
