---
title: Find the email provider in the code
next_step: 2-preflight.md
---

# Step 1, find the email provider in the code

Discovery only. Do not change any file.

## Status

```
[STATUS] Looking for the email provider
```

## Procedure

Read the provider's `sdk-reference.md`. It lists the provider's packages, imports, clients, send calls, HTTP host, SMTP host, and framework mailers, and the packages that look related but are not the provider.

The provider is in this project when at least one of these is true:

- Its package is in a dependency manifest, such as `package.json`, `requirements.txt`, `pyproject.toml`, `Gemfile`, `composer.json`, or `go.mod`.
- Source code imports it or creates its client.
- Source code calls its HTTP host.
- Source code, mail config, or an example env file names its SMTP host or its framework mailer.

Search the source code, not only the manifest. Skip `node_modules`, build output, and lockfiles.

The migration needs at least one send: a send call, a request to the send route, or mail through the SMTP host or the framework mailer. A package without a send is not a migration, and neither are calls that only read contacts, domains, or an email's status.

A rendering package alone, such as `@react-email/components`, is not the provider. It only tells you how some emails are rendered.

When you find no send, stop before any change:

```
[ABORT] no email provider sends found
```

Do not widen the search to other email providers. That outcome is correct, not a failure to work around.

When you find a send, note each file that uses the provider for Step 3, and continue.
