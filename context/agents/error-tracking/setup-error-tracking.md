---
type: setup-error-tracking
flow: error-tracking
seed: true
model_pi: openai/gpt-5.6-terra
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: []
allowedTools: [Read, Glob, Grep, posthog_exec]
disallowedTools: [Write, Edit, Bash, complete_task]
dependsOn: []
---

## Goal

Plan a PostHog Error Tracking setup and seed the task queue. The end state:
errors the app does not catch reach PostHog, and — where the platform ships
minified bundles or stripped binaries — production builds upload the source
maps or debug symbols that make the stack traces readable.

First establish two facts from the repo:

**1. Is PostHog already integrated?** Look for `posthog-js` or a server SDK in
the dependency manifests, or a `posthog.init(...)` / snippet in the source.
Check the project state for existing events if the repo is ambiguous.

**2. Which uploader variant is this project — or none?** Read the manifests
and pick at most one, by this precedence (first match wins):

- `pubspec.yaml` → `flutter`
- an `.xcodeproj`, `Podfile`, or `Package.swift` → `ios`
- a Gradle build file (`build.gradle`, `build.gradle.kts`, `settings.gradle`) → `android`
- `go.mod` → `go`
- `Cargo.toml` → `rust`
- `astro` in `package.json` dependencies → **none**. Astro is not supported by
  the uploader: it inlines scripts below its asset limit into the HTML, so a
  build routinely emits a `.map` with no `.js` beside it, and the upload step
  then fails the whole build. This rule wins over every `package.json` match
  below — an Astro project that also depends on `vite` is still **none**.
- otherwise read `package.json` dependencies, first match wins:
  `react-native` → `react-native`; `nuxt` → `nuxt`; `next` → `nextjs`;
  `@angular/core` → `angular`; `vite` → `vite`; `webpack` → `webpack`;
  `rollup` → `rollup`; `react` → `react`; server-only Node → `node`;
  any other browser JS → `web`
- **none** for platforms whose stack traces are already readable: plain
  Python (Django, Flask, FastAPI), Ruby, PHP, Elixir, JVM servers, .NET.
  Skip the whole upload subgraph for them — a skipped upload on such a
  platform is an outcome, not a gap.

When a variant matched, the uploader skill id is
`error-tracking-upload-source-maps-<variant>`. Pass it to the four upload
tasks as `inputs: { skillId: "<id>", displayName: "<human platform name>" }`
so no task re-detects.

The two facts are independent — settle BOTH before you enqueue anything.
"PostHog is already integrated" answers fact 1 only; it never decides fact 2,
and an already-integrated project still gets the upload subgraph when a
variant matches. A compiled or bundled JS project normally has one: a Node
service built with `tsc` ships minified/compiled output, so it is the `node`
variant, not "none". Only two kinds of project skip the subgraph — the
readable-stack platforms listed above, and Astro.

Then seed the graph:

- `install` and `init`, independent of each other — **only when PostHog is
  not integrated**. Do not stop on an uninstrumented repo, integrate.
- `capture-exceptions`, after `install` and `init` (with no dependencies when
  PostHog was already integrated).
- When an uploader variant matched, add the upload subgraph:
  - `credentials`, no dependencies — it stops to ask the user for a personal
    API key, so keep it a root task: the prompt reaches the user early while
    the code tasks run.
  - `configure`, after `capture-exceptions` — build-config changes; it runs
    after the code edits so the two never fight over the same files.
  - `wire-ci`, after `configure` and `credentials`.
  - `test-setup`, after `wire-ci` — offers the user a local end-to-end test
    last, once everything is wired.
- `report`, after every other queued task. It writes the handoff last, so it
  describes what actually shipped.

Never plan an identify, capture, dashboard, or session-replay task — this run
sets up error tracking, not the full integration. The minimal SDK footprint
that `install` and `init` leave behind is enough for exceptions to flow.

## How you know you succeeded

Every task in the chosen graph is queued with that dependency shape, the four
upload tasks (when queued) share the same `{ skillId, displayName }` inputs,
`report` depends on the rest (directly or transitively), and the first task is
runnable. Your plan states both facts explicitly: whether PostHog was
integrated, and which uploader variant matched — or, when you queue no upload
tasks, why no variant applies: which readable-stack platform this is, or that
Astro is not supported by the uploader. A
plan that never mentions fact 2 is an incomplete plan, not a decision. Keep
labels short — the action in a few words.
