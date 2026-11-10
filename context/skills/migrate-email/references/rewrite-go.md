---
title: Send with posthog-go
description: The PostHog side of a moved site in Go
---

# Send with posthog-go

For a site in Go.

## Install

`go get github.com/posthog/posthog-go@latest`. Run `go mod tidy` only after the sites import it, in Step 8: before that, it removes the new requirement.

## The client

```go
client, err := posthog.NewWithConfig(os.Getenv("POSTHOG_PROJECT_TOKEN"), posthog.Config{
    Endpoint:     os.Getenv("POSTHOG_HOST"),
    SecretKey:    os.Getenv("POSTHOG_PROJECT_SECRET_API_KEY"),
    MigratedFrom: "<provider>", // only when posthog.Config has it
})
```

- With `SecretKey` set, the client starts polling flag definitions from `Endpoint` with it as soon as it's built, and there is no option to turn that off. Give the key the feature flag read scope too, or it logs a failed poll each time. Tell the person.
- The app host option is `AppHost`.
- Close the client when the app exits.

## The send

- Code send: `client.Emails().Send(ctx, posthog.CodeEmail{To, TemplateKey, Subject, HTML, Text, DistinctID, IdempotencyKey})`, with `From`, `ReplyTo`, and `Tracking` optional. `Tracking` takes `posthog.EmailTrackingOn()`, `posthog.EmailTrackingOff()`, or `posthog.EmailTrackingWith(posthog.EmailTrackingOptions{Opens, Clicks, Engagement})` with `posthog.Ptr` values. Open tracking off is `Tracking: posthog.EmailTrackingWith(posthog.EmailTrackingOptions{Opens: posthog.Ptr(false)})`. `CaptureEngagement` is deprecated: use `posthog.EmailTrackingOptions{Engagement: posthog.Ptr(false)}`.
- Template send: `client.Emails().Send(ctx, posthog.TemplateEmail{To, TemplateID, TemplateData, DistinctID, IdempotencyKey})`.
- `ReplyTo` is a `[]string`, a list of addresses: wrap one address as `[]string{addr}`.
- A site with no `context.Context` passes `context.Background()`.

## The answer

- The send returns a `*posthog.SendEmailResult` and an error. `ID` is the message ID.
- An API error is a `*posthog.EmailError`: read it with `errors.As`. `Code` is PostHog's error code, such as `recipient_suppressed`, `Name` is one of the coarse names that `7-rewrite.md` lists under "What every SDK's send takes and answers", and `StatusCode` is the HTTP status.
- Suppressed recipient: `var emailErr *posthog.EmailError` and `if errors.As(err, &emailErr) && emailErr.Code == "recipient_suppressed"`.
- Every error from the send is a `*posthog.EmailError`: also a network error that is left after the retries, with the code `network_error`, and a bad argument, with a code that starts with `invalid_`. `Message` is there too.

## Check

`go build ./...` and `go vet ./...`.
