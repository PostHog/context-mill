---
title: Hand over the PostHog secret key
next_step: 7-rewrite.md
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

## Check that the key is set

The key is set only when the env file holds it. Inside the Wizard, it is set once `set_env_values` succeeds. Otherwise, once the person says they added it, check the file with a command that prints a count and never the key, such as `grep -cE '^\s*(export\s+)?POSTHOG_PROJECT_SECRET_API_KEY\s*=\s*.?phs_' .env`. A count of `0` means the key is not set.

A person who says they will add the key later has not set it, and neither has one who declines. Don't wait for them: record the key as not set, and go on.

## Every other place the provider key lives

The provider's `sdk-reference.md` names the environment variables that hold its key, one or more. Search the whole repository for each name, including CI workflows, deploy and hosting config, Docker and compose files, env example files, and docs. Skip `node_modules` and build output.

List each place that sets a value for it, with its file and line: env and env example files, CI, deploy and hosting config, Docker and compose files, and docs that tell people to set it. Source code that only reads the variable is not a place. Each place needs `POSTHOG_PROJECT_SECRET_API_KEY` too before the cutover, for example as a CI secret or a hosting environment variable. Do not change these files: the person adds the secret where the platform stores it.

## Write down

Tick the phase in the plan file only when the check above found the key: `- [x] key — POSTHOG_PROJECT_SECRET_API_KEY set in <file>`. Otherwise write `- [ ] key — not set: <why>`, such as `the person adds it to .env`. Under the phase list, add the places of the provider key.
