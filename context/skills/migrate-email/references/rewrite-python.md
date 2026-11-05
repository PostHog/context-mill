---
title: Send with the posthog Python SDK
description: The PostHog side of a moved site in Python
---

# Send with the posthog Python SDK

For a site in Python.

## Install

Install or upgrade `posthog` to its latest release with the project's tool, such as `uv add posthog`, `poetry add posthog@latest`, or a `posthog>=<version>` line in `requirements.txt`. An app with sites in `async` code installs `posthog[async]` for its `AsyncPosthog` client.

## The client

```python
import os
from posthog import Posthog

posthog = Posthog(
    os.environ.get("POSTHOG_PROJECT_TOKEN"),
    host=os.environ.get("POSTHOG_HOST"),
    secret_key=os.environ.get("POSTHOG_PROJECT_SECRET_API_KEY"),
    migrated_from="<provider>",  # only when the client takes it
)
```

- The client loads flag definitions only when it evaluates a flag, so a client that only sends email needs no other setting.
- The app host option is `app_host`.
- `AsyncPosthog`, from `posthog[async]`, takes the same options. Await each call below on it. A synchronous site uses `Posthog`, and an `async` site uses `AsyncPosthog`: a call on `AsyncPosthog` without `await` sends nothing.
- Without the `async` extra, the first send on `AsyncPosthog` fails before it reaches PostHog.

## The send

- Code send: `posthog.emails.send(template_key=..., to=..., subject=..., html=..., text=..., distinct_id=..., idempotency_key=...)`, with `from_`, `reply_to`, and `capture_engagement` optional. `from` is a Python keyword, so the argument is `from_`.
- Template send: `posthog.emails.send(to=..., template_id=..., template_data=..., distinct_id=..., idempotency_key=...)`.
- `cc` and `bcc` take one address or a list. `attachments` takes a list of dicts with `filename`, `content`, `content_type`, and `content_id`, where `content` is `bytes` or a base64 string.

## The answer

- The send returns a `SendEmailResult`. Its `id` is the message ID.
- On an API error it raises `EmailError`, imported from `posthog.emails`. `code` is PostHog's error code, such as `recipient_suppressed`, `name` is one of the coarse names the provider's `mapping.md` lists under "Code around the send", and `status_code` is the HTTP status.
- Suppressed recipient: `except EmailError as error:` with `if error.code == "recipient_suppressed":`.
- It raises the same `EmailError` for a network error that is left after the retries, with the code `network_error`. `message` is there too.
- A bad argument raises `TypeError` or `ValueError`, before any request.

## Check

The project's type checker on the whole project when it has one, such as `mypy` or `pyright`, and `python -m compileall -q` on the app's source directories.
