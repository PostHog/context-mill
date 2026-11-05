---
title: Send with the PostHog .NET SDK
description: The PostHog side of a moved site in C# or F# on .NET
---

# Send with the PostHog .NET SDK

For a site in C# or F# on .NET. A site that sends through a mailer library, such as FluentEmail, stays on the provider: the provider's `mapping.md` says so.

## Install

`dotnet add package PostHog`, which adds its latest release.

## The client

Set these on `PostHogOptions`:

- `SecretKey`, from `POSTHOG_PROJECT_SECRET_API_KEY`. Read it where the app reads its provider key, such as an environment variable, user secrets, or `appsettings.json` with the value from the environment.
- `MigratedFrom`, set to `<provider>`, only when `PostHogOptions` has it.
- `AppHost`, the app host option.

With ASP.NET's `builder.AddPostHog()`, set the options in the `PostHog` configuration section, such as `PostHog:SecretKey`, and inject `IPostHogEmails` where the site sends. Otherwise use `posthog.Emails` on a `PostHogClient` that the app creates once.

With `SecretKey` set, the client loads flag definitions from its host with it when it evaluates a flag. A client that only sends email never evaluates one, so it needs no other setting.

## The send

- Code send: `await emails.SendAsync(new SendCodeEmailOptions { To, TemplateKey, Subject, Html, Text, DistinctId, IdempotencyKey })`, with `From`, `ReplyTo`, and `CaptureEngagement` optional.
- Template send: `await emails.SendAsync(new SendTemplateEmailOptions { To, TemplateId, TemplateData, DistinctId, IdempotencyKey })`.
- `ReplyTo` is a list, and `TemplateId` is a `Guid`.
- There is no synchronous send. A site in a method that is not `async` and doesn't return the send's `Task` stays, with the reason `synchronous .NET send`, unless the person agrees to make the method and its callers `async`. Never block on `SendAsync` with `.Result` or `.Wait()`.

## The answer

- The send returns a `SendEmailResult`. `Id` is the message ID, a `string`.
- On an API error it throws `EmailException`. `Code` is PostHog's error code, such as `recipient_suppressed`, `Name` is one of the coarse names that `7-rewrite.md` lists under "What every SDK's send takes and answers", and `StatusCode` is the HTTP status.
- Suppressed recipient: `catch (EmailException e) when (e.Code == "recipient_suppressed")`.
- It throws the same `EmailException` for a network error that is left after the retries, with the code `network_error`. `Message` is there too.
- A bad argument throws `ArgumentException`, before any request.

## Check

`dotnet build` on the solution or the project that holds the sites.
