# Send transactional email with PostHog

Use this skill to send one email to one person from server code, such as a welcome email, a password reset, or a signup confirmation. The email lives in the repository as an HTML template file. PostHog stores it as a message template under a key, such as `welcome`, and sends it through Workflows.

The transactional email API is in beta. PostHog enables it per project.

## Instructions

Follow these steps IN ORDER. Do not upload a template before a sender is verified: the first upload needs a verified default sender.

STEP 1: Detect the platform and check the PostHog MCP.
  - Find the server code that should send the email, such as the signup handler for a welcome email.
  - Node.js (including Next.js route handlers and server actions) uses `posthog-node`. Any other server language uses the HTTP API.
  - Never send from browser or mobile code. The send needs a secret key, and the key stays on the server.
  - Look for lockfiles (pnpm-lock.yaml, package-lock.json, yarn.lock, bun.lockb) to pick the package manager.
  - Check which PostHog MCP tools exist. When there are no PostHog tools at all, the PostHog MCP is not connected or not signed in: ask the person to connect it, and wait.
  - When other PostHog tools exist but `workflows-upload-email-template` and `workflows-send-email` don't, the transactional email API is not enabled for this project. Go to STEP 6 before the person does any sender work.

STEP 2: Check for a verified sender through the PostHog MCP.
  - Call `integrations-list` with `kind=email`, and read every page. A sender with `config.verified: true` can send. When the list shows senders without `config`, call `integrations-email-verify-create` once on the sender for the address the person wants: `success` means it is verified (go to STEP 4), and `pending` or `failed` means STEP 3 from its records. When the sender tools are missing, or the verify answers 403, ask the person whether a sender is verified, and let the upload in STEP 5 confirm it.
  - The first sender that verifies becomes the project's default sender, and the first upload uses the default sender.
  - When a verified sender exists, go to STEP 4.

STEP 3: Set up a sender when none is verified.
  - First check that the PostHog MCP has the sender tools: `integrations-email-create`, `integrations-email-verify-create`, `integrations-domain-connect-check-retrieve`, and `integrations-domain-connect-apply-url-create`. When they are missing, go to the last bullet of this step.
  - When the `setting-up-an-email-domain` skill is available, follow it. It covers the details.
  - Ask which domain to send from. Recommend a subdomain such as `mail.example.com`. Use the person's own domain, never a free mailbox domain such as gmail.com.
  - Never create a sender for an address that already has one: creating it again marks it unverified. For an existing unverified sender, skip to its records.
  - Create the sender with `integrations-email-create`, then get its DNS records with `integrations-email-verify-create`.
  - PostHog never writes DNS. Call `integrations-domain-connect-check-retrieve` with the domain. When `supported` is true, give the person the URL from `integrations-domain-connect-apply-url-create`: they approve the records at their DNS host. Otherwise, give them the records that are not `success` as a table with type, name, value, and priority.
  - Always include both SPF records, merged into an existing `v=spf1` record when there is one. Never add a second `_dmarc` record when the domain already has one.
  - Call `integrations-email-verify-create` again after the records are published, at least a minute apart. `success` means done. `failed` means fix the records, then verify again. After about 15 minutes of `pending` with every record published, stop and tell the person that DNS is still propagating and they can ask you to check again later.
  - A 403 that says the person lacks permissions in the project means a project admin must verify the sender. Do not retry.
  - **When the sender tools are missing or refused**, the agent setup for sender domains is not available to this person yet. Do not try other integration tools. Ask the person to verify a sender in PostHog: Workflows, then Channels, then add an email sender on their domain and follow the DNS steps (https://posthog.com/docs/workflows/configure-channels). Wait until they confirm that the sender shows as verified, then continue.

STEP 4: Write the template as an HTML file in the repository.
  - Put it next to the server code, for example `emails/welcome.html`. In Next.js and other bundled code, put the `emails/` folder at the app root, next to `next.config.js` or `package.json`. The file name without `.html` is the key, so use letters, digits, `-`, and `_` only.
  - The `<title>` is the subject. `<meta name="preheader" content="...">` is the optional inbox preview text.
  - Use Liquid with `{{ variables.<name> }}` for every value the email shows, such as `{{ variables.first_name }}` or `{{ variables.reset_url }}`.
  - Never use `{{ person.* }}`. A send doesn't load person properties, so those placeholders render empty.

STEP 5: Upload the template with the PostHog MCP.
  - Call `workflows-upload-email-template` with the key, a `name` such as "Welcome", the `<title>` text as `subject`, the `<meta name="preheader">` content as `preheader` (if any), and the whole file as `html`.
  - Pass `source`, so PostHog and the next agent can find the file:
    - `repository`: the URL from `git remote get-url origin` as `host/owner/name`. Drop the scheme, any user name or token, and the `.git` ending: `git@github.com:example/app.git` and `https://user:token@github.com/example/app.git` both become `github.com/example/app`.
    - `path`: the file's path from the repository root (`git rev-parse --show-toplevel`), such as `apps/web/emails/welcome.html` in a monorepo.
    - `ref`: the commit from `git rev-parse HEAD`.
    - Leave out a field that git can't give, such as `repository` when there is no `origin`.
  - When the app sends with `templateFile()` (STEP 8), posthog-node fills the same three fields on the uploads it makes, from CI and hosting variables or the git checkout. A field it can't find keeps the value this upload stored.
  - Expect `result: "created"` on the first upload, and `updated` or `unchanged` later. The template is now managed by code: changes go through its file (see "Change an email the app already sends").
  - On `sender_unavailable`, the project has no verified default sender:
    - When no sender is verified, go back to STEP 3.
    - When a sender is verified, call `integrations-email-verify-create` on it once: a successful verify makes it the default when the project has none. Then upload again.
    - When that is not possible or the upload still answers `sender_unavailable`, ask the person to click **Make default** next to their verified sender in the email channel settings, then upload again.

STEP 6: Stop when the API is not enabled for the project.
  - The transactional email API is not enabled for this project when other PostHog tools exist but the upload and send tools don't, or when an upload or send answers `404` without a code or with the code `not_found`. A `404` with `template_not_found` is different: see STEP 9.
  - Stop and tell the person: the API is in beta, and they can ask PostHog in-app to enable it for their project. Do not retry, and do not work around it with other tools.

STEP 7: Have the person create a project secret API key.
  - Ask the person to create a project secret API key (it starts with `phs_`) with the `hog_flow:write` scope in their PostHog project settings.
  - Read it from the `POSTHOG_PROJECT_SECRET_API_KEY` environment variable. Add the variable name to the project's env example file. Never hardcode the key, never commit it, and never ask the person to paste it into the chat.

STEP 8: Write the send.
  **Node.js:** install or upgrade `posthog-node` to a version that has `posthog.emails`. Reference the file once when the module loads, then send it:

  ```js
  import { PostHog } from 'posthog-node'

  const posthog = new PostHog(process.env.POSTHOG_PROJECT_TOKEN, {
      host: process.env.POSTHOG_HOST,
      secretKey: process.env.POSTHOG_PROJECT_SECRET_API_KEY,
      enableLocalEvaluation: false,
  })
  const welcomeEmail = posthog.emails.templateFile(new URL('./emails/welcome.html', import.meta.url), { name: 'Welcome' })

  const { data, error } = await posthog.emails.send({
      template: welcomeEmail,
      to: user.email,
      data: { first_name: user.firstName },
      distinctId: user.id,
  })
  ```

  - Reuse the app's existing `posthog-node` client when it has one, and add `secretKey`. Keep `enableLocalEvaluation: false` unless the key also has `feature_flag:read` and the app uses local evaluation.
  - When the project token or the host is not configured yet, get the token from the PostHog MCP `projects-get` tool (`api_token`). The host is `https://us.i.posthog.com` for US Cloud and `https://eu.i.posthog.com` for EU Cloud. Ask the person which one when you can't tell.
  - Pass the same `name` as the upload in STEP 5. Without it, the next automatic upload renames the template to its subject.
  - `templateFile()` takes a `file:` URL or an absolute path. In CommonJS, use `path.join(__dirname, 'emails/welcome.html')`.
  - In Next.js and other bundled or serverless code, `import.meta.url` no longer points next to the file. Use `path.join(process.cwd(), 'emails/welcome.html')`, and make the deployment ship the file: in Next.js, add `{ '/api/signup': ['./emails/**/*.html'] }` (the route that sends) to `outputFileTracingIncludes` in `next.config.js` (under `experimental` in Next.js 14 and earlier). For Vercel and Netlify functions, see "Ship template files with serverless bundles" in the reference.
  - Edge runtimes have no file system, so they take a key string only: `template: 'welcome'`. Upload the file from a build step or a Node.js script there.
  - The file reference keeps PostHog in step with the file: each send carries the file's content hash, and after an edit the next send uploads the file on its own. No deploy step is needed.

  **Other languages:** send by key over HTTP, with `Authorization: Bearer $POSTHOG_PROJECT_SECRET_API_KEY`. The host is the app host, `https://us.posthog.com` or `https://eu.posthog.com`:

  ```
  POST <host>/api/projects/@current/messaging/send/email/
  {"template": {"key": "welcome"}, "to": "jane@example.com", "identifiers": {"distinct_id": "user_42"}, "message_data": {"first_name": "Jane"}}
  ```

  - Also add an upload by key wherever the project deploys, such as a CI step or a release script: `PUT <host>/api/projects/@current/messaging_templates/by_key/<key>/` with `name`, `subject`, `html`, `preheader`, and `source` as in STEP 5. Otherwise an edited file never reaches PostHog.

  For both:
  - Pass every value the template reads in `data` (Node.js) or `message_data` (HTTP).
  - Pass the app's user ID as `distinctId` (Node.js) or `identifiers.distinct_id` (HTTP), so the send and its delivery events show on that person.
  - Sends are not idempotent: two calls send two emails. Do not retry a send after a timeout or a server error, and never call the send more than once for one event.
  - Every test sends a real email. Ask the person before any test send, whether you run the code path or call `workflows-send-email`, and send only to an address they own. Save the test run's full output to a file and read it from there: never run it again to see more output, because each run sends another email.

STEP 9: Handle errors by their code.
  - `posthog-node` never throws on API errors. It returns `{ data, error }`. Branch on `error.code` and log `error.message`.
  - Over HTTP, read `code` from the error body. New codes also carry `fix` and `docs_url`.
  - Each code has a section with its fix in the reference. The common ones:
    - `sender_unavailable`: no verified default sender. Follow STEP 5.
    - `not_found`, or a `404` without a code: the API is not enabled for the project. See STEP 6.
    - `template_not_found`: no template has this key. Upload it (STEP 5).
    - `template_file_unreadable`: the deployment doesn't include the HTML file.
    - `missing_secret_key`, `authentication_failed`, `permission_denied`: the `phs_` key is missing, or lacks `hog_flow:write`.
    - `immutable`: the template is managed by code. Change its file, as "Change an email the app already sends" says.

## Change an email the app already sends

A code-managed template changes in its file in the repository. You work in the repository, so edit the file yourself:
  - Find the file from the template's `source.path`, or from the `templateFile()` call or upload that uses its key. When the person pastes a prompt from **Edit with your agent** on the template's page in PostHog, the prompt names the file and the key.
  - Keep the format of STEP 4, and read only `{{ variables.* }}` values that the send passes.
  - When the app sends with `templateFile()`, the change goes live with the first send after the person deploys it: posthog-node uploads the changed file then. Leave the upload to it, so the new version goes live with the code that is reviewed and deployed. Upload it yourself as in STEP 5 only when the person asks for the change to go live before that, and tell them that every running copy of the app sends the new version from then on.
  - When the app sends by key, the upload step from STEP 8 uploads the file when the project deploys. When the project has no such step, upload the file again as in STEP 5, with a fresh `source`, once the person wants the change live.
  - Change the template only through its file. PostHog's template update, patch, and design tools refuse a code-managed template with `403 immutable`. Never call `workflows-request-email-template-change` either: where the PostHog MCP has it, it starts a PostHog Code task for agents that can't reach the repository.
  - Leave the template managed by code. Releasing it in PostHog is the person's decision, and the next upload from the file claims it back.

## Reference files

{references}

The reference is the transactional email API page. It covers the template format, `posthog-node`, both routes, the content hash, and every error code.

## Key principles

- **Sender first**: verify a sender before the first upload.
- **The file is the source**: the HTML file in the repository is the template. Change the file, never the copy in PostHog.
- **Values from the send**: templates read `{{ variables.* }}` only.
- **Server only**: the `phs_` key comes from an environment variable on the server.
- **No retries**: sends are not idempotent.
