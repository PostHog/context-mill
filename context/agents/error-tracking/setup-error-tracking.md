---
type: setup-error-tracking
flow: error-tracking
seed: true
model_pi: openai/gpt-5.6-terra
effort_pi: medium
model_sdk: claude-sonnet-5
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

Integrated means the init runs, not that the package is listed. An init point
is a pair: the call, and the key it is constructed from. A repo can carry the
call while the key it names is defined nowhere — then the client is built from
an empty string and captures nothing, however complete the manifest looks. So
when you find an init that reads a variable, look for that same name in the
repo's committed env template or its build config. Found, or the project state
shows real events arriving: integrated. Named nowhere, or you cannot tell:
**queue `init`**. It re-checks the pair itself and leaves a complete init
alone, so queuing it when you are unsure costs one cheap task, while skipping
it on a keyless init costs the whole run.

**2. Which uploader variant is this project — or none?** Read the manifests
and pick at most one, by this precedence (first match wins):

- `react-native` or `expo` in `package.json` dependencies → `react-native`.
  A React Native repo also carries `ios/Podfile`, an `.xcodeproj` and Gradle
  files for its native shells, so this rule wins over every native marker
  below. Picking `ios` or `android` for it uploads no JavaScript source maps,
  and every JavaScript stack trace stays minified.
- `pubspec.yaml` → `flutter`
- an `.xcodeproj`, `Podfile`, or `Package.swift` → `ios`
- a Gradle build file that applies `com.android.application` or
  `com.android.library`, or an `AndroidManifest.xml` → `android`. A Gradle
  project without these markers is a JVM server: keep reading.
- `go.mod` → `go`
- `Cargo.toml` → `rust`
- `astro` in `package.json` dependencies → **none**. Astro is not supported by
  the uploader: it inlines scripts below its asset limit into the HTML, so a
  build routinely emits a `.map` with no `.js` beside it, and the upload step
  then fails the whole build. This rule wins over every `package.json` match
  below — an Astro project that also depends on `vite` is still **none**.
- otherwise read `package.json` dependencies, first match wins:
  `nuxt` → `nuxt`; `next` → `nextjs`;
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

- `install`, only when the SDK is missing from the manifest.
- `init`, independent of `install` — whenever fact 1 did not show a complete
  pair. Do not stop on an uninstrumented repo, integrate.
- `capture-exceptions`, after whichever of `install` and `init` you queued
  (with no dependencies when you queued neither).
- When an uploader variant matched, add the upload subgraph:
  - `credentials`, no dependencies — it stops to ask the user for a personal
    API key, so keep it a root task: the prompt reaches the user early while
    the code tasks run.
  - `configure`, after `capture-exceptions` — build-config changes; it runs
    after the code edits so the two never fight over the same files.
  - `wire-ci`, after `configure` and `credentials`.
- `report`, after every other queued task except `test-setup`. It writes the
  handoff once the work is done, so it describes what actually shipped.
- When you queued the upload subgraph, `test-setup` last, after `report` — it
  offers the user an optional local end-to-end test. The report comes first on
  purpose: a user who walks away still gets it. Queue `report` before
  `test-setup`, because `test-setup` names `report` as its dependency.

Never plan an identify, capture, dashboard, or session-replay task — this run
sets up error tracking, not the full integration. The minimal SDK footprint
that `install` and `init` leave behind is enough for exceptions to flow.

## How you know you succeeded

Every task in the chosen graph is queued with that dependency shape, the four
upload tasks (when queued) share the same `{ skillId, displayName }` inputs,
`report` depends on every other task except `test-setup` (directly or
transitively), `test-setup` (when queued) depends on `report`, and the first
task is runnable. Your plan states both facts explicitly: whether PostHog was
integrated — and, when you called it integrated, the name of the key you found
defined — and which uploader variant matched — or, when you queue no upload
tasks, why no variant applies: which readable-stack platform this is, or that
Astro is not supported by the uploader. A
plan that never mentions fact 2 is an incomplete plan, not a decision. Keep
labels short — the action in a few words.
