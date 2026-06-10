---
title: Add and initialize the PostHog SDK
next_step: 3-plan.md
---

# Step 2, add and initialize PostHog

Keep this step lean. Delegate the framework-specific knowledge to the matching integration skill, but only the pieces you need to add the package and init code. Do not run a full integration workflow.

## Status

Emit `[STATUS] Detecting project framework`, then `[STATUS] Adding PostHog to <framework>` as you work, with the framework's real name.

## Detect the framework

Read the project's dependency manifest at the root. For Statsig migrations this is `package.json`. Identify which integration skill matches: Next.js (app or pages router), React + Vite, Vue, Svelte, plain browser, server Node, etc.

If you can't pin down the framework, fall back to the plain JS integration. Do not abort over framework detection.

## Install the matching integration skill

Call `mcp__wizard-tools__load_skill_menu({ category: "integration" })` to see what's available. Then call `mcp__wizard-tools__install_skill({ skillId: "<id>" })` with the single id that matches the framework. Pick one.

## Apply only the install + init pieces

Read the installed integration skill's main description file (`SKILL.md`). Pull two things out of it:

1. **Which PostHog package(s) to add** to the project's manifest.
2. **The minimal init code** for this framework, plus the file it belongs in.

Edit the project's manifest to add the package entry. Edit (or create) the file the init code belongs in. Use environment variables for the key and host; never hardcode them.

That's it. Skip everything else in the integration skill:

- Do not read the example project code under `<skill>/examples/`.
- Do not WebFetch the `docs_urls` listed in the integration skill's config.
- Do not run `npm install` / `pnpm install` / `yarn`. Step 5 runs install once at the end.
- Do not add identification, event capture, error tracking, or any other instrumentation. The migration replaces existing Statsig calls only; that's Steps 4 onward.

The integration skill is your reference for "what does PostHog look like in this framework". You're not running it end-to-end.

## Carry the outcome forward

The plan file does not exist yet, so this step does not record the outcome on disk. Remember whether the manifest edit + init landed cleanly, plus the integration skill id, so Step 3 can record it.

Continue to `3-plan.md`.
