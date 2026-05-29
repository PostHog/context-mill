# Upload source maps to PostHog for {display_name}

This skill helps you upload source maps (or platform debug symbols) so PostHog Error Tracking can resolve minified stack traces back to your original source.

## Reference files

{references}

The overview lists every supported framework and build tool. The CLI reference covers `posthog-cli sourcemap inject` and `posthog-cli sourcemap upload`

## Key principles

- **Personal API key, not the project key**: Source map uploads authenticate with a **personal API key** scoped to error tracking write. The public project API key used by the SDK at runtime will not work.
- **Environment variables**: Set `POSTHOG_CLI_API_KEY`, `POSTHOG_CLI_PROJECT_ID`, and (if not US Cloud) `POSTHOG_CLI_HOST` in CI/CD secrets — never hardcode them. Build-plugin variants use `POSTHOG_API_KEY` / `POSTHOG_PROJECT_ID` / `POSTHOG_HOST` instead; follow the framework reference.
- **Inject before deploy**: After `posthog-cli sourcemap inject`, the *injected* bundles must be the ones shipped to production. Bundles missing the `//# chunkId=…` comment cannot be matched to uploaded maps.
- **Build-time integration**: Wire injection + upload into the production build (build plugin, post-build script, or GitHub Action). Manual uploads drift from deployed code.
- **Don't ship source maps publicly**: Either omit `.map` files from the deployed artifact or use hidden source maps. Uploaded maps live in PostHog, not on your origin.
- **Verify**: Check the *Symbol sets* page in PostHog Error Tracking settings to confirm each upload arrived and that releaseName/releaseVersion match what the SDK reports.

## Raw CLI support

If you wire up `posthog-cli` directly — rather than a framework integration or build plugin — generating the source maps is **your** responsibility. The CLI only injects chunk IDs into, and uploads, maps that your build already produced; it does not create them. Before `posthog-cli sourcemap inject` will work, two things must be true:

- **Source maps are emitted** next to your output bundles (e.g. `.js.map` files).
- **The maps include `sourcesContent`** — the original source embedded inside the map. Without it PostHog has the line/column mappings but not the code, so stack traces can't be fully resolved.

How you enable these depends on the technology. For example, raw Node compiled with `tsc`, set both in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "sourceMap": true,
    "inlineSources": true
  }
}
```

Other stacks (esbuild, bundler configs, platform compilers) have their own equivalents — check the framework reference above or the build tool's docs to emit source maps with embedded sources.

## Making credentials available at build time

The credentials the upload step needs (`POSTHOG_CLI_API_KEY` etc.) must be readable **by the build pipeline at build time** — not just present in a `.env` file. Whether a `.env` file is picked up automatically depends on the technology:

- **Auto-loads `.env`**: Vite, Next.js, Nuxt and similar frameworks read `.env` for you.
- **Does NOT auto-load `.env`**: Rollup, plain webpack, and plain Node scripts. You have to load it explicitly — e.g. add `dotenv` (`require('dotenv').config()`, or `import 'dotenv/config'` for ESM) at the top of the bundler config. `posthog-cli` itself also accepts `--env-file <relative-path>` to read variables from a specific file.

**Watch the separate-process gotcha.** If source map upload runs as its own step in `package.json` (e.g. `posthog-cli sourcemap upload` after the bundler), that CLI is a **separate child process** — it will *not* see env vars that a loader set inside the bundler's config file. Point the CLI at the env file directly with `--env-file <relative-path>` (e.g. `posthog-cli --env-file .env sourcemap upload ...`) so it reads `POSTHOG_CLI_API_KEY` / `POSTHOG_CLI_PROJECT_ID` / `POSTHOG_CLI_HOST` from the file itself. Variants with their own conventions (react-native, android, ios, flutter) follow the framework reference.

### Picking the correct env file

Reuse the env file the project already uses — don't create a new one. List the env files in the project directory (`.env`, `.env.local`, `.env.development`, …). If one already contains PostHog vars (`POSTHOG_*` / `NEXT_PUBLIC_POSTHOG_*`), write to that same file. Otherwise, if exactly one env file exists, use it; if several exist, prefer `.env`. Only create a new file when none exists. Use `check_env_keys` to inspect which keys are present — never read the file contents directly.


## Framework guidelines

{commandments}
