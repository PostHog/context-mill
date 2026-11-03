# Sending transactional emails

This skill publishes PostHog's `sending-transactional-emails` skill, which PostHog keeps next to its product code. Read `references/sending-transactional-emails.md` first, and follow it. Where it links to `references/<file>`, the file is in this skill's `references/` folder. The transactional emails docs are in the same folder: `transactional-emails.md` has every error code, and `api.md` has the HTTP send.

## Inside the PostHog Wizard

Read this section only when the Wizard's `wizard_ask` tool exists. Some runtimes name its tools `mcp__wizard-tools__wizard_ask` and `mcp__wizard-tools__set_env_values`: use the names the runtime shows. This section names the PostHog skill's steps by their bold titles, such as **API key.**, so find them by title, not by number.

- **First, look for server code.** Before any question or PostHog step, check that the project has server code that can send: a backend route, a server action, a worker or a job. When it has none, emit `[ABORT] no server code found` and stop.
- The person ran the Wizard to set up a transactional email, so skip the skill's advice on when to offer it.
- The Wizard has no chat. Ask every question of the skill with `wizard_ask`, never in plain text, and batch the questions of one step into one call. When the person did not say which email to send, ask them, and offer a welcome email after signup as the first choice.
- **When `wizard_ask` fails.** When it errors or isn't available, don't ask in plain text, and don't send anything. Write the send code only when you already know the email, its variable names and the template ID. List every step you skipped in the report as one the person still has to do, and stop.
- The PostHog tools of the skill run through `posthog_exec`. Check that a tool exists with `search <name>`.
- The Wizard's login may not carry the scopes of the `workflows-*` and `integrations-*` tools, so a missing tool does not mean transactional emails are off: don't stop at the skill's check that the project can use them. When a step needs a tool that is missing, ask the person to do that step in PostHog, and wait until they confirm it is done:
  - **Verified sender.** They set one up as [configure a channel](https://posthog.com/docs/workflows/configure-channels) says.
  - **Template**, **No marketing category.** and **Make it transactional.** They open **Transactional** in PostHog, click **New transactional email**, choose the verified sender, and write the subject and body. Agree on the variable names first, and give them to the person as `{{ variables.<name> }}`. The email can't be in a marketing message category. For sign-in codes, reset links and other secrets, tell them to turn on **Protect sensitive data** on the email's **API** tab. Then ask for the template ID, which that tab shows, in the same `wizard_ask` call as the key.
  - **Engagement events.** Tell them PostHog records no send, delivery, open, click or bounce events on the person until they turn on **Engagement events** in project settings, under **Workflows**, and that these events count toward the project's event usage.
- **API key.** Tell the person how to create the key, as the skill's **API key.** step says. Then ask for it with `wizard_ask` and `sensitive: true`, and pass the answer to `set_env_values` as `POSTHOG_PROJECT_SECRET_API_KEY`. The answer is a reference that only `set_env_values` can read, so the key never shows in the run. The code reads the key from that variable.
- **Test.** Ask before the skill's test send, and send only to an address the person owns. Send it through the app's new send code, for example with a one-off script that calls it, and never read, print or pass `POSTHOG_PROJECT_SECRET_API_KEY` yourself. When you can't run that code, ask the person to send it and tell you what came back. When they say no, skip it, and write in the report that no send has confirmed the setup.
- When the person says **Transactional** isn't in their PostHog project, or a test send answers `404` with the code `not_found` for a template ID the person checked on its **API** tab, emit `[ABORT] transactional email api not enabled` and stop.

## Reference files

{references}
