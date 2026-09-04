# Add PostHog MCP analytics

Use this skill to instrument a user's own **MCP server** with PostHog MCP analytics. Once instrumented, every tool call, agent intent, and failure the server handles is captured as a `$mcp_*` event in PostHog. Supported TypeScript instrumentation paths can also capture the agent's self-reported model, so the user can compare quality, errors, and latency by model.

There are two SDKs and this skill handles both:
- **TypeScript / JavaScript** — the [`@posthog/mcp`](https://posthog.com/docs/mcp-analytics) Node package.
- **Python** — `posthog.mcp`, which ships inside the [`posthog`](https://posthog.com/docs/libraries/python) package (like `posthog.ai`).

This is **not** about adding the PostHog MCP *server* to a coding agent (that's `wizard mcp add`). This skill instruments the user's *own* MCP server code so it reports analytics about itself.

## Scope and guardrails

- **TypeScript / JavaScript and Python are supported.** Detect the language in STEP 1 and follow the matching part of every step. If the MCP server is written in anything else (Go, Rust, …), **stop**: emit `[ABORT] unsupported language for mcp analytics` on its own line and do nothing else.
- **This must be an MCP server.** Search thoroughly before concluding there isn't one: check dependency manifests *and* source for the STEP 1 signals across the whole project, including monorepo workspace packages and subdirectories — a server is often under `packages/*`, `apps/*`, `server/`, or `src/`, not the repo root. Only after an exhaustive search finds nothing, **stop**: emit `[ABORT] no mcp server found` on its own line, and in the same message tell the user where you looked and to re-run the command from inside the package or directory that actually defines their MCP server. Do nothing else.
- **Beta SDK.** Both SDKs are pre-1.0 and may ship breaking changes in minor releases. Pin a version (see STEP 3).
- **Minimal, additive changes only.** Add instrumentation alongside the existing server; do not restructure tool handlers or change their behavior. The wrapper is designed to be one line.

### Abort cases

If anything blocks instrumentation, **always** emit exactly one `[ABORT] <reason>` line and stop — never halt, finish, or error out silently. The wizard catches `[ABORT]` and terminates the run for you; don't try to exit yourself. A silent stop is recorded as a failed run with no reason, which can't be acted on, so every dead end must carry a reason. Use one of:

- `[ABORT] no mcp server found` — an exhaustive search (see the guardrail above) found no MCP server in the project.
- `[ABORT] unsupported language for mcp analytics` — the server is neither TypeScript/JavaScript nor Python.
- `[ABORT] could not locate the server entry point` — MCP signals are present, but the place the server is constructed or where requests are dispatched couldn't be found to instrument.
- `[ABORT] <short specific reason>` — anything else that blocks the run (e.g. no readable project, or no PostHog credentials and no MCP server connected to fetch them). Keep it short and specific so it's useful when aggregated across runs.

## Instructions

Follow these steps IN ORDER. Each step has a **TypeScript / JavaScript** part and a **Python** part — use the one for the language you detect in STEP 1.

### STEP 1: Identify the language and the MCP server entry point

Determine the language first, then route to the matching instructions throughout:

- **TypeScript / JavaScript** — there's a `package.json`. Look for MCP signals in dependencies and source:
  - `@modelcontextprotocol/sdk` — the official SDK, **v1** (most common).
  - `@modelcontextprotocol/server` / `@modelcontextprotocol/core` / `@modelcontextprotocol/client` — the official SDK, **v2**. A v2 project has no `@modelcontextprotocol/sdk` at all, so never read that one package's absence as "no MCP server here".
  - `mcp-handler` — the Next.js / Vercel adapter.
  - `@rekog/mcp-nest` — the NestJS adapter (tools defined with `@Tool()` decorators; the server is built inside `McpModule.forRoot(...)`, so there's no `new McpServer` in user code).
  - `fastmcp`, `xmcp`, or a similar TS MCP framework.
  - A custom HTTP/edge handler speaking the MCP protocol directly (JSON-RPC methods like `tools/call`, `initialize`, an `Mcp-Session-Id` header) with none of the above.

  Determine the package manager from the lockfile (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lockb`).

  **Record which SDK major the project is on.** STEP 2, STEP 3, and STEP 4 each contain a **For `@modelcontextprotocol/sdk` (v1)** and a **For `@modelcontextprotocol/server` (v2)** section — follow only the one matching the major found here. `sdk-v2.md` is the reference for everything v2-specific.

- **Python** — there's a `pyproject.toml`, `requirements.txt`, or `setup.py`, or `.py` sources. Look for MCP signals:
  - the official `mcp` package — `from mcp.server.fastmcp import FastMCP` on 1.x, `from mcp.server.mcpserver import MCPServer` on 2.x, or `from mcp.server.lowlevel import Server` on either major.
  - jlowin's standalone `fastmcp` 2.0 — `from fastmcp import FastMCP`.
  - a custom HTTP/edge dispatcher (FastAPI / Starlette / Flask / edge) speaking the MCP protocol directly with no server object to wrap.

  Determine the installer (pip / uv / poetry) from the lockfile / `pyproject.toml`.

  Record which official `mcp` major the project uses. The wrapper is tested against `mcp>=1.26,<3`; don't confuse this with jlowin's separately versioned `fastmcp` package.

- If it's neither TS/JS nor Python, apply the guardrail above and stop.

Then identify the file and the exact place where the server is constructed or where MCP requests are dispatched, and read it before editing. If PostHog MCP analytics is already wired in (an `instrument(` call, or a `PostHogMCP` client in either language), don't duplicate it. Verify the existing setup against STEP 4, add supported modern options that are missing, then continue through STEP 7.

### STEP 2: Choose the instrumentation path

Pick exactly one based on what STEP 1 found. When in doubt, read the bundled reference docs — `installation.md` covers the wrapping paths; `custom-servers.md` covers the custom-dispatcher paths; `sdk-v2.md` covers what differs on MCP SDK v2.

#### TypeScript / JavaScript

- **Path A — official SDK server object** (`new Server(...)` or `new McpServer(...)` from the official SDK, either major): wrap it with `instrument(server, posthog)`. One line. `instrument()` detects the server's shape at runtime, so the call is the same on both majors — never branch the code you write on which major is installed.
- **Path B — `mcp-handler`** (`createMcpHandler((server) => { ... })`): same `instrument(server, posthog)` call, inside the setup callback. Because Vercel's transport is stateless, also wire `identify` (STEP 4) and flush per invocation (STEP 6).
- **Path C — custom dispatcher** (Hono / Express / Cloudflare Worker / edge function with no SDK server object to wrap): use the `PostHogMCP` client and call `captureToolCall` / `captureInitialize` yourself at the dispatch points.
- **Path D — `@rekog/mcp-nest`** (NestJS): the framework builds the server, so there's no `new McpServer` for you to wrap. Instrument it through the module's `serverMutator` hook in `McpModule.forRoot(...)`. See STEP 4.

On Paths A and B, the SDK major recorded in STEP 1 decides the specifics — STEP 3 and STEP 4 each have a matching section per major:

##### For @modelcontextprotocol/sdk (v1)

The server object comes from `@modelcontextprotocol/sdk`. Follow the **v1** sections of STEP 3 and STEP 4; `installation.md` is the reference.

##### For @modelcontextprotocol/server (v2)

The server object comes from `@modelcontextprotocol/server`. Follow the **v2** sections of STEP 3 and STEP 4; `sdk-v2.md` is the reference for everything v2-specific.

#### Python

- **Path P1 — a high-level or low-level server** (the official `mcp` package's 1.x `FastMCP`, 2.x `MCPServer`, or `Server` from either major; or jlowin's standalone `fastmcp` package): wrap it with `instrument(server, posthog)`. One line — the SDK detects the framework and major.
- **Path P2 — custom dispatcher** (FastAPI / Starlette / Flask / edge with no server object to wrap): use the `PostHogMCP` client and call `capture_tool_call` / `capture_initialize` yourself at the dispatch points.

### STEP 3: Install the SDK

#### TypeScript / JavaScript

Install `@posthog/mcp` and `posthog-node` with the project's package manager, pinning `@posthog/mcp` to its current published version (it's pre-1.0) — e.g. `pnpm add @posthog/mcp@<latest> posthog-node`. Read the installed version back from `package.json` / the lockfile rather than guessing. Self-reported model capture requires `@posthog/mcp>=0.12.0` on wrapping paths and `@posthog/mcp>=0.13.0` on the custom-dispatcher path; upgrade an older installed version before enabling it.

**Never install an MCP SDK.** Both majors are *optional* peer dependencies of `@posthog/mcp`, and the project already has the one it uses. Adding the other pulls in a whole SDK the code never imports.

##### For @modelcontextprotocol/sdk (v1)

No extra constraint — pinning the current published `@posthog/mcp` release is enough.

##### For @modelcontextprotocol/server (v2)

`@posthog/mcp` must be **`>=0.11.2`**. If the project already depends on something older, upgrade it — earlier versions rejected high-level v2 servers in a compatibility check that `instrument()` swallows, so the integration looked healthy and captured nothing at all.

#### Python

The SDK ships inside `posthog`, so install (or require) `posthog>=7.40.0` with the project's installer — e.g. `pip install "posthog>=7.40.0"`, `uv add "posthog>=7.40.0"`, `poetry add "posthog>=7.40.0"`. Version 7.40.0 added official MCP SDK 2.x and `2026-07-28` support. The MCP SDK is a peer dependency tested across `mcp>=1.26,<3`; don't add or change it as part of this command. jlowin's standalone `fastmcp` package is also supported. A custom-dispatcher (path P2) project needs nothing beyond `posthog`.

### STEP 4: Instrument the server

Create the PostHog client **once at module scope** (never per request), reading credentials from env (set up in STEP 5).

#### TypeScript / JavaScript

```ts
import { PostHog } from "posthog-node"

const posthog = new PostHog(process.env.POSTHOG_PROJECT_TOKEN, {
  host: process.env.POSTHOG_HOST, // https://us.i.posthog.com or https://eu.i.posthog.com
})
```

**Path A — official SDK server:** wrap the server with `instrument(server, posthog)` immediately after constructing it. `instrument()` is idempotent per server and returns an analytics handle (used later for custom events). It works on both the low-level `Server` and the high-level `McpServer`, and the wrapping line is identical on both majors — only the SDK import differs. Use the section matching the major from STEP 1:

##### For @modelcontextprotocol/sdk (v1)

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { instrument } from "@posthog/mcp"

const server = new McpServer({ name: "my-mcp-server", version: "1.0.0" })
const analytics = instrument(server, posthog, {
  captureModel: true,
}) // wrap immediately after constructing the server
// register tools as usual — tools added after instrument() are still captured
```

##### For @modelcontextprotocol/server (v2)

```ts
import { McpServer } from "@modelcontextprotocol/server"
import { instrument } from "@posthog/mcp"

const server = new McpServer({ name: "my-mcp-server", version: "1.0.0" })
const analytics = instrument(server, posthog, {
  captureModel: true,
  enableConversationId: true,
}) // wrap immediately after constructing the server
// register tools with registerTool() as usual — tools added after instrument() are still captured
```

v2 reminders:

- Tools register with `registerTool()` — the deprecated `server.tool()` was removed in v2.
- `@posthog/mcp` must be `>=0.11.2` (STEP 3).
- If the project already calls `instrument(server.server)` — a workaround for an old compatibility check that rejected high-level v2 servers — change it back to `instrument(server)`.

**Path B — `mcp-handler`:** call `instrument(server, posthog)` as the first line of the setup callback, with the `posthog` client created at module scope (not per request). Because the transport is stateless, group calls by user with `identify`:

```ts
import { instrument, getRequestHeaders } from "@posthog/mcp"

const handler = createMcpHandler((server) => {
  instrument(server, posthog, {
    captureModel: true,
    enableConversationId: true,
    identify: async (request, extra) => {
      const token = getRequestHeaders(extra)?.["authorization"]
      return token ? { distinctId: await resolveUserId(token) } : null
    },
  })
  server.registerTool("...", { /* ... */ }, async () => { /* ... */ })
})
```

**Always read request headers through `getRequestHeaders(extra)`** — in `identify`, `intentFallback`, `eventProperties` and `beforeSend` alike, on either major. The callbacks receive the MCP SDK's `extra` unchanged, and the two majors shape its headers differently — a hand-rolled read that works on one silently returns `undefined` on the other, so `identify()` returns `null` and every event goes out anonymous with no error anywhere. The helper handles both majors and returns a plain lowercase-keyed object. `sdk-v2.md` documents the per-major shapes.

**Path C — custom dispatcher:** swap the existing PostHog client for `PostHogMCP` (a drop-in `posthog-node` subclass) and call the capture helpers at the dispatch points. Read `custom-servers.md` for the full field reference before editing.

```ts
import { PostHogMCP } from "@posthog/mcp"

const posthog = new PostHogMCP(process.env.POSTHOG_PROJECT_TOKEN, {
  host: process.env.POSTHOG_HOST,
  captureModel: true,
})

// when building the tools/list response:
const serverTools = getServerTools()
const advertisedTools = posthog.prepareToolList(serverTools)

// only on a 2025-11-25 initialize handshake:
posthog.captureInitialize({ clientName, clientVersion, distinctId, protocolVersion: "2025-11-25" })

// after each tools/call resolves (wrap the existing handler, time it):
const start = Date.now()
const originalTool = serverTools.find((tool) => tool.name === request.params.name)
const { args, intent, intentSource, llmModel, llmModelSource } = posthog.prepareToolCall(
  request.params.name,
  request.params.arguments,
  { originalTool },
)
const result = await runTool(request.params.name, args)
posthog.captureToolCall({
  toolName: request.params.name,
  parameters: args,
  response: result,
  durationMs: Date.now() - start,
  isError: false,
  intent,
  intentSource,
  llmModel,
  llmModelSource,
  distinctId, // who the request is from, if known
  sessionId,  // your transport/session id, if you have one
  protocolVersion, // read this from the current request
})
```

Return `advertisedTools` from `tools/list`. Always dispatch the cleaned `args`, not the raw request arguments. Pass the raw `originalTool` descriptor on every call so model ownership remains correct when `tools/list` and `tools/call` reach different replicas. The helper preserves an application-owned `llm_model` field and declines to capture it.

Resolve `distinctId` / `sessionId` from whatever auth/session the dispatcher already has; omit them rather than inventing values. Pass `protocolVersion` on every capture. On `2025-11-25`, use the revision the dispatcher's existing session state negotiated during initialize. On `2026-07-28`, read `MCP-Protocol-Version` from the current request because there is no initialize handshake or protocol session. If the dispatcher exposes neither source, omit the property rather than hardcoding a revision. Don't fabricate `$mcp_initialize` on `2026-07-28`. Conversation-id injection isn't available on the custom-dispatcher path. Model capture is self-reported and unverified. These calls are fire-and-forget and never throw, so they can't take down a tool.

**Path D — `@rekog/mcp-nest` (NestJS):** the framework builds the server, so pass a `serverMutator` to `McpModule.forRoot(...)`. Prefer the `instrumentMutator` helper — it instruments the server and returns it, so it drops straight into the hook:

```ts
import { Module } from "@nestjs/common"
import { McpModule } from "@rekog/mcp-nest"
import { PostHog, instrumentMutator } from "@posthog/mcp"

const posthog = new PostHog(process.env.POSTHOG_PROJECT_TOKEN, {
  host: process.env.POSTHOG_HOST,
})

@Module({
  imports: [
    McpModule.forRoot({
      name: "my-mcp-server",
      version: "1.0.0",
      serverMutator: instrumentMutator(posthog, {
        enableConversationId: true,
      }),
    }),
  ],
})
class AppModule {}
```

`instrumentMutator` returns the server (not `instrument()`'s handle), so it slots straight into the hook. Compose with an existing `serverMutator` if there is one, and handlers nest registers after the mutator runs are still captured. For [custom events](https://posthog.com/docs/mcp-analytics/custom-events), call `instrument()` directly inside your own mutator and keep its handle, returning the server yourself.

If mcp-nest keeps one persistent server instance, also set `captureModel: true`. Don't enable it when `statelessMode: true` creates a fresh low-level server per request: that path advertises `llm_model` but can't confirm ownership before the call, so the model property stays empty.

##### For @modelcontextprotocol/server (v2), any path — sessions and protocol revisions

Protocol revision is a property of each *request*, not of the server. A v2 server serves `2025-11-25` traffic too, so instrument once and never branch on the major. The `2026-07-28` revision removed the `initialize` handshake and the `Mcp-Session-Id` header, so on that traffic **every request becomes its own `$session_id`** unless `enableConversationId: true` is set. Enable it on supported v2 wrapping paths. `captureModel: true` works on both revisions, and its value is self-reported and unverified. `sdk-v2.md` has the rest, including MCP Apps compatibility and the current instrumentation gaps.

#### Python

```python
import os
from posthog import Posthog

posthog = Posthog(
    os.environ["POSTHOG_PROJECT_TOKEN"],
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

`instrument()` is idempotent per server and returns an analytics handle (used later for custom events). The same call works on the official MCP SDK 1.x `FastMCP`, 2.x `MCPServer`, the low-level `Server` from either major, and jlowin's standalone `fastmcp` package.

For the official `mcp` 2.x SDK, enable conversation IDs because `2026-07-28` has no protocol session:

```python
from posthog.mcp.types import MCPAnalyticsOptions

analytics = instrument(
    server,
    posthog,
    MCPAnalyticsOptions(enable_conversation_id=True),
)
```

**Path P2 — custom dispatcher:** swap the existing client for `PostHogMCP` (a drop-in `posthog` client subclass) and call the capture helpers at the dispatch points. Read `custom-servers.md` for the full field reference before editing.

```python
import time
from posthog.mcp import PostHogMCP

posthog = PostHogMCP(os.environ["POSTHOG_PROJECT_TOKEN"], host=os.environ["POSTHOG_HOST"])

# only on a 2025-11-25 initialize handshake:
posthog.capture_initialize(
    client_name=client_name,
    client_version=client_version,
    distinct_id=distinct_id,
    protocol_version="2025-11-25",
)

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
    protocol_version=protocol_version,  # read this from the current request
)
```

Resolve `distinct_id` / `session_id` from whatever auth/session the dispatcher already has; omit them rather than inventing values. Pass `protocol_version` on every capture. On `2025-11-25`, use the revision the dispatcher's existing session state negotiated during initialize. On `2026-07-28`, read `MCP-Protocol-Version` from the current request because there is no initialize handshake or protocol session. If the dispatcher exposes neither source, omit the property rather than hardcoding a revision. Don't call `capture_initialize` on `2026-07-28`. Python doesn't support self-reported model capture yet, so don't add an `llm_model` field. These calls are fire-and-forget and never throw, so they can't take down a tool.

### STEP 5: Wire up credentials

- Check existing env files (`.env`, `.env.local`, etc.) for a PostHog project token. If a valid `phc_…` token and host are already set, reference those and skip the rest of this step.
- If the token is missing, use the PostHog MCP server's `projects-get` tool to fetch the project's `api_token`. If multiple projects come back, ask the user which to use. If the MCP server isn't connected, ask the user for their project token directly.
- Host: `https://us.i.posthog.com` for US Cloud, `https://eu.i.posthog.com` for EU Cloud.
- Write `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` to the appropriate env file and reference them in code (`process.env.*` in JS, `os.environ[...]` in Python) — never hardcode the token.

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
- For any supported TypeScript path with model capture, verify `tools/list` advertises a required `llm_model` string, the tool handler doesn't receive it, and a non-`unknown` answer lands on `$mcp_tool_call` as `$mcp_llm_model` with `$mcp_llm_model_source = "self_reported"`.
- For a `2026-07-28` wrapping path, verify the first tool call captures without an initialize request. When conversation IDs are enabled, verify the returned handle is echoed on the next call and produces the same `$session_id`.
- Don't expect automatic `$mcp_resources_list`, `$mcp_resource_read`, `$mcp_prompts_list`, or `$mcp_prompt_get` events. Those names are reserved, but the wrappers don't emit them yet.
- Check every event name in the final report against `events.md`. Failed tools remain `$mcp_tool_call` events with `$mcp_is_error = true` and can emit a sibling `$exception`; there is no `$mcp_tool_failed` event.
- Summarize for the user: which path you used, the files you changed, the env vars to set, and that they'll see `$mcp_*` events in PostHog once the server handles its next request. Link them to https://posthog.com/docs/mcp-analytics for the dashboard and event reference.

## Reference files

{references}

`installation.md` is the source of truth for the wrapping paths (A/B and Python P1) and the full `instrument()` options table (`identify`, `context`/intent, TypeScript-only `captureModel`, `enableConversationId`/`enable_conversation_id`, `reportMissing`/`report_missing`, `beforeSend`/`before_send`, `eventProperties`/`event_properties`). `custom-servers.md` is the source of truth for the custom-dispatcher paths (C and P2), including the `2026-07-28` rule that no initialize event exists. `sdk-v2.md` is the source of truth for both SDK-major splits, sessions on `2026-07-28`, MCP Apps compatibility, and current instrumentation gaps. `intent.md`, `identifying-users.md`, and `conversation-id.md` cover optional enrichment; `events.md` and `custom-events.md` describe what gets captured.

## Key principles

- **One server, one wrapper.** `instrument()` is idempotent; don't call it twice on the same server.
- **Module-scope client.** Construct the `PostHog` / `Posthog` / `PostHogMCP` client once, not per request.
- **Env, never hardcode.** The project token and host come from environment variables.
- **Additive only.** Don't change tool behavior or restructure the server — just wrap/capture.
- **Don't break STDIO.** No `console.*` (JS) or `print()` (Python) on STDIO transports; use a `logger` instead.
- **Pin the beta SDK** and tell the user it's pre-1.0. (Python: `posthog.mcp` ships inside `posthog`; require `posthog>=7.40.0` for MCP SDK 2.x support.)
