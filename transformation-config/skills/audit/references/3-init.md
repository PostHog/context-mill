# Step 3 — Locate init sites

This step has exactly one action: find the PostHog init site for each runtime. No evaluation, no resolving — that happens in Step 5.

## TodoWrite

Update the in-progress task's `activeForm` to `Locating PostHog initialization`. Status and content stay the same.

## Action

For each runtime present in the manifest scan from Step 2:

1. Run **one** `Grep` with this exact regex: `posthog\.init\(|new PostHog\(|<PostHogProvider`.
2. The first matching file per runtime is the canonical init site. `Read` it. Stop searching.

Identify, capture, and flag patterns are out of scope here — they belong to later steps. Do not Grep for `usePostHog`, `posthog.identify`, `posthog.capture`, or anything else.

## Status

Status to report in this phase:

- Locating init sites

