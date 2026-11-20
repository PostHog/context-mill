# {display_name}

This skill adds a PostHog side-car to a project that already sends analytics to Amplitude, Mixpanel, Segment or Heap. The side-car is a small plugin registered on the vendor SDK. It sees every call the app makes to that SDK and replays it into posthog-js: custom events, identify, person properties, super properties, groups, alias and reset. The vendor SDK keeps working exactly as before, so the team can compare both tools and cut over later.

The side-car bridges one vendor per project. When a project uses several, the operator picks one, so each action reaches PostHog once.

## Workflow

The side-car runs as a 7 step chain.

1. Find the supported vendor SDKs and pick the one to bridge (`references/1-detect.md`).
2. Install and initialize posthog-js, and turn on the PostHog equivalents of the vendor's automatic events (`references/2-install-posthog.md`).
3. Plan where the side-car files go and record it in `.posthog-sidecar-plan.md` (`references/3-plan.md`).
4. Write the shared side-car core module (`references/4-core.md`).
5. Write the vendor plugin and register it after the vendor initializes (`references/5-plugin.md`).
6. Verify the project still builds (`references/6-verify.md`).
7. Write the side-car report and delete the plan file (`references/7-report.md`).

Each step file points to the next via `next_step` frontmatter. Read them in order, one at a time. Do not preload future steps. Do not re-read a step file once you have moved past it.

## Task list

**Before you do anything else**, make a single call to `TaskCreate` to seed the task pane with the seven items above (one per step, in order). Use job-oriented titles such as "Find analytics vendors", "Install PostHog", "Plan side-car files", "Write side-car core", "Write vendor plugin", "Verify build", "Write report".

Then, and only then, read `references/1-detect.md` and start the chain.

Use `TaskUpdate` to mark items `in_progress` when you start them and `completed` when you finish.

## References

Besides the step files, the skill ships these references. Read one only when a step tells you to.

- `references/sidecar-core.md`: the canonical core module.
- `references/vendor-amplitude.md`, `references/vendor-mixpanel.md`, `references/vendor-segment.md`, `references/vendor-heap.md`: one per vendor. Each lists the SDK's package names, init shapes, the PostHog settings that replace its automatic events, the canonical plugin, and the vendor's identity quirks.

Everything you need is on disk. Do not WebFetch vendor docs.

## User decision points

Call `mcp__wizard-tools__wizard_ask` when a step needs the operator to choose. The tool shows a modal in the wizard UI, blocks until the operator answers, and returns the answers keyed by question id. Do not ask in plain chat.

## Live activity

Emit `[STATUS] <short phrase>` lines whenever you start a new sub task. Each step file names the status phrases it expects.

## Outcome statuses

Mark each phase in the plan file as one of these.

- `pass`, the step completed cleanly.
- `warning`, the step completed but the operator should look at it.
- `error`, the step failed and you could not auto recover.

## Key principles

Add, do not replace. Never edit, move or delete an existing vendor call site. The side-car only adds files and registers one plugin next to the vendor's init code.

The plugin must never break the vendor. Every handler catches its own errors, returns the vendor payload unchanged, and never blocks or drops a vendor event. A Mixpanel hook that returns `undefined` drops the event, so Mixpanel hooks always return their arguments.

Convert directly. Event names and property keys go to PostHog as they are. Do not rename events, add a mapping table, or invent new events.

Do not forward the vendor's automatic events, such as page views, sessions, click or form autocapture. Turn on the PostHog equivalents in the posthog-js init instead.

Do not opt out of PostHog's default SDK behavior. Never set `autocapture: false`, `capture_pageview: false`, `disable_session_recording: true` or similar.

Keep PostHog keys in environment variables. Never hardcode them.

Keep edits minimal. Preserve surrounding code, formatting and imports.

Do not commit. The operator reviews the diff and commits when ready.

## Abort statuses

Emit `[ABORT] <reason>` and stop when an abort case fires. The wizard catches these and ends the run.

- `[ABORT] No supported analytics SDK found`, when Step 1 finds no Amplitude, Mixpanel, Segment or Heap integration in browser code.
- `[ABORT] Several analytics SDKs found`, when Step 1 finds more than one vendor and cannot ask the operator.

## Framework guidelines

{commandments}
