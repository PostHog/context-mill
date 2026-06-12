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
- **Node / tsc** Emit maps with embedded sources by setting both in `tsconfig.json`: `"sourceMap": true` and `"inlineSources": true`. Then run `posthog-cli sourcemap inject` followed by `posthog-cli sourcemap upload` against the build output dir as post-build steps — both invocations need the upload credentials (see "Make credentials available at build time").
- **Vite / Webpack / Rollup** Prefer the bundler plugin from the reference over hand-rolling the CLI — it injects and uploads in one pass. Make sure the bundler is configured to emit source maps.
- **Next.js / Nuxt / Angular** Use the framework's documented source-map upload integration from the reference; these own their build pipeline, so configure upload there rather than bolting on a separate CLI step.
- **React Native / Android / iOS / Flutter** You upload platform debug symbols (Hermes maps, ProGuard/R8 mappings, dSYMs) rather than plain `.js.map` files — follow the platform reference for the exact build hook.

### Make credentials available at build time

The upload credentials must be readable **by the build pipeline at build time**, not merely present in a `.env` file. Whether `.env` is auto-loaded depends on the technology.

#### Tips
- **Auto-loads `.env`**: Next.js, Nuxt and similar frameworks read `.env` into the build for you — nothing extra to do.
- **Vite is a partial exception**: it auto-loads `.env` into `import.meta.env` for client code (only `VITE_`-prefixed vars), but does **not** put vars in `process.env` for your config to read. The upload credentials (`POSTHOG_*`, not `VITE_`-prefixed) are read when the plugin is constructed, so load them yourself — see the Vite example below.
- **Does NOT auto-load `.env`**: Rollup, plain webpack, and plain Node scripts. Load it explicitly — add `dotenv` (`require('dotenv').config()`, or `import 'dotenv/config'` for ESM) at the top of the bundler/config file.
- **Separate-process gotcha**: if injection/upload run as their own `package.json` steps (e.g. `posthog-cli sourcemap inject` / `posthog-cli sourcemap upload` after the bundler), each CLI call is a **separate child process** and will *not* see env vars a loader set inside the bundler config. Point the CLI at the file directly: `posthog-cli --dotenv-file <relative-path> sourcemap …` (the flag goes before the subcommand).
- **`inject` authenticates too.** Even though `posthog-cli sourcemap inject` only edits local files, it resolves credentials exactly like `upload` and fails without them. The reference docs show a bare `inject` command and put `--dotenv-file` only on `upload` — don't copy that asymmetry; pass `--dotenv-file` to **every** `posthog-cli` invocation. (A bare `inject` can still appear to work if the developer once ran `posthog-cli login`, which leaves credentials in `~/.posthog` — that won't exist in CI or on a teammate's machine.)

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
- **Standalone posthog-cli steps** Pass `--dotenv-file .env` to **both** invocations — `inject` and `upload` each need the credentials:
  ```json
  "build": "tsc && posthog-cli --dotenv-file .env sourcemap inject --directory ./dist && posthog-cli --dotenv-file .env sourcemap upload --directory ./dist --release-name my-app"
  ```

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

### Set up CI for automatic uploads

Source maps are only uploaded when the **production build** runs, so the environment that builds and deploys your app needs the same upload credentials you put in the env file. The whole job is: **find where the production build command actually runs, then make the upload credentials reachable at that exact spot.** The build is where maps inject + upload, and env does **not** automatically cross three boundaries — into a Docker build, into a nested/composite action, or into an SSH session. So trace the deploy path before editing anything:

1. Is there a `Dockerfile`? If the build command runs inside it (`RUN <build>`), the build happens in that image's **build stage**.
2. Is there a workflow under `.github/workflows/`? Open it and find the step that triggers the build, then follow it to where the build truly executes — it may be:
   - an inline build step (`run: npm run build`) on the runner,
   - a `docker build` / `docker/build-push-action` step (build runs in the image),
   - a `uses: ./.github/actions/...` **local composite action** — open that `action.yml`; the real build step is one layer down,
   - an `ssh`/deploy step (e.g. `appleboy/ssh-action`) whose `script:` runs the build **on a remote server**.
3. Any other CI config in the repo (`.gitlab-ci.yml`, `.circleci/config.yml`, `Jenkinsfile`, `bitbucket-pipelines.yml`, `azure-pipelines.yml`, …)? Open it and find the job/stage that runs the production build. The principle is identical; apply it with your working knowledge of that provider — the examples below show the pattern to mirror.
4. No `Dockerfile`, no CI config, no build step you can trace? Don't guess — tell the user where the creds need to be (see "Untraceable setup" under Examples).

#### Tips
- Reuse the **exact variable names** from "Write credentials to the env file" — the build reads the same names locally and in CI. (`POSTHOG_CLI_*` for direct `posthog-cli`; `POSTHOG_*` for bundler-plugin uploaders.)
- **In CI, credentials travel as environment variables — never as a file.** Do not materialize a `.env` on the runner (e.g. `printf … > .env` before the build), and never copy or un-ignore one into a Docker image: it's redundant, and a secrets file on disk can leak into artifacts, caches, or image layers. A build script that passes `--dotenv-file .env` to `posthog-cli` works unchanged in CI even though `.env` doesn't exist there: real environment variables take precedence over the file, and a missing file is skipped with a warning.
- **Never commit secret values.** Reference credentials by name only: Docker `ARG`/`ENV`, or `${{ secrets.* }}` in GitHub Actions. The personal API key stays out of version control.
- Layers stack — a workflow can call a composite action that runs `docker build` against a Dockerfile. Wire **every** layer the credentials must pass through, from the outer `${{ secrets.* }}` reference down to the `ARG`/`ENV` in the build stage.
- **Multi-stage Dockerfiles:** put the `ARG`/`ENV` in the **build stage** (where the build command runs), never the runtime stage. That's both correct (the build needs them) and safer (the creds don't get baked into the shipped image).
- **Composite / reusable actions can't read `secrets`.** Inside a `.github/actions/*/action.yml` only `${{ inputs.* }}` is available. Add an `inputs:` entry per credential, reference `${{ inputs.* }}` there, and pass `${{ secrets.* }}` from the calling workflow's `with:` block.
- **Build over SSH:** the runner's env doesn't reach the remote box. Set the vars inline immediately before the build command inside the `script:`. `${{ secrets.* }}` is substituted by Actions *before* the script is sent, so the value travels with the script.
- **The worked examples are exemplars, not an allowlist.** For any provider not shown (GitLab CI, CircleCI, Jenkins, Bitbucket, Azure Pipelines, …), apply the same principle with your knowledge of that provider: find the job that runs the production build, expose the credentials there via the provider's native secret mechanism (GitLab project CI/CD variables, CircleCI project env vars / contexts, Jenkins credentials + `withCredentials`, …), and cross the same boundaries the same way — Docker builds still need `--build-arg`, SSH sessions still need inline vars.
- **Make only the edits the provider actually needs.** Some providers inject project-level variables straight into every job's environment — GitLab CI/CD variables work this way — so an inline build step may need **no functional pipeline change at all**. When that's the conclusion, still add a short comment on the build job naming the required variables and where to create them (see the GitLab example) — the requirement must be visible in the repo, not only in your hand-off — and tell the user exactly which variables to create and where.
- You can't create CI secrets. Whenever the pipeline reads a credential, tell the user where to add it before their next deploy — GitHub: **Settings → Secrets and variables → Actions**; GitLab: **Settings → CI/CD → Variables**; other providers: their equivalent secret store. The pipeline can't read a secret that doesn't exist yet.

#### Examples
- **Dockerfile build stage (e.g. `Dockerfile`, no CI)** Declare the credentials as build args and promote them to env vars *before* the build `RUN`, in the build stage:
  ```dockerfile
  FROM node:22-slim AS build
  WORKDIR /app
  # ...
  ARG POSTHOG_CLI_API_KEY
  ARG POSTHOG_CLI_PROJECT_ID
  ARG POSTHOG_CLI_HOST
  ENV POSTHOG_CLI_API_KEY=$POSTHOG_CLI_API_KEY \
      POSTHOG_CLI_PROJECT_ID=$POSTHOG_CLI_PROJECT_ID \
      POSTHOG_CLI_HOST=$POSTHOG_CLI_HOST
  RUN npm run build   # now sees the upload credentials
  ```
  With no CI wiring the image, tell the user to pass them when they build: `docker build --build-arg POSTHOG_CLI_API_KEY=… --build-arg POSTHOG_CLI_PROJECT_ID=… --build-arg POSTHOG_CLI_HOST=… .`
- **GitHub Actions — inline build step** Build runs on the runner; expose the creds with `env:` on that step:
  ```yaml
  - name: Build
    run: npm run build
    env:
      POSTHOG_CLI_API_KEY: ${{ secrets.POSTHOG_CLI_API_KEY }}
      POSTHOG_CLI_PROJECT_ID: ${{ secrets.POSTHOG_CLI_PROJECT_ID }}
      POSTHOG_CLI_HOST: ${{ secrets.POSTHOG_CLI_HOST }}
  ```
- **GitHub Actions — `docker build` / `docker/build-push-action`** Add the `ARG`/`ENV` to the Dockerfile build stage (above), then forward the creds as build args. Raw `docker build` takes `--build-arg`; `docker/build-push-action` takes a multi-line `build-args:` input — **merge into the existing `with:` block, don't add a second step**:
  ```yaml
  - name: Build and push image
    uses: docker/build-push-action@v6
    with:
      context: .
      file: Dockerfile
      push: true
      tags: ${{ steps.meta.outputs.tags }}
      build-args: |
        POSTHOG_CLI_API_KEY=${{ secrets.POSTHOG_CLI_API_KEY }}
        POSTHOG_CLI_PROJECT_ID=${{ secrets.POSTHOG_CLI_PROJECT_ID }}
        POSTHOG_CLI_HOST=${{ secrets.POSTHOG_CLI_HOST }}
  ```
- **GitHub Actions — nested/composite action** When the workflow delegates the build with `uses: ./.github/actions/build-and-push`, the `build-push-action` lives in that action's `action.yml`, which can't see `secrets`. Thread them through as inputs. In `.github/actions/build-and-push/action.yml`:
  ```yaml
  inputs:
    posthog-cli-api-key:
      required: true
    posthog-cli-project-id:
      required: true
    posthog-cli-host:
      required: true
  runs:
    using: composite
    steps:
      - uses: docker/build-push-action@v6
        with:
          # ...existing context/file/push/tags...
          build-args: |
            POSTHOG_CLI_API_KEY=${{ inputs.posthog-cli-api-key }}
            POSTHOG_CLI_PROJECT_ID=${{ inputs.posthog-cli-project-id }}
            POSTHOG_CLI_HOST=${{ inputs.posthog-cli-host }}
  ```
  Then pass the secrets from the calling workflow's `with:` block:
  ```yaml
  - uses: ./.github/actions/build-and-push
    with:
      # ...existing inputs...
      posthog-cli-api-key: ${{ secrets.POSTHOG_CLI_API_KEY }}
      posthog-cli-project-id: ${{ secrets.POSTHOG_CLI_PROJECT_ID }}
      posthog-cli-host: ${{ secrets.POSTHOG_CLI_HOST }}
  ```
- **GitHub Actions — build over SSH** When a step SSHes into a server and runs the build there (e.g. `appleboy/ssh-action` with `git pull && npm run build`), set the vars inline right before the build command inside the `script:` — mirror however the script already passes runtime vars:
  ```yaml
  - uses: appleboy/ssh-action@v1
    with:
      host: ${{ secrets.DEPLOY_HOST }}
      # ...
      script: |
        cd /srv/app && git pull --ff-only origin main && npm ci
        POSTHOG_CLI_API_KEY="${{ secrets.POSTHOG_CLI_API_KEY }}" \
        POSTHOG_CLI_PROJECT_ID="${{ secrets.POSTHOG_CLI_PROJECT_ID }}" \
        POSTHOG_CLI_HOST="${{ secrets.POSTHOG_CLI_HOST }}" \
          npm run build
  ```
- **GitLab CI (`.gitlab-ci.yml`)** Project CI/CD variables are injected into every job's environment automatically, so a job that runs the build inline (`script: - npm run build`) needs **no functional YAML change** — no `variables:` block, and do NOT add a script line that writes the variables into a `.env` file (`printf … > .env`, `echo … >> .env`, etc.); the build already sees them as environment variables, which take precedence over any dotenv file. DO leave a comment on the build job so the requirement is visible in the repo, not only in your hand-off:
  ```yaml
  build:
    stage: build
    # PostHog source map upload: this job needs POSTHOG_CLI_API_KEY,
    # POSTHOG_CLI_PROJECT_ID and POSTHOG_CLI_HOST available as CI/CD
    # variables (Settings → CI/CD → Variables); GitLab injects them into
    # the job automatically. Mark them Masked — but Protected only if this
    # job runs exclusively on protected branches, otherwise feature-branch
    # builds fail with missing credentials.
    script:
      - npm ci
      - npm run build
  ```
  Then tell the user to add those variables in **Settings → CI/CD → Variables** and the next pipeline picks them up. Edits beyond the comment are only needed when a boundary is crossed: a job that runs `docker build` must forward them (`--build-arg POSTHOG_CLI_API_KEY="$POSTHOG_CLI_API_KEY" …`) into the Dockerfile's build stage (see the Dockerfile example), and a job that builds over SSH must set them inline before the remote build command, exactly like the SSH example above.
- **Other CI providers (CircleCI, Jenkins, Bitbucket, Azure Pipelines, …)** Same recipe, provider-native mechanics: open the pipeline config, find the job that runs the production build, expose the credentials to that job via the provider's secret store, and thread them through any Docker/SSH boundary just like the examples above. Reference credentials by name only, then tell the user each secret to create and exactly where in the provider's UI it goes.
- **Untraceable setup** No `Dockerfile`, no CI config, and no build step you can trace: make no CI changes. Tell the user that wherever their production build command runs, it must have the upload credentials (`POSTHOG_CLI_*` / `POSTHOG_*`) available as environment variables, or maps won't upload on deploy. If part of the path is still recognisable — e.g. a `Dockerfile` built by an unfamiliar CI — wire the layers you do recognise and tell the user exactly what the remaining layer must pass in (e.g. the `--build-arg` flags).

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
- If you wired CI, list the pipeline files you changed (`Dockerfile`, workflow, pipeline config) and spell out every manual follow-up — e.g. the secrets the user must add in their CI provider's settings before their next deploy, or the note that their build path couldn't be traced.

## General tips
- The reference files for {display_name} are authoritative — if this page and a reference disagree on an API, follow the reference.
- Two different keys, two different jobs: a **personal API key** uploads maps at build time; the **public project key** powers the SDK at runtime. Don't swap them.
- Keep build artifacts and uploaded maps in sync — every deploy should inject + upload within the same build so stack traces always resolve.
- Uploaded maps live in PostHog and never need to be served publicly.
- Detect the project's package manager before installing any dependency, and let long installs run in the background instead of blocking on them.
- Read a file (and note its exact contents) immediately before editing it — essential for any temporary test code you'll revert afterwards.

## Framework guidelines

{commandments}
