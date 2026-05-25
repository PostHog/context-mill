# Upload source maps to PostHog for {display_name}

This skill helps you upload source maps (or platform debug symbols) so PostHog Error Tracking can resolve minified stack traces back to your original source.

## Reference files

{references}

The overview lists every supported framework and build tool. The CLI reference covers `posthog-cli sourcemap inject` and `posthog-cli sourcemap upload`. The GitHub Action reference (`PostHog/upload-source-maps@v2`) covers wiring uploads into CI.

## Key principles

- **Personal API key, not the project key**: Source map uploads authenticate with a **personal API key** scoped to error tracking write. The public project API key used by the SDK at runtime will not work.
- **Environment variables**: Set `POSTHOG_CLI_API_KEY`, `POSTHOG_CLI_PROJECT_ID`, and (if not US Cloud) `POSTHOG_CLI_HOST` in CI/CD secrets — never hardcode them. Build-plugin variants use `POSTHOG_API_KEY` / `POSTHOG_PROJECT_ID` / `POSTHOG_HOST` instead; follow the framework reference.
- **Inject before deploy**: After `posthog-cli sourcemap inject`, the *injected* bundles must be the ones shipped to production. Bundles missing the `//# chunkId=…` comment cannot be matched to uploaded maps.
- **Build-time integration**: Wire injection + upload into the production build (build plugin, post-build script, or GitHub Action). Manual uploads drift from deployed code.
- **Don't ship source maps publicly**: Either omit `.map` files from the deployed artifact or use hidden source maps. Uploaded maps live in PostHog, not on your origin.
- **Verify**: Check the *Symbol sets* page in PostHog Error Tracking settings to confirm each upload arrived and that releaseName/releaseVersion match what the SDK reports.

## Framework guidelines

{commandments}
