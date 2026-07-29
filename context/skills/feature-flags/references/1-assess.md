---
next_step: 2-configure.md
title: Assess the app and choose a use case
description: Confirm the existing PostHog integration and plan one safe feature-flagged behavior
---

# Step 1 - Assess the app and choose a use case

## Status

Emit:

```text
[STATUS] Inspecting the app and existing PostHog integration
```

## Inspect

Read the project manifest, package or dependency lockfile, PostHog initialization, environment variable examples, and the smallest set of source files needed to understand the relevant user flow. Search for existing flag keys and flag evaluation calls before choosing a new key.

The PostHog project token is a public client-side key, not a secret, but this workflow does not need its raw value. Do not open or print value-bearing environment files such as `.env` or `.env.local`. Check only whether expected variable names are present. Prefer the Wizard `check_env_keys` tool when it is available; otherwise use output that discards or redacts values. Do not repeat the project token in status output, the assessment, or the final report.

Never expose a personal API key, OAuth token, or other secret to the model. This workflow does not need to request or move one. If a future extension must move a secret, use the host's opaque secret-reference flow, such as the Wizard's `wizard_ask` with `sensitive: true` and `set_env_values` with the returned `secretRef`.

First enumerate existing environment filenames without their contents. Run the key-presence check against every existing environment file the framework can load for the current mode; do not assume `.env.local` is the only valid file. A key missing from one file is not globally missing when another supported file contains it.

Record which required configuration names are already present and which are missing across all checked files. Do not call a configuration-writing tool, or recommend adding or moving a variable, until every existing supported environment file has been checked and the variable is still missing.

Read `COMMANDMENTS.md`, the framework-specific reference listed in `SKILL.md`, `adding-feature-flag-code.md`, and `best-practices.md`. Treat these bundled references as the source of truth for SDK methods and framework patterns. If an older framework example conflicts with an API marked as preferred or deprecated in `adding-feature-flag-code.md`, follow the newer API guidance.

Confirm all of the following:

- The generated skill matches the application's language and framework.
- A PostHog SDK is installed and initialized.
- The application has a real project token and host configured using the framework's supported pattern, without an empty or placeholder token.
- The control behavior can continue working when the flag is false, unavailable, or still loading.

## Stop conditions

If the PostHog SDK is missing or has no initialization path, do not install it in this workflow. Emit:

```text
[ABORT] A working PostHog SDK integration is required. Run the default PostHog Wizard, then rerun the feature-flags command.
```

If this skill does not match the detected framework, emit:

```text
[ABORT] The selected feature flag skill does not match this application. Rerun the command with the detected framework skill.
```

## Choose the use case

Use a behavior named by the user when one exists. Otherwise, select one small, reversible user-facing enhancement supported by the code you inspected, and announce the choice before editing.

Avoid authentication, authorization, billing, data deletion, privacy controls, and other behavior where a failed flag evaluation could create a security or data-integrity problem. A feature flag may control product behavior, but it must never be the security boundary.

Choose a descriptive lowercase, hyphenated flag key that follows any existing project convention. Prefer a boolean flag. Use variants or payloads only when the behavior requires them.

Record the selected skill ID and its version from the installed `SKILL.md` metadata for the final report. If the invoking program exposes whether the skill came from a local or published Context Mill menu, record that source; otherwise mark the source as unavailable instead of inferring it.

Write down the proposed flag key, control behavior, flagged behavior, evaluation location, safe default, configuration variable names without their values, and the files likely to change. Do not edit source code in this step.
