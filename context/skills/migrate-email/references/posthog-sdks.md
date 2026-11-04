---
title: PostHog's email send in each language
description: The PostHog SDK, client, send, and errors for each language a site can move in
---

# PostHog's email send in each language

How each PostHog server SDK sends an email. Step 7 reads the part for each language a moving site is written in. The provider's `mapping.md` gives the fields in their Node.js names: use the names below for other languages.

Every SDK sends one email per call to one `to` address, in one of two forms:

- **Code form:** `templateKey`, `subject`, and `html`, `text`, or both, with optional `from`, `replyTo`, `cc`, `bcc`, `attachments`, and `captureEngagement`.
- **Template form:** `templateId` with optional `templateData`, for a template made in PostHog. It takes none of the code form's fields.

Both forms take `distinctId`, `idempotencyKey`, and `maxRetries`. No SDK takes `headers`, `tags`, a send time, several `to` addresses, or an attachment by path or URL: read a file into its content first.

## Check the installed release

Read the installed package's own types or source, not this file, to see what it takes. Early releases send only the template form, and the fields came in this order:

1. `emails.send` with the template form.
2. The code form (`templateKey`, `subject`, `html`, `text`, `from`, `replyTo`, `captureEngagement`), and the client option `migratedFrom`.
3. `cc`, `bcc`, and `attachments`, in Node.js, Python, Go, and Elixir. Ruby, PHP, .NET, and Rust have no `cc`, `bcc`, or `attachments` yet.

A language with no row below has no PostHog email send yet, such as Java, Kotlin, Swift, or Dart: its sites stay on the provider with the reason `PostHog has no email send in <language> yet`.

## Names in each language

| Node.js | Python | Ruby, PHP, Elixir | Go | .NET | Rust builder |
|---|---|---|---|---|---|
| `to` | `to` | `to` | `To` | `To` | `new(to, …)` |
| `distinctId` | `distinct_id` | `distinct_id` | `DistinctID` | `DistinctId` | `.distinct_id()` |
| `idempotencyKey` | `idempotency_key` | `idempotency_key` | `IdempotencyKey` | `IdempotencyKey` | `.idempotency_key()` |
| `templateId` | `template_id` | `template_id` | `TemplateID` | `TemplateId` (a `Guid`) | `TemplateEmail::new(to, id)` |
| `templateData` | `template_data` | `template_data` | `TemplateData` | `TemplateData` | `.template_data()` |
| `templateKey` | `template_key` | `template_key` | `TemplateKey` | `TemplateKey` | `CodeEmail::new(to, key, subject)` |
| `subject`, `html`, `text` | the same | the same | `Subject`, `HTML`, `Text` | `Subject`, `Html`, `Text` | `.html()`, `.text()` |
| `from` | `from_` | `from` | `From` | `From` | `.from()` |
| `replyTo` | `reply_to` | `reply_to` | `ReplyTo` (`[]string`) | `ReplyTo` (a list) | `.reply_to()`, once per address |
| `cc`, `bcc` | `cc`, `bcc` | `cc`, `bcc` (Elixir only) | `Cc`, `Bcc` (`[]string`) | none | none |
| `attachments` | `attachments` | `attachments` (Elixir only) | `Attachments` | none | none |
| `captureEngagement` | `capture_engagement` | `capture_engagement` | `CaptureEngagement` (`*bool`) | `CaptureEngagement` | `.capture_engagement()` |

An attachment is `{ filename, content, contentType, contentId }`, in each language's case, and `contentId` shows the file inline as `<img src="cid:...">`:

- Node.js: `content` is a `Buffer`, a `Uint8Array`, or a base64 string.
- Python: `content` is `bytes` or a base64 string.
- Go: `Content` is `[]byte` of the raw file. Decode a base64 string first.
- Elixir: `content` is the raw binary. Decode a base64 string first: the SDK encodes it again.

## Node.js: `posthog-node`

```js
import { PostHog } from 'posthog-node'

export const posthog = new PostHog(process.env.POSTHOG_PROJECT_TOKEN, {
    host: process.env.POSTHOG_HOST,
    secretKey: process.env.POSTHOG_PROJECT_SECRET_API_KEY,
    enableLocalEvaluation: false,
    migratedFrom: '<provider>',
})

const { data, error } = await posthog.emails.send({
    to: 'jane@example.com',
    distinctId: user.id,
    templateKey: 'welcome',
    subject: 'Welcome',
    html,
})
```

- Errors: `send` never throws on an API error. It answers `{ data, error }`: `data.id` is the message id, and `error` has `name`, `code`, `message`, and `statusCode`. A bad argument comes back as `error` too.
- `enableLocalEvaluation: false`: the secret key also turns on local feature flag evaluation. Keep it off unless the key has `feature_flag:read` and the app uses local evaluation.
- A component the provider rendered, such as React Email, is rendered in the app with `render` from `@react-email/render`, and sent as `html`.

## Python: `posthog`

```python
from posthog import Posthog
from posthog.emails import EmailError

posthog = Posthog(
    os.environ["POSTHOG_PROJECT_TOKEN"],
    host=os.environ["POSTHOG_HOST"],
    secret_key=os.environ["POSTHOG_PROJECT_SECRET_API_KEY"],
    migrated_from="<provider>",
)

result = posthog.emails.send(
    to="jane@example.com",
    distinct_id=str(user.id),
    template_key="welcome",
    subject="Welcome",
    html=html,
)
```

- Errors: `send` raises `posthog.emails.EmailError` on an API error, with `.code`, `.name`, `.status_code`, and `.message`. A bad argument raises `TypeError` or `ValueError`. It answers a result whose `.id` is the message id.
- Async apps use `AsyncPosthog` from `posthog`, and `await posthog.emails.send(...)`.

## Go: `github.com/posthog/posthog-go`

```go
client, err := posthog.NewWithConfig(os.Getenv("POSTHOG_PROJECT_TOKEN"), posthog.Config{
    Endpoint:     os.Getenv("POSTHOG_HOST"),
    SecretKey:    os.Getenv("POSTHOG_PROJECT_SECRET_API_KEY"),
    MigratedFrom: "<provider>",
})

result, err := client.Emails().Send(ctx, posthog.CodeEmail{
    To:          "jane@example.com",
    DistinctID:  user.ID,
    TemplateKey: "welcome",
    Subject:     "Welcome",
    HTML:        html,
})
```

- The template form is `posthog.TemplateEmail{To, TemplateID, TemplateData, ...}`.
- Errors: `Send` answers `(*SendEmailResult, error)`, and `result.ID` is the message id. The error is always a `*posthog.EmailError`, with `Code`, `Name`, `Message`, and `StatusCode`. Read it with `errors.As`.
- A site with no `context.Context` passes `context.Background()`.

## Ruby: `posthog-ruby`

```ruby
posthog = PostHog::Client.new(
  api_key: ENV['POSTHOG_PROJECT_TOKEN'],
  host: ENV['POSTHOG_HOST'],
  secret_key: ENV['POSTHOG_PROJECT_SECRET_API_KEY'],
  migrated_from: '<provider>'
)

result = posthog.emails.send(
  to: 'jane@example.com',
  distinct_id: user.id.to_s,
  template_key: 'welcome',
  subject: 'Welcome',
  html: html
)
```

- Errors: `send` raises `PostHog::EmailError` on an API error, with `#code`, `#name`, `#status_code`, and `#message`. A bad argument raises `ArgumentError`. It answers a result whose `id` is the message id.

## PHP: `posthog/posthog-php`

```php
PostHog::init(getenv('POSTHOG_PROJECT_TOKEN'), [
    'host' => getenv('POSTHOG_HOST'),
    'migrated_from' => '<provider>',
], secretKey: getenv('POSTHOG_PROJECT_SECRET_API_KEY'));

$result = PostHog::emails()->send([
    'to' => 'jane@example.com',
    'distinct_id' => (string) $user->id,
    'template_key' => 'welcome',
    'subject' => 'Welcome',
    'html' => $html,
]);
```

- An app that creates a client object uses `new \PostHog\Client($token, $options, secretKey: ...)` and `$client->emails()`.
- Errors: `send` throws `PostHog\EmailError` on an API error and on a bad argument, with `getErrorCode()`, `getErrorName()`, `getStatusCode()`, and `getMessage()`. It answers a result whose `getId()` is the message id.

## .NET: `PostHog`

```csharp
var posthog = new PostHogClient(new PostHogOptions
{
    ProjectToken = Environment.GetEnvironmentVariable("POSTHOG_PROJECT_TOKEN"),
    HostUrl = new Uri(Environment.GetEnvironmentVariable("POSTHOG_HOST")),
    SecretKey = Environment.GetEnvironmentVariable("POSTHOG_PROJECT_SECRET_API_KEY"),
    MigratedFrom = "<provider>",
});

var sent = await posthog.Emails.SendAsync(new SendCodeEmailOptions
{
    To = "jane@example.com",
    DistinctId = user.Id.ToString(),
    TemplateKey = "welcome",
    Subject = "Welcome",
    Html = html,
});
```

- The template form is `new SendTemplateEmailOptions { To, TemplateId, TemplateData }`.
- Apps that use dependency injection register the client with `AddPostHog` and take `IPostHogEmails`.
- Errors: `SendAsync` throws `PostHog.Emails.EmailException` on an API error, with `Code`, `Name`, `StatusCode`, and `Message`. A bad argument throws `ArgumentException`. `sent.Id` is the message id. There is no sync send.

## Elixir: `posthog`

```elixir
# config/runtime.exs
config :posthog,
  api_key: System.get_env("POSTHOG_PROJECT_TOKEN"),
  api_host: System.get_env("POSTHOG_HOST"),
  secret_key: System.get_env("POSTHOG_PROJECT_SECRET_API_KEY"),
  migrated_from: "<provider>",
  enable_local_evaluation: false
```

```elixir
PostHog.Emails.send(
  to: "jane@example.com",
  distinct_id: to_string(user.id),
  template_key: "welcome",
  subject: "Welcome",
  html: html
)
```

- Errors: `send` answers `{:ok, %PostHog.Emails.SendResult{id: id}}` or `{:error, %PostHog.Emails.Error{}}`, with `:code` (a string), `:name` (an atom, such as `:validation_error`), `:message`, and `:status_code`. A bad argument answers `{:error, ...}` too.
- `enable_local_evaluation: false`: the secret key also turns on local feature flag evaluation, as in Node.js.

## Rust: `posthog-rs`

```rust
let options = ClientOptionsBuilder::default()
    .api_key(std::env::var("POSTHOG_PROJECT_TOKEN")?)
    .host(std::env::var("POSTHOG_HOST")?)
    .secret_key(std::env::var("POSTHOG_PROJECT_SECRET_API_KEY")?)
    .migrated_from("<provider>")
    .build()?;
let posthog = posthog_rs::client(options).await;

let sent = posthog
    .emails()
    .send(CodeEmail::new("jane@example.com", "welcome", "Welcome").html(html).distinct_id(user.id.to_string()))
    .await?;
```

- The template form is `TemplateEmail::new(to, template_id).template_data(json)`.
- Errors: `send` answers `Result<SendEmailResult, EmailError>`, and `sent.id` is the message id. Read `error.code()` and `error.kind()`. A build without the `async-client` feature sends without `.await`.

## The answer in every language

- The message id is PostHog's. It is not the provider's id.
- `name` follows Resend's error names, such as `validation_error` or `rate_limit_exceeded`. `code` is PostHog's own code, such as `recipient_suppressed`, `sender_not_verified`, or `quota_limited`. Branch on `code`.
- PostHog refuses a send to a suppressed address with the code `recipient_suppressed` (name `validation_error`).
- Every SDK retries network errors and rate limits on its own, with the same idempotency key, twice by default.
