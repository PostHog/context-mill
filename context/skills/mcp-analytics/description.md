# Add PostHog MCP analytics

Use this skill to instrument a user's own **MCP server** with PostHog MCP analytics. Once instrumented, every tool call, agent intent, and failure the server handles is captured as a `$mcp_*` event in PostHog — so the user can see which tools get used, what agents are trying to do, error rates, and latency.

There are two SDKs and this skill handles both:
- **TypeScript / JavaScript** — the [`@posthog/mcp`](https://posthog.com/docs/mcp-analytics) Node package.
- **Python** — `posthog.mcp`, which ships inside the [`posthog`](https://posthog.com/docs/libraries/python) package (like `posthog.ai`).

This is **not** about adding the PostHog MCP *server* to a coding agent (that's `wizard mcp add`). This skill instruments the user's *own* MCP server code so it reports analytics about itself.

## Scope and guardrails

- **TypeScript / JavaScript and Python are supported.** Detect the language in STEP 1 and follow the matching part of every step. If the MCP server is written in anything else (Go, Rust, …), **stop**: emit `[ABORT] unsupported language for mcp analytics` on its own line and do nothing else.
- **This must be an MCP server.** If the project is a normal app with no MCP server, **stop**: emit `[ABORT] no mcp server found` on its own line and do nothing else.
- **Beta SDK.** Both SDKs are pre-1.0 and may ship breaking changes in minor releases. Pin a version (see STEP 3).
- **Minimal, additive changes only.** Add instrumentation alongside the existing server; do not restructure tool handlers or change their behavior. The wrapper is designed to be one line.

## Instructions

Follow these steps IN ORDER. Each step has a **TypeScript / JavaScript** part and a **Python** part — use the one for the language you detect in STEP 1.

### STEP 1: Identify the language and the MCP server entry point

Determine the language first, then route to the matching instructions throughout:

- **TypeScript / JavaScript** — there's a `package.json`. Look for MCP signals in dependencies and source:
  - `@modelcontextprotocol/sdk` — the official SDK (most common).
  - `mcp-handler` — the Next.js / Vercel adapter.
  - `fastmcp`, `xmcp`, or a similar TS MCP framework.
  - A custom HTTP/edge handler speaking the MCP protocol directly (JSON-RPC methods like `tools/call`, `initialize`, an `Mcp-Session-Id` header) with none of the above.

  Determine the package manager from the lockfile (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lockb`).

- **Python** — there's a `pyproject.toml`, `requirements.txt`, or `setup.py`, or `.py` sources. Look for MCP signals:
  - the official `mcp` package — `from mcp.server.fastmcp import FastMCP` or `from mcp.server.lowlevel import Server`.
  - jlowin's standalone `fastmcp` 2.0 — `from fastmcp import FastMCP`.
  - a custom HTTP/edge dispatcher (FastAPI / Starlette / Flask / edge) speaking the MCP protocol directly with no server object to wrap.

  Determine the installer (pip / uv / poetry) from the lockfile / `pyproject.toml`.

- If it's neither TS/JS nor Python, apply the guardrail above and stop.

Then identify the file and the exact place where the server is constructed or where MCP requests are dispatched, and read it before editing. If PostHog MCP analytics is already wired in (an `instrument(` call, or a `PostHogMCP` client — in either language), don't duplicate it: verify it's correct and skip to STEP 7.

### STEP 2: Choose the instrumentation path

Pick exactly one based on what STEP 1 found. When in doubt, read the bundled reference docs — `installation.md` covers the wrapping paths; `custom-servers.md` covers the custom-dispatcher paths.

**TypeScript / JavaScript:**

- **Path A — official SDK server object** (`new Server(...)` or `new McpServer(...)` from `@modelcontextprotocol/sdk`): wrap it with `instrument(server, posthog)`. One line.
- **Path B — `mcp-handler`** (`createMcpHandler((server) => { ... })`): same `instrument(server, posthog)` call, inside the setup callback. Because Vercel's transport is stateless, also wire `identify` (STEP 4) and flush per invocation (STEP 6).
- **Path C — custom dispatcher** (Hono / Express / Cloudflare Worker / edge function with no SDK server object to wrap): use the `PostHogMCP` client and call `captureToolCall` / `captureInitialize` yourself at the dispatch points.

**Python:**

- **Path P1 — a FastMCP or low-level Server** (the official `mcp` package's `FastMCP`/`Server`, or jlowin's `fastmcp` 2.0): wrap it with `instrument(server, posthog)`. One line — the SDK detects which framework it is.
- **Path P2 — custom dispatcher** (FastAPI / Starlette / Flask / edge with no server object to wrap): use the `PostHogMCP` client and call `capture_tool_call` / `capture_initialize` yourself at the dispatch points.

### STEP 3: Install the SDK

- **TypeScript / JavaScript:** install `@posthog/mcp` and `posthog-node` with the project's package manager, pinning `@posthog/mcp` to its current published version (it's pre-1.0) — e.g. `pnpm add @posthog/mcp@<latest> posthog-node`. Read the installed version back from `package.json` / the lockfile rather than guessing.
- **Python:** the SDK ships inside `posthog`, so install (or require) `posthog>=7.21` with the project's installer — e.g. `pip install "posthog>=7.21"`, `uv add posthog`, `poetry add posthog`. The MCP SDK itself (`mcp` / `fastmcp`) is a peer dependency you already have — you built the server with it — so don't add it. A custom-dispatcher (path P2) project needs nothing beyond `posthog`.

### STEP 4: Instrument the server

Create the PostHog client **once at module scope** (never per request), reading credentials from env (set up in STEP 5).

#### TypeScript / JavaScript

```ts
import { PostHog } from "posthog-node"

const posthog = new PostHog(process.env.POSTHOG_PROJECT_API_KEY, {
  host: process.env.POSTHOG_HOST, // https://us.i.posthog.com or https://eu.i.posthog.com
})
```

**Path A — official SDK server:**

```ts
import { instrument } from "@posthog/mcp"

const server = new McpServer({ name: "my-mcp-server", version: "1.0.0" })
const analytics = instrument(server, posthog) // wrap immediately after constructing the server
// register tools as usual — tools added after instrument() are still captured
```

`instrument()` is idempotent per server and returns an analytics handle (used later for custom events). It works on both the low-level `Server` and the high-level `McpServer`.

**Path B — `mcp-handler`:** call `instrument(server, posthog)` as the first line of the setup callback, with the `posthog` client created at module scope (not per request). Because the transport is stateless, group calls by user with `identify`:

```ts
const handler = createMcpHandler((server) => {
  instrument(server, posthog, {
    identify: (request, extra) => ({ distinctId: getUserId(extra) }),
  })
  server.registerTool("...", { /* ... */ }, async () => { /* ... */ })
})
```

**Path C — custom dispatcher:** swap the existing PostHog client for `PostHogMCP` (a drop-in `posthog-node` subclass) and call the capture helpers at the dispatch points. Read `custom-servers.md` for the full field reference before editing.

```ts
import { PostHogMCP } from "@posthog/mcp"

const posthog = new PostHogMCP(process.env.POSTHOG_PROJECT_API_KEY, {
  host: process.env.POSTHOG_HOST,
})

// on the initialize handshake:
posthog.captureInitialize({ clientName, clientVersion, distinctId })

// after each tools/call resolves (wrap the existing handler, time it):
const start = Date.now()
// ...run the tool...
posthog.captureToolCall({
  toolName: request.params.name,
  parameters: request.params.arguments,
  response: result,
  durationMs: Date.now() - start,
  isError: false,
  distinctId, // who the request is from, if known
  sessionId,  // your transport/session id, if you have one
})
```

Resolve `distinctId` / `sessionId` from whatever auth/session the dispatcher already has; omit them rather than inventing values. These calls are fire-and-forget and never throw, so they can't take down a tool.

#### Python

```python
import os
from posthog import Posthog

posthog = Posthog(
    os.environ["POSTHOG_PROJECT_API_KEY"],
    host=os.environ["POSTHOG_HOST"],  # https://us.i.posthog.com or https://eu.i.posthog.com
)
```

**Path P1 — FastMCP / low-level Server:**

```python
from posthog.mcp import instrument

server = FastMCP("my-mcp-server")
analytics = instrument(server, posthog)  # wrap right after constructing the server
# register tools as usual — tools added after instrument() are still captured
```

`instrument()` is idempotent per server and returns an analytics handle (used later for custom events). The same call works on the official `FastMCP`, the low-level `Server`, and jlowin's `fastmcp` 2.0.

**Path P2 — custom dispatcher:** swap the existing client for `PostHogMCP` (a drop-in `posthog` client subclass) and call the capture helpers at the dispatch points. Read `custom-servers.md` for the full field reference before editing.

```python
import time
from posthog.mcp import PostHogMCP

posthog = PostHogMCP(os.environ["POSTHOG_PROJECT_API_KEY"], host=os.environ["POSTHOG_HOST"])

# on the initialize handshake:
posthog.capture_initialize(client_name=client_name, client_version=client_version, distinct_id=distinct_id)

# after each tools/call resolves (time it):
start = time.monotonic()
# ...run the tool...
posthog.capture_tool_call(
    request.params.name,
    parameters=arguments,
    response=result,
    duration_ms=(time.monotonic() - start) * 1000,
    is_error=False,
    distinct_id=distinct_id,  # who the request is from, if known
    session_id=session_id,    # your transport/session id, if you have one
)
```

Resolve `distinct_id` / `session_id` from whatever auth/session the dispatcher already has; omit them rather than inventing values. These calls are fire-and-forget and never throw, so they can't take down a tool.

### STEP 5: Wire up credentials

- Check existing env files (`.env`, `.env.local`, etc.) for a PostHog project API key. If a valid `phc_…` key and host are already set, reference those and skip the rest of this step.
- If the key is missing, use the PostHog MCP server's `projects-get` tool to fetch the project's `api_token`. If multiple projects come back, ask the user which to use. If the MCP server isn't connected, ask the user for their project API key directly.
- Host: `https://us.i.posthog.com` for US Cloud, `https://eu.i.posthog.com` for EU Cloud.
- Write `POSTHOG_PROJECT_API_KEY` and `POSTHOG_HOST` to the appropriate env file and reference them in code (`process.env.*` in JS, `os.environ[...]` in Python) — never hardcode the key.

### STEP 6: Ensure events get flushed

The PostHog client batches events; the user owns the client's lifecycle.

**TypeScript / JavaScript:**

- **Long-running server (STDIO or a persistent HTTP server):** drain on shutdown.

  ```ts
  process.on("SIGTERM", async () => {
    await posthog.shutdown()
    process.exit(0)
  })
  ```

- **Serverless / edge (mcp-handler on Vercel, Workers, Lambda):** `SIGTERM` is unreliable — flush at the end of each invocation with `await posthog.flush()`, or `ctx.waitUntil(posthog.flush())` where supported.
- **STDIO transports specifically:** the server's stdout is the protocol channel. Do not add `console.log` for debugging — it corrupts the MCP stream. If you need SDK-internal warnings, pass a `logger` option to `instrument()` that writes to stderr or a file.

**Python:**

- **Long-running server (STDIO or persistent HTTP):** drain on exit. On the `instrument()` path, `await analytics.flush()` waits for in-flight auto-capture events, then `posthog.shutdown()` flushes and stops the client — call both from your shutdown path. For `PostHogMCP`, `posthog.shutdown()` (or `posthog.flush()`) drains the MCP captures first.
- **STDIO transports specifically:** stdout is the protocol channel — never `print()` to it. For SDK-internal warnings pass `logger=lambda m: print(m, file=sys.stderr)` (or a file writer) via `MCPAnalyticsOptions(...)`.

### STEP 7: Verify

- **TypeScript / JavaScript:** run the project's type-check and/or build script (e.g. `tsc --noEmit`, `pnpm build`) and fix any errors your changes introduced. Run any linter/formatter the project uses on the files you touched.
- **Python:** run the project's type-check / tests if present (`mypy`, `pytest`) and fix any errors your changes introduced. Run any formatter the project uses (`ruff`, `black`) on the files you touched.
- Summarize for the user: which path you used, the files you changed, the env vars to set, and that they'll see `$mcp_*` events in PostHog once the server handles its next request. Link them to https://posthog.com/docs/mcp-analytics for the dashboard and event reference.

## Reference files

{references}

`installation.md` is the source of truth for the wrapping paths (A/B and Python P1) and the full `instrument()` options table (`identify`, `context`/intent, `enableConversationId`/`enable_conversation_id`, `reportMissing`/`report_missing`, `beforeSend`/`before_send`, `eventProperties`/`event_properties`). `custom-servers.md` is the source of truth for the custom-dispatcher paths (C and P2) — `PostHogMCP`, `captureToolCall`/`capture_tool_call`, `captureInitialize`/`capture_initialize`, and the per-call field mapping. `intent.md`, `identifying-users.md`, and `conversation-id.md` cover optional enrichment; `events.md` and `custom-events.md` describe what gets captured. The event/property vocabulary is identical across both SDKs.

## Key principles

- **One server, one wrapper.** `instrument()` is idempotent; don't call it twice on the same server.
- **Module-scope client.** Construct the `PostHog` / `Posthog` / `PostHogMCP` client once, not per request.
- **Env, never hardcode.** The project API key and host come from environment variables.
- **Additive only.** Don't change tool behavior or restructure the server — just wrap/capture.
- **Don't break STDIO.** No `console.*` (JS) or `print()` (Python) on STDIO transports; use a `logger` instead.
- **Pin the beta SDK** and tell the user it's pre-1.0. (Python: `posthog.mcp` ships inside `posthog`; pin `posthog>=7.21`.)
