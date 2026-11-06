---
title: Install posthog-js and enable automatic capture
next_step: 3-plan.md
---

# Step 2, install posthog-js and turn on its automatic capture

## Status

```
[STATUS] Detecting project framework
[STATUS] Adding PostHog to <framework>
[STATUS] Matching <vendor> automatic events in PostHog
```

## When posthog-js is already initialized

Search for `posthog.init(` and `PostHogProvider`. If posthog-js is already initialized in browser code, do not add a second init. Skip to "Turn on automatic capture".

## Install posthog-js

Read the dependency manifest and identify the framework, such as Next.js (app or pages router), React + Vite, Vue, Svelte, or plain browser.

Call `mcp__wizard-tools__load_skill_menu({ category: "integration" })`, then `mcp__wizard-tools__install_skill({ skillId: "<id>" })` with the single id that matches the framework. Read its `SKILL.md` and take only two things from it:

1. The PostHog package to add, and the install command.
2. The minimal init code for this framework, and the file it belongs in.

Install the package with the project's package manager (detect it from the lock file). Add the init code. Use environment variables for the key and host, and set them with `mcp__wizard-tools__set_env_values`. Never hardcode them.

Skip everything else in the integration skill. Do not read its examples. Do not add event captures, identification, or error tracking.

## Turn on automatic capture

The side-car does not forward the vendor's automatic events. PostHog captures its own instead. Open `references/vendor-<vendor>.md`, read only its "Automatic events" section, and apply it to the posthog-js init options.

In every case:

- Leave `autocapture` and `capture_pageview` at their defaults, or set them to `true` if the project turned them off.
- For a single-page app, page views must follow client-side navigation. Prefer `defaults: '2025-05-24'` when the installed posthog-js supports it (1.234.0 or later). Otherwise set `capture_pageview: 'history_change'`.
- Set `capture_pageleave: true`.

Do not change the vendor's own config. The vendor keeps capturing its automatic events for itself.

## Carry the outcome forward

Remember whether posthog-js was installed or already present, the init file, the integration skill id, and the init options you changed. Step 3 records them.

Continue to `3-plan.md`.
