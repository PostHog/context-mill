# Set up PostHog Replay vision

Use this skill to set up **Replay vision** for a user's product: make sure session replay is actually recording, then create vision scanners tailored to this product's key flows. A scanner is an LLM that watches one session recording at a time and writes an observation - a score, a tag, or a summary - and every observation lands as a queryable PostHog event.

The run has two halves, and both matter:

1. **Recordings must flow.** Scanners only see what session replay records, so the server-side recording toggle must be on and the client init must not cancel it.
2. **Scanners must be tailored.** You are the only actor that has read this repo. A scanner scoped to *this* product's completion flow is worth ten generic ones.

The mechanics live in dedicated step skills - install each one with `install_skill` when its step begins, and follow it:

| skill id | owns |
| --- | --- |
| `replay-vision-enable-replay` | making session replay record (both halves) |
| `replay-vision-scanners-core` | scanner create/update mechanics, sizing, collisions, security ground rules |
| `replay-vision-scanner-broken-experiences` | the breakage monitor brief |
| `replay-vision-scanner-user-frustration` | the frustration monitor brief |
| `replay-vision-scanner-session-summaries` | the summary scanner brief |

### Abort cases

If anything blocks the whole run, **always** emit exactly one `[ABORT] <reason>` line and stop - never halt silently. Use one of:

- `[ABORT] replay vision not available for this project` - every scanner endpoint 404s (see STEP 3).
- `[ABORT] <short specific reason>` - anything else that blocks the run. Keep it short and specific.

A missing single tool, a 403 on one call, or an org near its quota are **not** aborts - they are recorded follow-ups (see the steps).

## Instructions

Follow these steps IN ORDER.

### STEP 1: Read the project and the repo

Emit `[STATUS] Reading project state`.

- From the project state / MCP tools, note: is session replay recording on, does the project have recordings, and what scanners already exist (`vision-scanners-list` via the PostHog `exec` tool).
- From the repo: is PostHog integrated (`posthog-js` / a server SDK in the dependency manifests, a snippet, or events in the project state)? **If it is not, do not stop** - install and initialize the SDK first, following the `integration-v2-install` and `integration-v2-init` skills (install each with `install_skill`). The minimal SDK footprint they leave behind is enough for recordings to flow; skip identify, capture, and dashboards - this run sets up Replay vision, not the full integration.
- Find the `posthog.init(...)` call if this is a web app, and identify **this product's key completion flow** - checkout, signup, booking, publish, whatever this product's "done" is - by reading router files and page/route directories. Never guess at `/checkout` if this app calls it `/booking`.

### STEP 2: Make sure session replay records

Emit `[STATUS] Enabling session replay`.

Install and follow `replay-vision-enable-replay`. Pure backend or mobile app with no web surface: nothing records browser sessions here. Say so, record it as a follow-up, and continue - scanner creation may still be skipped in STEP 4 for the same reason.

### STEP 3: Load the scanner mechanics and size before you ship

Emit `[STATUS] Preparing scanners`.

Install and follow `replay-vision-scanners-core`. It owns loading the authoritative `creating-replay-vision-scanners` skill, the size-before-you-ship credit gut-check, the endpoint-availability fallbacks, and the collision and security ground rules that apply to every scanner.

### STEP 4: Create the scanners

Emit `[STATUS] Creating scanners`.

Create three scanners, one brief each, in this order:

1. `replay-vision-scanner-broken-experiences` - the completion-flow breakage monitor.
2. `replay-vision-scanner-user-frustration` - the `$rageclick` frustration monitor.
3. `replay-vision-scanner-session-summaries` - the sampled summarizer.

Install each skill, fill the blanks its brief names from the repo, and create with `vision-scanners-create` - `replay-vision-scanners-core` owns what is locked and how re-runs match. Reuse STEP 1's scanner inventory for the re-run check instead of listing again. Don't invent extra scanners.

Per-scanner notes:

- **No identifiable completion flow** for scanner 1: don't invent one - fall back to the handful of highest-traffic paths, and record that you couldn't identify a completion flow.
- **Not a web app**: skip scanner 1; keep scanners 2 and 3 only if the product has any recorded web sessions at all. Skipping all three on a pure backend project is a correct outcome - record why.
- Any failure on one scanner: handle it as `replay-vision-scanners-core` says, record the follow-up, and continue with the next. One failure never stops the step.

### STEP 5: Report and hand off

Emit `[STATUS] Wrapping up`.

Write the report to `./posthog-replay-vision-report.md` (the wizard shows this file at the end of the run), then summarize it for the user. Cover, briefly and concretely:

- What is now recording (or the follow-up needed to make it record).
- Each scanner created or updated: its name, what it watches, its query scope, and its estimated monthly credit spend.
- Anything skipped or deferred, with the reason.
- Where results appear: the Replay vision page in PostHog, with the first observations arriving as new recordings complete.
