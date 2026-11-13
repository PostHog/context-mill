# Loops SDK reference

This file says what Loops looks like in a codebase. It does not describe PostHog. `mapping.md` maps each field to PostHog.

Every Loops transactional send names a transactional email that the person made in the Loops editor, by its `transactionalId`, and fills its data variables. The subject, the sender, and the content live in Loops, not in the code.

## Key

The API key lives in `LOOPS_API_KEY` by convention. Apps also use their own names, such as `AUTH_LOOPS_API_KEY` for Auth.js: take the name the client reads.

## Packages

| Language | Package | Send |
|---|---|---|
| Node.js | `loops` (npm) | `new LoopsClient(key).sendTransactionalEmail({ ... })` |
| Nuxt | `nuxt-loops`, a module around `loops` | the same send |
| Go | `github.com/loops-so/loops-go` | `loops.NewClient(key)`, then the client's transactional send, which Loops' docs don't show |
| PHP | `loops-so/loops` (Composer) | `(new LoopsClient($key))->transactional->send(...)` |
| Ruby | `loops_sdk` | `LoopsSdk::Transactional.send(...)` |

Loops has no official SDK for Python, .NET, Java, or Elixir. Apps in those languages call the HTTP API, or use a community package that calls it: `pyloops` (Python), `loops_ex` (Elixir), `tilebox/loops-go` (Go), PlutoLinks' `loops-php` and `laravel-loops` (PHP), `loops_rails` (Rails), and a Java and a .NET package, as Loops' SDK page lists them. A send through a community package posts the same body as the HTTP API below: read the package call for its fields.

These are not Loops, and alone they are not a migration: `@loopback/*` and `loopback` are the LoopBack framework, and `nodemailer` sends through any SMTP server. A variable or function named `loops` is not the provider: look for the import, `LoopsClient`, `transactionalId`, or the host `app.loops.so`.

## Clients and sends

**Node.js.** `sendTransactionalEmail` answers Loops' body, `{ success: true }`. It carries no message id. It throws `APIError` on an API error, with `err.statusCode` and `err.json` (Loops' error body, such as `{ success: false, message }`). Loops' JavaScript SDK page also names `RateLimitExceededError` for rate limits, without its properties. Both come from `loops`.

```js
import { LoopsClient, APIError } from 'loops'

const loops = new LoopsClient(process.env.LOOPS_API_KEY)

await loops.sendTransactionalEmail({
  transactionalId: 'clfq6dinn000yl70fgwwyp82l',
  email: 'jane@example.com',
  dataVariables: { name: 'Jane', loginUrl: 'https://example.com/login' },
  headers: { 'Idempotency-Key': 'welcome-123' },
})
```

- `addToAudience: true` also creates a contact in the Loops audience, when none exists for the address.
- `attachments: [{ filename, contentType, data }]` attaches files. `data` is base64.
- `headers` carries request headers, such as `Idempotency-Key`, as Loops' examples show.

**Go.** Loops' Go SDK page shows `loops.NewClient(key)` and a call that answers an `error`: an API error is a `*loops.APIError` with `StatusCode` and `Message`, read with `errors.As`. Any other error, such as a network error, is not one. Loops' docs show no Go transactional send, and don't say whether the client retries or takes a `context.Context`. Find the send by the `github.com/loops-so/loops-go` import, and read its fields from the call: they carry the HTTP body's fields under Go names.

**PHP.** `send` answers Loops' body, as Loops' examples read it. It throws `Loops\Exceptions\APIError` on an API error, with `getStatusCode()`, `getJson()`, and `getMessage()`. Loops' PHP SDK page also names `RateLimitExceededError` for rate limits.

```php
use Loops\LoopsClient;

$loops = new LoopsClient(getenv('LOOPS_API_KEY'));
$loops->transactional->send(
    transactional_id: 'clfq6dinn000yl70fgwwyp82l',
    email: 'jane@example.com',
    data_variables: ['name' => 'Jane'],
    headers: ['Idempotency-Key' => 'welcome-123'],
);
```

Loops' examples also pass `attachments`, each file with the keys `filename`, `content_type`, and `data`. Read any other parameter from the call.

**Ruby.** `send` answers Loops' body, as Loops' examples read it. It raises `LoopsSdk::APIError` on an API error, with `statusCode` and `json` (Loops' error body). Loops' Ruby SDK page names no class for rate limits.

```ruby
LoopsSdk.configure { |config| config.api_key = ENV['LOOPS_API_KEY'] }

LoopsSdk::Transactional.send(
  transactional_id: 'clfq6dinn000yl70fgwwyp82l',
  email: 'jane@example.com',
  data_variables: { name: 'Jane' },
  headers: { 'Idempotency-Key' => 'welcome-123' }
)
```

Loops' examples also pass `attachments`, each file with the keys `filename`, `content_type`, and `data`. Read any other parameter from the call.

**HTTP.** `POST https://app.loops.so/api/v1/transactional` with `Authorization: Bearer <key>`. Loops' docs name one host, with no regional host. Code can point an SDK client at another URL, such as a proxy or a test server, where the client takes one: a send through it is still a Loops site. A success answers `200` with `{ "success": true }` and no message id. An error answers `{ "success": false, "message": "..." }`, sometimes with an `error` object of `path` and `message`. A `409` means the `Idempotency-Key` was used in the last 24 hours. A `429` means the rate limit, 10 requests per second per team. Look for `app.loops.so` in `fetch`, `axios`, `got`, `requests`, `httpx`, `net/http`, `HttpClient`, and `curl` calls.

```json
{
  "transactionalId": "clfq6dinn000yl70fgwwyp82l",
  "email": "jane@example.com",
  "dataVariables": { "name": "Jane", "items": [{ "name": "Plan", "price": "20" }] }
}
```

In Python, an app reads `response.status_code`, `response.ok`, `response.json()["success"]`, or calls `response.raise_for_status()`, which raises `requests.HTTPError`.

**SMTP.** Loops takes mail over SMTP at `smtp.loops.so`, port `587`, with the user `loops` and an API key as the password. The body of each email is not its content: it is the JSON of the HTTP body above, as a string. Look for that host in Nodemailer transports, `EMAIL_HOST`, `MAIL_HOST`, `SMTP_HOST`, or `LOOPS_SMTP_HOST` settings, Rails `smtp_settings`, and Laravel `MAIL_HOST`. Each mailer or mailable that sends through it is a site.

**Auth.js.** `next-auth/providers/loops`, configured with `apiKey` and `transactionalId`, sends Auth.js sign-in emails through Loops. It is a site.

## Send fields

The fields of one send, in the HTTP body. PHP and Ruby use these names in snake case, such as `transactional_id`, as Loops' examples show. Read Go's names from the call.

| Field | Value |
|---|---|
| `transactionalId` | The ID of a published transactional email in Loops |
| `email` | One recipient address |
| `dataVariables` | Object of values for the email's data variables: a string, a number, or a list of objects of strings and numbers (for an array block). Every required variable must be there. An optional variable can be left out or sent as `""` |
| `addToAudience` | `true` also creates a contact in the Loops audience |
| `attachments` | A list of `{ filename, contentType, data }` (`content_type` in PHP and Ruby, as Loops' examples show), `data` in base64. Loops enables attachments per account, and the body stays under 4 MB |
| `Idempotency-Key` header | Up to 100 characters. Loops answers `409` when the key was used in the last 24 hours |

A send has no field for the subject, sender, reply-to, cc, bcc, content, headers, tags, or a send time. The transactional email in Loops sets the subject, sender, reply-to, cc, and bcc, sometimes from a data variable.

## Transactional emails stored at Loops

The person builds each transactional email in the Loops editor, or uploads MJML, and publishes it. The code has only its `transactionalId`. A published email keeps sending its published version while a draft is open.

- **Sending settings:** Name, From (a name before the team's sending domain), Reply, Subject, Preview, CC, and BCC. Each can hold a data variable. CC and BCC take one address each, and only when the account turned them on.
- **Data variables:** `{name}` in the editor, `{DATA_VARIABLE:name}` in MJML, and `{data.name}` in LMX, the markup the Loops API answers with. Names hold letters, digits, `_`, and `-`, and keep their case. A variable can be marked optional, and can have a fallback value.
- **Array blocks:** an array data variable, `items` by default, repeats the block for each object in the list. Inside it, a variable reads the item. In MJML the block is `<loops-array variable="items" variable-type="DATA_VARIABLE">` with `{DATA_VARIABLE:items[].price}`.
- **Conditional sections:** a section shows only when a data variable matches. In LMX: `<Section if="{data.plan}" ifOperation="equal" ifValue="pro">`. The operators for data variables are `not_empty` (the default), `empty`, `equal`, `not_equal`, `contains`, and `not_contains`.
- Variables can also sit in a button or link URL, and in a dynamic image source.

## Status reads

Loops has no read of one email's status. `GET https://app.loops.so/api/v1/transactional-emails/{transactionalId}/metrics` reads all-time counts of one transactional email: sends, deliveries, spam reports, and hard and soft bounces. Code that reads it reads Loops' counts.

## Webhooks

Loops posts events to one endpoint per account, set in Settings, then Webhooks. Each event is JSON with `eventName`, `eventTime`, `webhookSchemaVersion`, and `contactIdentity` (`id`, `email`, `userId`). Email events also carry `email` (`id`, `emailMessageId`, `subject`), `sourceType` (`transactional`, `campaign`, or `loop` for a workflow), and `transactionalId`, `campaignId`, or `loopId`.

- For transactional emails: `transactional.email.sent` (with `transactionalName`), `email.delivered`, `email.softBounced`, `email.hardBounced`, and `email.spamReported`.
- Only for campaign and workflow emails: `email.opened`, `email.clicked`, `email.unsubscribed`, and `email.resubscribed`. Loops tracks no opens or clicks on transactional emails.
- Not about sends: `campaign.email.sent`, `loop.email.sent`, `contact.created`, `contact.unsubscribed`, `contact.deleted`, `contact.mailingList.subscribed`, `contact.mailingList.unsubscribed`, and `testing.testEvent`.

Each request carries the headers `webhook-id`, `webhook-timestamp`, and `webhook-signature`. The signature is `v1,<base64>`: an HMAC-SHA256 of `<id>.<timestamp>.<raw body>`, keyed with the signing secret (it starts with `whsec_`) after its prefix is removed and the rest is base64-decoded. Apps keep the secret in a variable such as `LOOPS_SIGNING_SECRET`.

```ts
router.post('/webhooks/loops', express.raw({ type: 'application/json' }), (req, res) => {
  if (!verifyLoopsSignature(req)) return res.sendStatus(401) // the app's own check of the three headers
  const event = JSON.parse(req.body.toString())
  if (event.eventName === 'email.hardBounced') markEmailBounced(event.contactIdentity.email)
  res.sendStatus(200)
})
```

Look for routes that read `eventName`, `contactIdentity`, `sourceType`, or `transactionalId`, and for the `webhook-signature` header.

## Other APIs

These are not transactional sends, and they stay on Loops:

- Contacts (`/api/v1/contacts/*`): `createContact`, `updateContact`, and `deleteContact` in Node.js, `LoopsSdk::Contacts` in Ruby, the other contact calls, the suppression check, and its removal, `DELETE /api/v1/contacts/suppression`. Loops' docs show the removal only over HTTP and in its CLI: in an SDK, it is a call whose name says it removes a suppression.
- Events: `sendEvent`, `LoopsSdk::Events.send` in Ruby, or `SendEvent` in Go (`POST /api/v1/events/send`) starts Loops workflows, which send Loops' own workflow emails.
- Mailing lists (`/api/v1/lists`), contact properties, and the content API for campaigns, transactional emails, email messages, themes, components, workflows, and uploads (`/api/v1/campaigns`, `/api/v1/transactional-emails`, `/api/v1/email-messages`, `/api/v1/workflows`, and the others).
- `GET /api/v1/api-key`, which tests a key.
