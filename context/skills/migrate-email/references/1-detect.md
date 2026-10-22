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

Read the provider's `sdk-reference.md`. It lists the provider's packages, imports, clients, and HTTP host, and the packages that look related but are not the provider.

The provider is in this project when at least one of these is true:

- Its package is in a dependency manifest, such as `package.json`, `requirements.txt`, `pyproject.toml`, `Gemfile`, `composer.json`, or `go.mod`.
- Source code imports it or creates its client.
- Source code calls its HTTP host.

Search the source code, not only the manifest: a package without a call site is not a migration. Skip `node_modules`, build output, and lockfiles.

A rendering package alone, such as `@react-email/components`, is not the provider. It only tells you how some emails are rendered.

When you find nothing, stop before any change:

```
[ABORT] no email provider sends found
```

Do not widen the search to other email providers. That outcome is correct, not a failure to work around.

When you find the provider, note each file that uses it for Step 3, and continue.
