# Sending transactional emails

This skill publishes PostHog's `sending-transactional-emails` skill, which PostHog keeps next to its product code. Read `references/sending-transactional-emails.md` first, and follow it. Where it links to `references/<file>`, the file is in this skill's `references/` folder. The transactional emails docs are in the same folder: `transactional-emails.md` has every error code, and `api.md` has the HTTP send.

## Inside the PostHog Wizard

Read this section only when the Wizard's `wizard_ask` tool exists. Some runtimes name its tools `mcp__wizard-tools__wizard_ask` and `mcp__wizard-tools__set_env_values`: use the names the runtime shows.

- The person ran the Wizard to set up a transactional email, so skip "Offer it when the user mentions one".
- The Wizard has no chat. Ask every question of the skill with `wizard_ask`, never in plain text, and batch the questions of one step into one call. When the person did not say which email to send, ask them, and offer a welcome email after signup as the first choice.
- The PostHog tools of the skill run through `posthog_exec`. Check that a tool exists with `search <name>`.
- The Wizard's login may not carry the scopes of the `workflows-*` and `integrations-*` tools, so a missing tool does not mean transactional emails are off. Don't stop at "Check that the project can use it". When a step of "Set it up" needs a tool that is missing, ask the person to do that step in PostHog, and wait until they confirm it is done:
  - **Verified sender:** they set one up as [configure a channel](https://posthog.com/docs/workflows/configure-channels) says.
  - **Template and making it transactional:** they open **Transactional** in PostHog, click **New transactional email**, choose the verified sender, and write the subject and body. Agree on the variable names first, and give them to the person as `{{ variables.<name> }}`. Then ask for the template ID, which the email's **API** tab shows.
- **API key:** tell the person how to create the key, as step 7 of "Set it up" says. Then ask for it with `wizard_ask` and `sensitive: true`, and pass the answer to `set_env_values` as `POSTHOG_PROJECT_SECRET_API_KEY`. The answer is a reference that only `set_env_values` can read, so the key never shows in the run. The code reads the key from that variable.
- When the person says **Transactional** isn't in their PostHog project, or a test send answers `404` with the code `not_found` for a template ID the person checked on its **API** tab, emit `[ABORT] transactional email api not enabled` and stop.
- When the project has no server code that can send, emit `[ABORT] no server code found` and stop.
- **Test:** ask before the test send of step 9, and send only to an address the person owns. When they say no, skip it, and write in the report that no send has confirmed the setup.

## Reference files

{references}
