---
next_step: 3-report.md
---

# Step 2 — Locate and fix the producing code

`1-triage.md` wrote a prioritized worklist to `.posthog-ingestion-warnings.json`. This step works through that list, fixes the code behind each firing warning, and updates each entry's `status`. It does **not** write the final report — `3-report.md` owns that.

## Tools

`Grep`, `Read`, `Edit`, `Write`, and `Bash` are already available. Load any deferred one by exact name with `ToolSearch select:<name>`.

## Status

`Read` `.posthog-ingestion-warnings.json` once. For each warning you work on, emit:

```
[STATUS] Fixing <type>
```

## How to work the list

For each `warnings[]` entry with `status: "pending"`, in list order:

1. Find its catalog entry below by matching the `type` string. If the project's `type` doesn't exactly match a heading (codes vary across PostHog versions), match on the closest **title / description** instead.
2. Run the catalog's **Locate** grep(s). If you find no producing code in this checkout, set the entry's `status` to `"not-found"`, add a one-line `note`, and move on — do not guess.
3. Apply the **Fix** with the smallest edit that removes the cause (tenets 1, 2, 4 in the entry-point file). Preserve existing behavior.
4. Update that entry in `.posthog-ingestion-warnings.json`: set `status` to `"fixed"`, `"partial"`, or `"needs-manual"`, and add `file` (`path:line`) and a one-sentence `details`. Re-`Write` the whole file after each entry so progress survives.

A `type` with no catalog match: set `status: "needs-manual"`, record the `type` and an example payload in `details`, and move on. `3-report.md` surfaces it.

---

## Catalog

### `cannot_merge_with_illegal_distinct_id` — Refused to merge with an illegal distinct ID
**Cause:** `identify()` or `alias()` was called with a generic / illegal distinct id — `null`, `undefined`, `"null"`, `"guest"`, `"anonymous"`, `"distinct_id"`, `"true"`, `"0"`, an email literal like `"email"`, etc. PostHog refuses the merge to avoid collapsing unrelated users.
**Locate:** `Grep` for `posthog\.identify\(|posthog\.alias\(|\.identify\(|\.alias\(`. Inspect the **first argument** at each call site.
**Fix:** Pass a real, stable per-user identifier (the value the app already uses as the logged-in user id). Remove `identify` calls that fire before a real user exists (e.g. on a logged-out landing page). If the id genuinely isn't in scope, thread it from a caller that has it; never substitute a placeholder (tenet 3). See https://posthog.com/docs/getting-started/identify-users

### `cannot_merge_already_identified` — Refused to merge an already identified user
**Cause:** `identify()` (or `alias()`) tried to merge a user that is **already identified** into another identity — typically `identify()` called on every page load / in an effect with a changing id, calling `identify` with a new id after login without `reset()` on the previous session, or aliasing two already-identified people.
**Locate:** `Grep` for `posthog\.identify\(|posthog\.reset\(|posthog\.alias\(`. Flag `identify` calls inside `useEffect`, render bodies, route middleware, or per-request handlers.
**Fix:** Call `identify()` exactly once, at the moment the user authenticates, with a consistent id. Call `posthog.reset()` on logout so the next user starts clean. Don't re-identify an already-identified user with a different id. See https://posthog.com/docs/getting-started/identify-users

### `skipping_event_invalid_uuid` — Refused to process event with invalid UUID
**Cause:** Events are sent with a manually-supplied event `uuid` that isn't a valid UUID, so they're dropped.
**Locate:** `Grep` for `uuid` near `capture(` calls (capture options object).
**Fix:** Stop passing a custom `uuid` — let PostHog generate it. There are very few legitimate reasons to set the event UUID yourself; if one applies, ensure it's a valid v4/v7 UUID string.

### `ignored_invalid_timestamp` — Ignored an invalid timestamp, event was still ingested
**Cause:** A `timestamp` (or `sent_at`) passed on capture isn't valid ISO 8601, so PostHog ignores it and stamps its own server time — skewing when the event appears.
**Locate:** `Grep` for `timestamp` and `sent_at` near `capture(` calls (common in `posthog-node` / batch backends).
**Fix:** Send timestamps as ISO 8601 strings (`new Date().toISOString()` / `datetime.now(timezone.utc).isoformat()`), or omit the field and let PostHog set it at ingest. Don't pass epoch numbers or locale-formatted strings.

### `event_timestamp_in_future` — An event was sent more than 23 hours in the future
**Cause:** An instrumentation bug — usually a wrong `sent_at`/`offset` calculation or a client with a badly-skewed clock. These events are stored but hidden from the UI, and new persons get a future "first seen".
**Locate:** `Grep` for `timestamp`, `sent_at`, `offset` near capture/batch code; check any custom time-offset logic.
**Fix:** Correct the timestamp/offset computation so events carry the real send time. If you depend on client clocks, prefer omitting `timestamp` and letting the server stamp it.

### `message_size_too_large` — Discarded event exceeding the 1MB limit
**Cause:** A single event exceeds 1MB after processing — almost always one or more oversized properties (full API responses, base64 blobs, giant arrays, serialized DOM), or an installed transformation/app that enriches events.
**Locate:** `Grep` for large property assignments on capture calls — `JSON.stringify`, `base64`, `...response`, whole-object spreads into `capture(` properties.
**Fix:** Send only the fields you need. Replace blobs with ids/lengths/hashes, truncate large strings, drop embedded payloads. If a transformation app inflates events, trim it there. Keep events well under 1MB.

### Ingestion overflow — Event ingestion has overflowed capacity
**Cause:** Far more events than the main pipeline expects are arriving for a **single `distinct_id`** — typically a loop or retry storm capturing the same event, or all traffic sharing one hard-coded distinct id. Events are still ingested via a slower overflow path.
**Locate:** `Grep` for `capture(` inside loops, intervals, retry handlers, or hot code paths; check for a constant/hard-coded distinct id reused for everyone.
**Fix:** Remove the duplicate/looping capture or debounce it. Ensure each user gets their own distinct id rather than a shared constant.

### `replay_timestamp_invalid` / `replay_timestamp_too_far_in_future` — Replay event timestamp problems
**Cause:** A session-replay event carried an invalid timestamp, or one more than 7 days in the future (usually a skewed device clock or a tampered/old replay setup). The replay event is dropped.
**Locate:** `Grep` for `session_recording`, `disable_session_recording`, `posthog-js` version in the lockfile/`package.json`.
**Fix:** Upgrade `posthog-js` to a recent version and don't hand-construct replay payloads. If device clocks are the cause, it's environmental — note it for the report rather than editing app code.

### `$set` / `$set_once` on exception events — Invalid set operations on exception events
**Cause:** `$set` or `$set_once` person properties were attached to `$exception` events (e.g. passed into `captureException`). They're ignored on exception events.
**Locate:** `Grep` for `captureException\(|capture\(['"]\$exception` and inspect for `$set`/`$set_once` in the properties.
**Fix:** Remove `$set`/`$set_once` from exception capture. Set person properties on a normal event (or `identify`) instead.

### `invalid_heatmap_data` — Invalid heatmap data
**Cause (most common, fixable):** `$current_url` is sent as a **relative path** (`/dashboard`) instead of an absolute URL (`https://app.example.com/dashboard`). Heatmap processing requires an absolute URL, so it warns on every affected `$pageview`. The classic source is a custom pageview capture (e.g. Next.js App Router building `$current_url` from `usePathname()` alone). **Other cause:** a hand-constructed or modified `$heatmap_data` property.
**Locate:** `Grep` for `\$current_url` and `\$heatmap_data`. Inspect any manual `$pageview` capture that sets `$current_url`.
**Fix:** Make `$current_url` absolute — prepend the origin, e.g. `window.location.origin + pathname` (or `window.location.href`) instead of the bare path. Never hand-build `$heatmap_data`; rely on a recent `posthog-js`. The event still ingests, but heatmaps stay broken until the URL is absolute.

---

When every entry has a non-`pending` status and the scratch file is saved, continue to **`3-report.md`**.
