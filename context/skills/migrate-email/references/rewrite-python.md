---
title: Send with the posthog Python SDK
description: The PostHog side of a moved site in Python
---

# Send with the posthog Python SDK

For a site in Python.

## Install

Install or upgrade `posthog` to its latest release with the project's tool, such as `uv add posthog`, `poetry add posthog@latest`, or a `posthog>=<version>` line in `requirements.txt`. An app that sends from `async` code uses `posthog[async]` and its `AsyncPosthog` client.

## The client

```python
import os
from posthog import Posthog

posthog = Posthog(
    os.environ["POSTHOG_PROJECT_TOKEN"],
    host=os.environ["POSTHOG_HOST"],
    secret_key=os.environ["POSTHOG_PROJECT_SECRET_API_KEY"],
    migrated_from="<provider>",  # only when the client takes it
)
```

- The client loads flag definitions only when it evaluates a flag, so a client that only sends email needs no other setting.
- The app host option is `app_host`.
- With `AsyncPosthog`, await each call below.

## The send

- Code send: `posthog.emails.send(template_key=..., to=..., subject=..., html=..., text=..., distinct_id=..., idempotency_key=...)`, with `from_`, `reply_to`, and `capture_engagement` optional. `from` is a Python keyword, so the argument is `from_`.
- Template send: `posthog.emails.send(to=..., template_id=..., template_data=..., distinct_id=..., idempotency_key=...)`.

## The answer

- The send returns a `SendEmailResult`. Its `id` is the message ID.
- On an API error it raises `EmailError`, imported from `posthog.emails`. `code` is PostHog's error code, such as `recipient_suppressed`, `name` is one of the coarse names the provider's `mapping.md` lists under "Code around the send", and `status_code` is the HTTP status.
- Suppressed recipient: `except EmailError as error:` with `if error.code == "recipient_suppressed":`.

## Check

The project's type checker when it has one, such as `mypy` or `pyright`, and `python -m compileall -q` on each changed file.
