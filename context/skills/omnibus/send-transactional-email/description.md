# Send transactional email with PostHog

Use this skill to send one email to one person from server code, such as a welcome email, a password reset, or a signup confirmation. The email lives in the app's code as a local template: a subject and an HTML string, named by a key such as `welcome`. The first send uploads it to PostHog, and PostHog sends it through Workflows.

The transactional email API is in beta. PostHog enables it per project.

## Instructions

Follow these steps IN ORDER. Do not send before a sender is verified: the first send of a local template uploads it, and that upload needs a verified default sender.

STEP 1: Detect the platform and check the PostHog MCP.
  - Find the server code that should send the email, such as the signup handler for a welcome email.
  - Node.js (including Next.js route handlers and server actions) uses `posthog-node`. Any other server language uses the HTTP API.
  - Never send from browser or mobile code. The send needs a secret key, and the key stays on the server.
  - Look for lockfiles (pnpm-lock.yaml, package-lock.json, yarn.lock, bun.lockb) to pick the package manager.
  - Check which PostHog MCP tools exist. When there are no PostHog tools at all, the PostHog MCP is not connected or not signed in: ask the person to connect it, and wait.
  - When other PostHog tools exist but `workflows-upload-email-template` and `workflows-send-email` don't, the transactional email API is not enabled for this project. Go to STEP 6 before the person does any sender work.

STEP 2: Check for a verified sender through the PostHog MCP.
  - Call `integrations-list` with `kind=email`, and read every page. A sender with `config.verified: true` can send. When the list shows senders without `config`, call `integrations-email-verify-create` once on the sender for the address the person wants: `success` means it is verified (go to STEP 4), and `pending` or `failed` means STEP 3 from its records. When the sender tools are missing, or the verify answers 403, ask the person whether a sender is verified, and let the first send in STEP 8 confirm it.
  - The first sender that verifies becomes the project's default sender. A send without `from` uses the default sender.
  - When a verified sender exists, go to STEP 4.

STEP 3: Set up a sender when none is verified.
  {{> email-sender-setup}}

STEP 4: Pick the form of the send.
  - **Local template**, the default for a new email: the code holds the subject and the HTML with `{{ variables.* }}` placeholders, and each send passes the values in `templateData`. Write it as STEP 5 says.
  - **Rendered content**: the app already renders the whole email for one person, for example a React Email component rendered with `render()` from `@react-email/render`. Send the rendered `html` without `templateData`. PostHog sends it as it is and never stores it. Skip STEP 5.
  - **A template made in PostHog**: only when the person names one. Send it by its `templateId` with `templateData`. Skip STEP 5.

STEP 5: Write the local template in the code.
  - Put it in a module next to the server code, for example `emails/welcome.ts`, that exports a `subject` and an `html` string. Add a `text` string only when the person wants their own plain-text part: without it, PostHog derives one from the HTML.
  - Pick the key that names the email, such as `welcome` or `password-reset`. Use letters, digits, `-`, and `_` only. PostHog groups the email's logs, metrics, and status under it.
  - Use Liquid with `{{ variables.<name> }}` for every value the email shows, in the subject too, such as `{{ variables.first_name }}` or `{{ variables.reset_url }}`.
  - Never use `{{ person.* }}`. A send doesn't load person properties, so those placeholders render empty.
  - Never upload the template, and never create it in PostHog. The first send uploads it, and a send after a change uploads the new content. The template is then managed by code: changes go through the code (see "Change an email the app already sends").

STEP 6: Stop when the API is not enabled for the project.
  - The transactional email API is not enabled for this project when other PostHog tools exist but the upload and send tools don't, or when a send by `templateKey` answers `404` with the code `not_found` or without a code. A send by `templateId` answers the same `404` when no template has that id: check the id with the person first.
  - Stop and tell the person: the API is in beta, and they can ask PostHog in-app to enable it for their project. Do not retry, and do not work around it with other tools.

STEP 7: Have the person create a project secret API key.
  - Ask the person to create a project secret API key (it starts with `phs_`) with the `hog_flow:write` scope in their PostHog project settings.
  - Read it from the `POSTHOG_PROJECT_SECRET_API_KEY` environment variable. Add the variable name to the project's env example file. Never hardcode the key, never commit it, and never ask the person to paste it into the chat.

STEP 8: Write the send.
  **Node.js:** install or upgrade `posthog-node` to a version that has `posthog.emails`. Send the local template from STEP 5:

  ```js
  import { PostHog } from 'posthog-node'
  import * as welcomeEmail from './emails/welcome'

  const posthog = new PostHog(process.env.POSTHOG_PROJECT_TOKEN, {
      host: process.env.POSTHOG_HOST,
      secretKey: process.env.POSTHOG_PROJECT_SECRET_API_KEY,
      enableLocalEvaluation: false,
  })

  const { data, error } = await posthog.emails.send({
      to: user.email,
      distinctId: user.id,
      templateKey: 'welcome',
      subject: welcomeEmail.subject,
      html: welcomeEmail.html,
      templateData: { first_name: user.firstName },
  })
  ```

  - Rendered content sends `templateKey`, `subject`, and the rendered `html` without `templateData`: `html: await render(<PasswordReset url={url} />)`.
  - A template made in PostHog sends `templateId` and `templateData`, and no `templateKey`, `subject`, or `html`.
  {{> email-node-client}}
  - Leave out `from` to send from the default sender. Pass `from` only with an address on a verified sender, such as `'Example <hello@mail.example.com>'`.
  - Pass `replyTo` when replies should go to another address, such as a support mailbox. It takes one address or a list, and needs no verified sender.

  **Other languages:** send over HTTP to the app host, `https://us.posthog.com` or `https://eu.posthog.com`, with `Authorization: Bearer $POSTHOG_PROJECT_SECRET_API_KEY` and an `Idempotency-Key` header:

  ```
  POST <host>/api/projects/@current/messaging/send/email/
  Idempotency-Key: welcome:user_42
  {"to": "jane@example.com", "identifiers": {"distinct_id": "user_42"}, "template_key": "welcome", "subject": "Welcome to Example", "html": "<p>Hi Jane</p>"}
  ```

  - That body sends rendered content. A local template sends `"template": {"key": "welcome", "hash": "<content hash>"}` and `message_data` instead, with the hash computed as the reference says.
  - A local template answers `409 template_outdated` when PostHog doesn't hold its content yet, on its first send too. Upload it with `PUT <host>/api/projects/@current/messaging_templates/by_key/<key>/` and `if_code_managed: true`, then send again with the same `Idempotency-Key`.
  - A template made in PostHog sends `"template": {"id": "<template id>"}` and `message_data`.

  For both:
  - Pass every value the template reads in `templateData` (Node.js) or `message_data` (HTTP).
  - Pass the app's user ID as `distinctId` (Node.js) or `identifiers.distinct_id` (HTTP), so the send and its delivery events show on that person. The email's engagement events count as analytics events.
  - Every send has an idempotency key, and a retry with the same key never sends a second email. posthog-node makes a key when you pass none, and retries network errors, throttling, and server outages with it.
  - When a job runner or a queue retries the code that sends, a generated key doesn't survive the retry. Pass `maxRetries: 0` and an `idempotencyKey` derived from the email's purpose, such as `` `welcome:${user.id}` ``. Over HTTP, derive the `Idempotency-Key` the same way.
  - Every test sends a real email. Ask the person before any test send, whether you run the code path or call `workflows-send-email`, and send only to an address they own. Save the test run's full output to a file and read it from there: never run it again to see more output, because each run sends another email.

STEP 9: Handle errors by their code.
  - `posthog-node` never throws on API errors. It returns `{ data, error }`. Branch on `error.code`, and log `error.message`, `error.why`, and `error.fix`. `error.name` follows Resend's error names.
  - Over HTTP, read `code`, `why`, `fix`, and `docs_url` from the error body.
  - A send with warnings still sent. posthog-node logs each warning once and returns them in `data.warnings`.
  - Each code has a section with its fix in the reference. The common ones:
    - `sender_unavailable`: the first send of a local template found no verified default sender. Verify one as in STEP 2, or ask the person to click **Make default** next to their verified sender in the email channel settings.
    - `sender_not_verified`, `sender_not_allowed`: `from` is not a verified sender. Leave `from` out, or verify its domain (STEP 3).
    - `invalid_recipient`, `recipient_suppressed`: PostHog won't send to this address. Do not retry.
    - `sending_suspended`, `template_paused`: sending is stopped for the project or the template. Tell the person, and do not retry.
    - `not_found`: see STEP 6.
    - `template_outdated`: posthog-node uploads the template and sends again on its own. Over HTTP, follow STEP 8.
    - A `409` that says the template was edited in PostHog: nothing was sent. Ask the person whether to keep the code's version or PostHog's, and never switch to another key to get around it.
    - `invalid_idempotent_request`: the key was already used for another email. Make the key name the email's whole purpose.
    - `quota_limited`: the project is over its email quota. Do not retry.
    - `missing_secret_key`, a `401`, or a `403`: the `phs_` key is missing, or lacks `hog_flow:write`.
    - `missing_app_host`: set `appHost` (STEP 8).
    - `immutable`: the template is managed by code. Change it in the code, as "Change an email the app already sends" says.

## Change an email the app already sends

A local template changes in the code.

When you can edit the repository, change the code yourself:
  - Find the template by its key: the `templateKey` of the send.
  - Keep the format of STEP 5, and read only `{{ variables.* }}` values that the send passes.
  - Change the template only in the code. PostHog's template update, patch, and design tools refuse a code-managed template with `403 immutable`.

How the change goes live:
  - The first send with the changed content uploads it. Usually that is the deployed app, after review.
  - A local run of that code against the same project publishes it too. Say so when you ask before a test send.
  - A send can come back with the warning `template_superseded`, for example after a revert to content PostHog sent before. PostHog sent its newer content: follow the warning's `fix`.

Without access to the repository, tell the person which code to change.

## Inside the PostHog Wizard

Read this section only when the Wizard's `wizard_ask` tool exists. Some runtimes name its tools `mcp__wizard-tools__wizard_ask` and `mcp__wizard-tools__set_env_values`: use the names the runtime shows. The Wizard has no chat, so the person answers through its tools.

- The PostHog tools of this skill run through `posthog_exec`. Check that a tool exists with `search <name>`.
- The Wizard's login may not carry the scopes of the `workflows-*` and `integrations-*` tools, so a missing tool does not mean the API is off. Skip the last bullet of STEP 1, and in STEP 6 only a send's `404` shows that the API is off. When the sender tools are missing, take the last bullet of STEP 3.
- Ask every question of this skill with `wizard_ask`, never in plain text. Batch the questions of one step into one call.
- When the person did not say which email to send, ask them. Offer a welcome email after signup as the first choice.
- STEP 7: ask for the project secret API key with `wizard_ask` and `sensitive: true`, then pass the answer to `set_env_values` as `POSTHOG_PROJECT_SECRET_API_KEY`. The answer is a reference that only `set_env_values` can read, so the key never shows in the run.
- When a send answers the `404` of STEP 6, emit `[ABORT] transactional email api not enabled` and stop.
- When the project has no server code that can send, emit `[ABORT] no server code found` and stop.
- Ask before a test send as STEP 8 says. When the person says no, skip it.

## Reference files

{references}

The reference is the transactional email API page. It covers the send forms, `posthog-node`, the content hash, idempotency, and every error code.

## Key principles

- **Sender first**: verify a sender before the first send.
- **The code is the source**: the local template in the code is the email. Change the code, never the copy in PostHog.
- **Values from the send**: templates read `{{ variables.* }}` only.
- **Server only**: the `phs_` key comes from an environment variable on the server.
- **One email per key**: retries reuse the idempotency key, so a retry never sends twice.
