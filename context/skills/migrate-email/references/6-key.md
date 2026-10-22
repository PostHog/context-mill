---
title: Hand over the PostHog secret key
next_step: 7-report.md
---

# Step 6, hand over the PostHog secret key

PostHog's send needs a project secret API key on the server. The provider's key stays where it is until the cutover is done.

## Status

```
[STATUS] Setting up the PostHog secret key
```

## The PostHog key

- Ask the person to create a project secret API key (it starts with `phs_`) with the `hog_flow:write` scope in their PostHog project settings.
- The key goes into `POSTHOG_PROJECT_SECRET_API_KEY`, in the env file the app loads its provider key from, such as `.env` or `.env.local`. Check that git ignores that file. When it doesn't, ask the person where the key goes.
- Ask the person to add the key to that file themselves. Inside the Wizard, ask for it and store it as the "Inside the PostHog Wizard" section of `SKILL.md` says.
- Add the variable name, without a value, to the project's env example file when it has one.
- Never hardcode the key, never commit it, and never ask the person to paste it into the chat.

## Every other place the provider key lives

The provider's `sdk-reference.md` names its key's environment variable. Search the whole repository for that name, including CI workflows, deploy and hosting config, Docker and compose files, env example files, and docs. Skip `node_modules` and build output.

List each place with its file and line. Each one needs `POSTHOG_PROJECT_SECRET_API_KEY` too before the cutover, for example as a CI secret or a hosting environment variable. Do not change these files: the person adds the secret where the platform stores it.

## Write down

Tick the phase in the plan file: `- [x] key — POSTHOG_PROJECT_SECRET_API_KEY set in <file>`, or `- [ ] key — not set: <why>`. Under the phase list, add the places of the provider key.
