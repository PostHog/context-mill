---
title: Write the side-car report
next_step: null
---

# Step 7, write the side-car report

The report comes from `.posthog-sidecar-plan.md`. Nothing is invented.

## Status

```
[STATUS] Writing side-car report
```

Read the plan file. Write `posthog-side-car-report.md` at the project root with the structure below, then delete `.posthog-sidecar-plan.md`.

<wizard-report>
# PostHog side-car report

[1–2 sentences: which vendor is bridged, where the plugin is registered, and the verify outcome.]

## Bridged vendor

`<vendor>`, initialized at `<file>:<line>`. Other vendors found and not bridged: <list, or none>.

## Files added or changed

| File | Change |
|------|--------|

## What reaches PostHog

- Custom events: every `<vendor>` event call, with the same name and properties, plus `$sidecar_source: '<vendor>'`.
- Identity: [one line per identity call the plugin forwards for this vendor, from the vendor reference].
- Automatic events: [the PostHog init options set in Step 2]. The vendor's own automatic events are not forwarded.

## Calls that stay vendor-only

Every row from the plan's unsupported table, as `file:line — call — why`. If none, write `_Every vendor call in this project has a PostHog equivalent._`

## How to check it

1. Run the app with the PostHog env vars set.
2. Trigger one custom event and one identify.
3. In PostHog, open Activity and filter on `$sidecar_source`.

## Manual follow-ups

Numbered list: every `warning` or `error` phase line with its note, server-side vendor SDKs found in Step 1, and the verify failure if there was one. If none, write `_Nothing to follow up on._`

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code.

</wizard-report>

After the report is written, emit:

```
Created side-car report: <absolute path to posthog-side-car-report.md>
```
