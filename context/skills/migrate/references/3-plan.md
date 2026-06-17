---
title: Plan the migration
next_step: 4-replace.md
---

# Step 3, plan every call site replacement

The plan covers two things. Every existing source SDK call site, paired with the PostHog equivalent it should become. And, if the source SDK already identifies users on login or signup, the matching `posthog.identify()` call.

This is a faithful port. Do not plan new captures, new flag evaluations, or new instrumentation surfaces. If the source captured three events, the plan covers three events.

Before you start, scan the project for any `posthog.capture`, `posthog.identify`, or `posthog.init` code the integration skill in Step 2 may have added. Step 4 must not duplicate them.

## Status

Emit each of these as you start the matching sub task.

```
[STATUS] Reading variant mapping reference
[STATUS] Locating source-SDK call sites
[STATUS] Locating identification opportunities
[STATUS] Writing migration plan
```

## Read the mapping reference

Open `references/mapping.md` and learn its API surface, the call shapes it covers, and the PostHog equivalent it records next to each.

## Enumerate call sites

Search the project for the patterns named in the variant reference. For each match, read the surrounding code so you understand the call's intent, then decide its PostHog equivalent from the mapping reference. Do not invent mappings. Do not fetch external docs.

For each call site, record its file and line, a short verbatim snippet of the original, and the PostHog equivalent. If a call shape is not covered by the mapping reference, set its status to `warning` and leave it for the report.

## Cover existing identification

If the source SDK identifies users at login or signup today, plan a matching `posthog.identify()` at the same place. Pull the user id or email from the form the source SDK already uses. When both client and server code exist, plan to forward the client distinct id and session id to the server via the `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` headers.

If the source SDK does not identify users today, do not add identification here. Note the gap for the report's manual follow ups.

## Write the plan file

Write `.posthog-migration-plan.md` at the project root with two sections.

A phase checklist with one line per phase, in this order: `install`, `plan`, `replace`, `cleanup`, `verify`. Use the markdown task syntax. Tick the `install` line with the outcome you carried over from Step 2. Tick the `plan` line as pass once the file is written. Leave the rest unchecked, later steps tick them.

```
- [x] install — <pass|error> — <integration skill id, or error reason>
- [x] plan — pass
- [ ] replace
- [ ] cleanup
- [ ] verify
```

A sites table with one row per call site, in this column order.

```
| file | line | from | to | status | notes |
```

Start each row at `pending`, unless you marked it `warning` for an unmappable call shape.

If the project has no call sites in source code, write the file with the phase checklist and an empty sites table. Step 4 becomes a no op, Step 5 still removes the package.

## Rules

Do not edit project source in this step. Only the plan file is written. No WebFetch. The mapping reference is the only source of truth for replacements.

Continue to `4-replace.md`.
