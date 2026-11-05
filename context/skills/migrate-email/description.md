# Migrate transactional email from {display_name} to PostHog

Use this skill to move an app's transactional email, such as welcome emails, password resets, and receipts, from {display_name} to PostHog.

It finds every {display_name} send, sets up the PostHog sender and its DNS records next to the records the app sends with now, imports the suppression list, and hands over the PostHog secret key. Then it moves every send PostHog can take to PostHog's SDK for its language (Node.js, Python, Go, Ruby, PHP, .NET, Rust, or Elixir), checks one email on one person, and writes a report. Sends PostHog can't take stay on {display_name} with a reason, so both providers send during the cutover.

The transactional email API is in beta. PostHog enables it per project.

## Workflow

{workflow}

Read the step files in order, one at a time. Each step names the next one. Do not read a step before the one before it tells you to.

## Provider files

The folder `references/<provider>/` holds everything specific to {display_name}. The steps tell you when to read each file:

- `sdk-reference.md`: how {display_name} looks in code, so you can find every send.
- `mapping.md`: how each send field maps to PostHog, what keeps a call site on {display_name}, and how to rewrite a site that moves.
- `account.md`: the DNS records the app sends with now, and how to get the templates and the suppression list.

The rewrite files next to the step files, `rewrite-<language>.md`, have PostHog's email send in each language the sites can move in. Step 7 says which one to read.

Everything you need is on disk. Do not fetch the {display_name} docs. Never tell the person how PostHog behaves where these files don't say: say that you can't tell.

## Plan file

The plan file `.posthog-email-migration-plan.md` lives at the project root. Step 3 writes it, the later steps update it, and the last step writes the report from it and deletes it.

## Rules

- Change send code only in Step 7, and fix it only in Step 8: the sites that move, the helpers, callers, and tests they need, and other PostHog SDK code that the SDK's upgrade breaks. Leave every site that stays as it is.
- Never touch DNS or the {display_name} account. Give the person the records and the links, and let them make the change.
- Never remove the {display_name} package or its API key. The report tells the person when to remove them.
- Never create, upload, or edit a template in PostHog. The person makes each template that moves to PostHog.
- Never write a recipient's email address into a file in the repository, the plan, or the report. Count addresses instead.
- Keep keys in environment variables. Never hardcode a key, and never ask the person to paste one into the chat.
- Do not commit. The person reviews the diff and commits.

## Inside the PostHog Wizard

Read this section only when the Wizard's `wizard_ask` tool exists. Some runtimes name its tools `mcp__wizard-tools__wizard_ask` and `mcp__wizard-tools__set_env_values`: use the names the runtime shows. The Wizard has no chat, so the person answers through its tools.

- The PostHog tools of this skill run through `posthog_exec`. Check that a tool exists with `search <name>`.
- The Wizard's login may not carry the scopes of the `workflows-*` and `integrations-*` tools, so a missing tool does not mean the API is off. Step 2 says how to tell.
- Ask every question with `wizard_ask`, never in plain text. Batch the questions of one step into one call.
- Emit the `[STATUS]` line each step names when you start it, and the `[ABORT]` line a step names when it stops the run.
- Ask for a key with `wizard_ask` and `sensitive: true`, then pass the answer to `set_env_values` with the variable name the step gives. The answer is a reference that only `set_env_values` can read, so the key never shows in the run.

Outside the Wizard, skip the `[STATUS]` lines, and tell the person why you stopped instead of an `[ABORT]` line.

## Reference files

{references}

`transactional-emails.md` is the transactional email overview. It covers how to create a transactional email and its API key, idempotency, and the error codes. `api.md` covers the send route, including content from your code, and the checks of a send.

When the `sending-transactional-emails` skill is available, read it for the PostHog side of a send. Its `moving-from-other-providers.md` moves sends to a template stored in PostHog. This skill moves the {display_name} sends to PostHog's SDKs, with the content in the app's code, or to a template the person makes in PostHog. Where the two disagree, this skill's steps win.
