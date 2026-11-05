---
title: Send with posthog-go
description: The PostHog side of a moved site in Go
---

# Send with posthog-go

For a site in Go.

## Install

`go get github.com/posthog/posthog-go@latest`, then `go mod tidy`.

## The client

```go
client, err := posthog.NewWithConfig(os.Getenv("POSTHOG_PROJECT_TOKEN"), posthog.Config{
    Endpoint:     os.Getenv("POSTHOG_HOST"),
    SecretKey:    os.Getenv("POSTHOG_PROJECT_SECRET_API_KEY"),
    MigratedFrom: "<provider>", // only when posthog.Config has it
})
```

- With `SecretKey` set, the client polls flag definitions with it, so give the key the feature flag read scope too, or it logs a failed poll each time. Tell the person.
- The app host option is `AppHost`.
- Close the client when the app exits.

## The send

- Code send: `client.Emails().Send(ctx, posthog.CodeEmail{To, TemplateKey, Subject, HTML, Text, DistinctID, IdempotencyKey})`, with `From`, `ReplyTo`, and `CaptureEngagement` (`posthog.Ptr(false)`) optional.
- Template send: `client.Emails().Send(ctx, posthog.TemplateEmail{To, TemplateID, TemplateData, DistinctID, IdempotencyKey})`.

## The answer

- The send returns a `*posthog.SendEmailResult` and an error. `ID` is the message ID.
- An API error is a `*posthog.EmailError`: read it with `errors.As`. `Code` is PostHog's error code, such as `recipient_suppressed`, `Name` is one of the coarse names the provider's `mapping.md` lists under "Code around the send", and `StatusCode` is the HTTP status.
- Suppressed recipient: `var emailErr *posthog.EmailError` and `if errors.As(err, &emailErr) && emailErr.Code == "recipient_suppressed"`.

## Check

`go build ./...` and `go vet ./...`.
