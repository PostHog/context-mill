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
    enable_local_evaluation=False,
    migrated_from="<provider>",  # only when the client takes it
)
```

- With `secret_key` set, the client loads flag definitions from `host` with it the first time it evaluates a flag, and a worker forked from a process that made the client, such as under Gunicorn's `preload_app`, starts polling them at once. `enable_local_evaluation=False` stops both, so the key needs no flag scope.
- The app host option is `app_host`.
- `AsyncPosthog`, from `posthog[async]`, takes the same options except `enable_local_evaluation`: it has no such option and never polls flags, so leave it out there, or the constructor raises `TypeError`. Await each call below on it. A synchronous site uses `Posthog`, and an `async` site uses `AsyncPosthog`: a call on `AsyncPosthog` without `await` sends nothing.
- `AsyncPosthog` binds to the first event loop it runs on, and raises `RuntimeError` on any other. Create it where one loop runs for the app's life, such as an ASGI app's startup, and `await posthog.shutdown()` when it stops. Where each task runs its own loop, such as `asyncio.run` per job or `async` views under WSGI, create it inside that loop and `await posthog.shutdown()` before the loop ends.
- Without the `async` extra, the first send on `AsyncPosthog` fails before it reaches PostHog.

## The send

- Code send: `posthog.emails.send(template_key=..., to=..., subject=..., html=..., text=..., distinct_id=..., idempotency_key=...)`, with `from_`, `reply_to`, `capture_engagement`, and `sensitive=True` optional. `from` is a Python keyword, so the argument is `from_`.
- `reply_to` takes one address or a list of addresses.
- Template send: `posthog.emails.send(to=..., template_id=..., template_data=..., distinct_id=..., idempotency_key=...)`.

## A deadline

For a site whose request had its own deadline, as `7-rewrite.md` says under "Set up the client":

- The client's `email_request_timeout_seconds` is the time each email request may take, 15 by default, and it takes a fraction, such as `2.5`. `email_request_max_retries` is its retries, 2 by default. A send's `max_retries=0` turns its retries off. `AsyncPosthog` takes the same.
- The send takes no deadline of its own, so a deadline needs a client of its own with `email_request_timeout_seconds` set to it.
- The SDK hands that timeout to `requests` or `httpx` as one number, which limits each wait on the network, such as connecting or the next part of the answer, not the whole request. A `requests` or `httpx` `timeout` of one number is the same limit. A limit on the whole request in the HTTP library's options, such as aiohttp's `ClientTimeout(total=5)`, is a deadline the SDK can't keep: the site stays, as Step 7 says. A timer the code puts around the call, such as `asyncio.wait_for(..., 5)`, is code around the send and stays around it.

## The answer

- The send returns a `SendEmailResult`. Its `id` is the message ID.
- On an API error it raises `EmailError`, imported from `posthog.emails`. `code` is PostHog's error code, such as `recipient_suppressed`, `name` is one of the coarse names that `7-rewrite.md` lists under "What every SDK's send takes and answers", and `status_code` is the HTTP status.
- Suppressed recipient: `except EmailError as error:` with `if error.code == "recipient_suppressed":`.
- It raises the same `EmailError` for a network error that is left after the retries, with the code `network_error`. `message` is there too.
- An error PostHog answered with a wait carries it as `error.retry_after`, in seconds, as a float; it is `None` when PostHog named none.
- A bad argument raises `TypeError` or `ValueError`, before any request.

## Check

The project's type checker on the whole project when it has one, such as `mypy` or `pyright`, and `python -m compileall -q` on the app's source directories.
