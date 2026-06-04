# Upload source maps to PostHog for {display_name}

This skill helps you upload source maps (or platform debug symbols) so PostHog Error Tracking can resolve minified stack traces back to your original source.

## Reference files

{references}

The overview lists every supported framework and build tool. The CLI reference covers `posthog-cli sourcemap inject` and `posthog-cli sourcemap upload`.

## Steps

The stages of wiring up source map upload, in order. Each step has a short overview, gotchas under **Tips**, and per-technology notes under **Examples**. The reference files above are the source of truth for the exact, per-framework API — when this page and a reference disagree, follow the reference for {display_name}.

### Get a personal API key

Source map upload authenticates with a **personal API key**, not the public project API key the SDK uses at runtime. The key needs error-tracking write access; the quickest path is the "Source map upload" preset on PostHog's personal API keys settings page.

#### Tips
- The public project key (the one in your SDK `init`) will **not** work for uploads — it has no write scope for symbol sets.
- Never hardcode the key in source. It belongs in an environment variable read at build time (see "Write credentials to the env file").
- Keys can't be minted programmatically — create them by hand in PostHog settings, then store the value as a secret.

### Apply build-config changes

Wire source map generation, chunk-ID injection, and upload into your **production build** so every deploy ships matching maps. Depending on the platform this is either a build/bundler plugin, or a pair of `posthog-cli sourcemap inject` + `posthog-cli sourcemap upload` steps run after the build. Follow the {display_name} reference for the exact wiring.

#### Tips
- If you wire `posthog-cli` directly (no framework or bundler plugin), generating the maps is **your** responsibility — the CLI only injects chunk IDs into, and uploads, maps your build already produced. Two things must be true before `posthog-cli sourcemap inject` works:
  - Source maps are emitted next to your output bundles (e.g. `.js.map` files).
  - The maps include `sourcesContent` (the original source embedded inside the map). Without it PostHog has the line/column mappings but not the code, so traces can't be fully resolved.
- **Inject before deploy**: the *injected* bundles must be the ones shipped to production. Bundles missing the `//# chunkId=…` comment can't be matched to uploaded maps.
- Wire injection + upload into the build itself (plugin, post-build script, or CI step) — manual uploads drift from deployed code.
- **Don't ship source maps publicly**: omit `.map` files from the deployed artifact, or use hidden source maps. Uploaded maps live in PostHog, not on your origin.

#### Examples
- **Node / tsc** Emit maps with embedded sources by setting both in `tsconfig.json`: `"sourceMap": true` and `"inlineSources": true`. Then run `posthog-cli sourcemap inject` followed by `posthog-cli sourcemap upload` against the build output dir as post-build steps.
- **Vite / Webpack / Rollup** Prefer the bundler plugin from the reference over hand-rolling the CLI — it injects and uploads in one pass. Make sure the bundler is configured to emit source maps.
- **Next.js / Nuxt / Angular** Use the framework's documented source-map upload integration from the reference; these own their build pipeline, so configure upload there rather than bolting on a separate CLI step.
- **React Native / Android / iOS / Flutter** You upload platform debug symbols (Hermes maps, ProGuard/R8 mappings, dSYMs) rather than plain `.js.map` files — follow the platform reference for the exact build hook.

### Make credentials available at build time

The upload credentials must be readable **by the build pipeline at build time**, not merely present in a `.env` file. Whether `.env` is auto-loaded depends on the technology.

#### Tips
- **Auto-loads `.env`**: Next.js, Nuxt and similar frameworks read `.env` into the build for you — nothing extra to do.
- **Vite is a partial exception**: it auto-loads `.env` into `import.meta.env` for client code (only `VITE_`-prefixed vars), but does **not** put vars in `process.env` for your config to read. The upload credentials (`POSTHOG_*`, not `VITE_`-prefixed) are read when the plugin is constructed, so load them yourself — see the Vite example below.
- **Does NOT auto-load `.env`**: Rollup, plain webpack, and plain Node scripts. Load it explicitly — add `dotenv` (`require('dotenv').config()`, or `import 'dotenv/config'` for ESM) at the top of the bundler/config file.
- **Separate-process gotcha**: if upload runs as its own `package.json` step (e.g. `posthog-cli sourcemap upload` after the bundler), that CLI is a **separate child process** and will *not* see env vars a loader set inside the bundler config. Point the CLI at the file directly: `posthog-cli --dotenv-file <relative-path> sourcemap upload …`.

#### Examples
- **Next.js / Nuxt** Auto-load `.env` at build time; put the vars there and you're done.
- **Vite** Export `vite.config` as a function and merge `loadEnv` into `process.env` so the config (and the PostHog plugin) can read the upload credentials. Pass `''` as the third arg so non-`VITE_` vars like `POSTHOG_API_KEY` are included — the default `'VITE_'` prefix skips them:
  ```ts
  import { defineConfig, loadEnv } from 'vite';

  export default ({ mode }) => {
    process.env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };
    // process.env.POSTHOG_API_KEY is now readable by the plugins below
    return defineConfig({
      plugins: [/* … posthog source map plugin … */],
    });
  };
  ```
- **Rollup / webpack / plain Node** Add `import 'dotenv/config'` (or `require('dotenv').config()`) at the top of the config/entry file so the loader runs before the build reads the vars.
- **Standalone posthog-cli step** Pass `--dotenv-file .env` to the CLI so it reads the credentials itself instead of relying on the parent process's environment.

### Write credentials to the env file

Write the personal API key and project identifiers into the env file your build reads. Reuse the file the project already uses — don't introduce a second one.

#### Tips
- Picking the file: if an env file already contains PostHog vars (`POSTHOG_*` / `NEXT_PUBLIC_POSTHOG_*`), use that one. Otherwise, if exactly one env file exists use it; if several exist prefer `.env`. Only create a new file when none exists.
- Variable names depend on which uploader you wired:
  - `posthog-cli` direct upload → `POSTHOG_CLI_API_KEY`, `POSTHOG_CLI_PROJECT_ID`, `POSTHOG_CLI_HOST`
  - bundler-plugin variants → `POSTHOG_API_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_HOST`
- Set the `*_HOST` var when you're not on US Cloud's default (e.g. EU Cloud or self-hosted); setting it explicitly always is safe. Follow the reference for the variant.
- In CI/CD, set the same vars as secrets — never commit the key.

### Identify the build and run commands

Resolve two concrete commands for this project: the production **build** command (the one that uploads source maps) and the **run** command that launches the built app (so a test error can be triggered against the real artifact).

#### Tips
- Resolve real commands from the project's actual scripts/config — substitute the correct package manager. Never leave a generic "start the app".
- When a build artifact is involved, prefer the command that serves the *production* build over the dev server.

#### Examples
- **Next.js** Build: `npm run build` (`next build`). Run: `npm run start` (`next start`).
- **Vite** Build: `npm run build`. Run: `npm run preview`.
- **Plain Node** Build: `npm run build`. Run: `node <built entry>` — read package.json `main`/`bin` and the build output dir to name the real file (e.g. `node dist/index.js`).
- **Android** Build: `./gradlew assembleRelease`. Run: launch on a device/emulator (Android Studio, or `./gradlew installRelease`).
- **iOS** Build: `xcodebuild …`. Run: launch the scheme on a simulator/device (Xcode).
- **Flutter** Build: `flutter build apk` / `flutter build ios`. Run: `flutter run`.
- **React Native** Run: `npx react-native run-ios` / `npx react-native run-android`.

### Test the local setup

Optionally add a temporary, clearly-labeled affordance that captures one test exception, so you can confirm errors arrive in Error Tracking with a source-resolved stack trace after the next production build. Always remove it afterwards.

#### Tips
- The handler must call the SDK's exception-capture method **directly** — do **not** `throw`. Throwing depends on the global error handler and shows a dev overlay; a direct capture is deterministic across platforms.
- Pass a single Error (or platform-equivalent throwable). No custom message beyond the Error, no extra properties, no second argument — the Error's stack trace is what gets resolved.
- Use distinctive copy on the trigger (button label / route path) so the resulting event is easy to find in the UI.
- Read any file before editing it and capture its exact contents; after testing, restore every touched file and re-read to confirm nothing is left behind. Never leave the affordance in place — even if the test "didn't work", revert first.
- The upload only happens on the *production build*: build, run, trigger the error, then confirm the stack trace in Error Tracking points at real source files, not minified bundle paths.

#### Examples
- **Browser / SPA / SSR (web, react, nextjs, nuxt, angular, vite, webpack, rollup)** Add a button such as "Test PostHog Error Tracking" on the home/root page whose onClick calls `posthog.captureException(new Error("PostHog source maps test"))`.
- **Node.js** Add a temporary route (e.g. `GET /__posthog-test-error`) on the existing server that calls `posthog.captureException(new Error("PostHog source maps test"))` and returns 200. With no HTTP layer, add the capture to the existing entry script where the client is initialised rather than creating a new file. Tell the user the exact command/URL to hit.
- **React Native** Add a visible `Button` on the main screen whose onPress calls `posthog.captureException(new Error("PostHog source maps test"))`.
- **Android (Kotlin)** Add a `Button` on the launcher Activity whose onClick captures a `Throwable` via the PostHog SDK, per the reference.
- **iOS (Swift)** Add a `UIButton` on the root view controller whose action captures an `NSError` via the PostHog SDK, per the reference.
- **Flutter** Add an `ElevatedButton` on the home widget whose onPressed calls `Posthog().captureException(Exception("PostHog source maps test"))`.

### Verify and hand off

Confirm the upload landed and report what changed.

#### Tips
- Source maps upload during the **production build** — the build must actually run for a symbol set to appear.
- Verify in PostHog Error Tracking settings on the **Symbol sets** page: a new symbol set should appear after the build completes.
- When handing off, list the files you edited (paths only), the env-var **key** names you set (never values), whether a test affordance was added and reverted, and the exact build command to run.

## General tips
- The reference files for {display_name} are authoritative — if this page and a reference disagree on an API, follow the reference.
- Two different keys, two different jobs: a **personal API key** uploads maps at build time; the **public project key** powers the SDK at runtime. Don't swap them.
- Keep build artifacts and uploaded maps in sync — every deploy should inject + upload within the same build so stack traces always resolve.
- Uploaded maps live in PostHog and never need to be served publicly.
- Detect the project's package manager before installing any dependency, and let long installs run in the background instead of blocking on them.
- Read a file (and note its exact contents) immediately before editing it — essential for any temporary test code you'll revert afterwards.

## Framework guidelines

{commandments}
