# Add PostHog MCP analytics

Use this skill to instrument a user's own **MCP server** with PostHog MCP analytics. Once instrumented, every tool call, agent intent, and failure the server handles is captured as a `$mcp_*` event in PostHog. Every SDK also captures the calling model by default, so the user can compare quality, errors, and latency by model.

There are four SDKs and this skill handles all of them:
- **TypeScript / JavaScript** — the [`@posthog/mcp`](https://posthog.com/docs/mcp-analytics) Node package.
- **Python** — `posthog.mcp`, which ships inside the [`posthog`](https://posthog.com/docs/libraries/python) package (like `posthog.ai`).
- **Go** — `posthogmcpsdk`, a module in the [`posthog-go`](https://posthog.com/docs/libraries/go) repository, for servers built on the official `github.com/modelcontextprotocol/go-sdk`.
- **Ruby** — `PostHog::MCP`, which ships inside the [`posthog-ruby`](https://posthog.com/docs/libraries/ruby) gem, for servers built on the official `mcp` gem. Experimental (see the guardrail below).

This is **not** about adding the PostHog MCP *server* to a coding agent (that's `wizard mcp add`). This skill instruments the user's *own* MCP server code so it reports analytics about itself.

## Scope and guardrails

- **TypeScript / JavaScript, Python, Go, and Ruby are supported.** Detect the language in STEP 1 and follow the matching part of every step. If the MCP server is written in anything else (Rust, Java, C#, …), **stop**: emit `[ABORT] unsupported language for mcp analytics` on its own line and do nothing else.
- **This must be an MCP server.** Search thoroughly before concluding there isn't one: check dependency manifests *and* source for the STEP 1 signals across the whole project, including monorepo workspace packages and subdirectories — a server is often under `packages/*`, `apps/*`, `server/`, or `src/`, not the repo root. Only after an exhaustive search finds nothing, **stop**: emit `[ABORT] no mcp server found` on its own line, and in the same message tell the user where you looked and to re-run the command from inside the package or directory that actually defines their MCP server. Do nothing else.
- **Beta SDKs.** The TypeScript, Python, and Go SDKs are in beta and may ship breaking changes in minor releases. Pin a version (see STEP 3).
- **The Ruby SDK is experimental and not officially supported.** The MCP Analytics team doesn't maintain `PostHog::MCP`, and its API and `$mcp_*` events may change in a minor `posthog-ruby` release. Still instrument Ruby servers. Say so plainly in `posthog-mcp-analytics-report.md` and in your closing summary, and never describe the Ruby setup as production-ready.
- **Minimal, additive changes only.** Add instrumentation alongside the existing server; do not restructure tool handlers or change their behavior. The wrapper is designed to be one line.

### Abort cases

If anything blocks instrumentation, **always** emit exactly one `[ABORT] <reason>` line and stop — never halt, finish, or error out silently. The wizard catches `[ABORT]` and terminates the run for you; don't try to exit yourself. A silent stop is recorded as a failed run with no reason, which can't be acted on, so every dead end must carry a reason. Use one of:

- `[ABORT] no mcp server found` — an exhaustive search (see the guardrail above) found no MCP server in the project.
- `[ABORT] unsupported language for mcp analytics` — the server is not TypeScript/JavaScript, Python, Go, or Ruby.
- `[ABORT] could not locate the server entry point` — MCP signals are present, but the place the server is constructed or where requests are dispatched couldn't be found to instrument.
- `[ABORT] go mcp server is not built on the official go-sdk` — a Go server on another MCP library (STEP 1).
- `[ABORT] go toolchain older than 1.25` — `posthogmcpsdk` can't build (STEP 3).
- `[ABORT] ruby mcp server is not built on the official mcp gem` — a Ruby server on another MCP library (STEP 1).
- `[ABORT] ruby older than 3.0` — the project's Ruby is older than `posthog-ruby` supports (STEP 3).
- `[ABORT] ruby mcp gem older than 1.4` — `PostHog::MCP.instrument` needs `mcp` 1.4 or later (STEP 3).
- `[ABORT] <short specific reason>` — anything else that blocks the run (e.g. no readable project, or no PostHog credentials and no MCP server connected to fetch them). Keep it short and specific so it's useful when aggregated across runs.

## Instructions

Follow these steps IN ORDER. Each step has a **TypeScript / JavaScript** part, a **Python** part, a **Go** part, and a **Ruby** part — use the one for the language you detect in STEP 1.

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

- **Go** — there's a `go.mod`. The supported server is built on the official SDK: `go.mod` requires `github.com/modelcontextprotocol/go-sdk` and the code builds the server with `mcp.NewServer(...)`. The instrumentation needs go-sdk `v1.6.1` or later and Go 1.25 or later. A Go server on another library (for example `mark3labs/mcp-go`) isn't supported: emit `[ABORT] go mcp server is not built on the official go-sdk`.

- **Ruby** — there's a `Gemfile` or a `*.gemspec`. Look for MCP signals:
  - the official `mcp` gem in the `Gemfile`, `Gemfile.lock`, or gemspec, with code that builds `MCP::Server.new(...)` (tools as `MCP::Tool` classes or `define_tool`). The server runs over `MCP::Server::Transports::StdioTransport`, `MCP::Server::Transports::StreamableHTTPTransport`, or a Rails / Rack endpoint that hands the request body to `server.handle_json(...)`.
  - a Rails / Rack endpoint that parses MCP JSON-RPC itself and routes `tools/list` and `tools/call` with no `MCP::Server`.

  Record the locked `mcp` version from `Gemfile.lock` and the project's Ruby version (`.ruby-version`, the `Gemfile`'s `ruby` line, or `ruby -v`). A Ruby server on another MCP library (for example `fast-mcp`) isn't supported: emit `[ABORT] ruby mcp server is not built on the official mcp gem`.

- If it's none of TS/JS, Python, Go, or Ruby, apply the guardrail above and stop.

Then identify the file and the exact place where the server is constructed or where MCP requests are dispatched, and read it before editing. If PostHog MCP analytics is already wired in (an `instrument(` call, or a `PostHogMCP` client in TypeScript or Python, `posthogmcpsdk.Instrument(` in Go, or `PostHog::MCP.instrument(` or a `PostHog::MCP::Client` in Ruby), don't duplicate it. Verify the existing setup against STEP 4, add supported modern options that are missing, then continue through STEP 7.

### STEP 2: Choose the instrumentation path

Pick exactly one based on what STEP 1 found. When in doubt, read the bundled installation page for the language (`typescript.md`, `python.md`, `go.md`, `ruby.md`); each covers its wrapping and custom-dispatcher paths. `sdk-v2.md` covers what differs on MCP SDK v2.

#### TypeScript / JavaScript

- **Path A — official SDK server object** (`new Server(...)` or `new McpServer(...)` from the official SDK, either major): wrap it with `instrument(server, posthog)`. One line. `instrument()` detects the server's shape at runtime, so the call is the same on both majors — never branch the code you write on which major is installed.
- **Path B — `mcp-handler`** (`createMcpHandler((server) => { ... })`): same `instrument(server, posthog)` call, inside the setup callback. Because Vercel's transport is stateless, also wire `identify` (STEP 4) and flush per invocation (STEP 6).
- **Path C — custom dispatcher** (Hono / Express / Cloudflare Worker / edge function with no SDK server object to wrap): use the `PostHogMCP` client and call `captureToolCall` / `captureInitialize` yourself at the dispatch points.
- **Path D — `@rekog/mcp-nest`** (NestJS): the framework builds the server, so there's no `new McpServer` for you to wrap. Instrument it through the module's `serverMutator` hook in `McpModule.forRoot(...)`. See STEP 4.

On Paths A and B, the SDK major recorded in STEP 1 decides the specifics — STEP 3 and STEP 4 each have a matching section per major:

##### For @modelcontextprotocol/sdk (v1)

The server object comes from `@modelcontextprotocol/sdk`. Follow the **v1** sections of STEP 3 and STEP 4; `typescript.md` is the reference.

##### For @modelcontextprotocol/server (v2)

The server object comes from `@modelcontextprotocol/server`. Follow the **v2** sections of STEP 3 and STEP 4; `sdk-v2.md` is the reference for everything v2-specific.

#### Python

- **Path P1 — a high-level or low-level server** (the official `mcp` package's 1.x `FastMCP`, 2.x `MCPServer`, or `Server` from either major; or jlowin's standalone `fastmcp` package): wrap it with `instrument(server, posthog)`. One line — the SDK detects the framework and major.
- **Path P2 — custom dispatcher** (FastAPI / Starlette / Flask / edge with no server object to wrap): use the `PostHogMCP` client and call `capture_tool_call` / `capture_initialize` yourself at the dispatch points.

#### Go

- **Path G1 — official go-sdk server** (`mcp.NewServer(...)`): wrap it with `posthogmcpsdk.Instrument(server, posthogmcp.New(client), ...)`. One call, before the server accepts requests. Read `go.md` before editing.

#### Ruby

- **Path R1 — official `mcp` gem server** (`MCP::Server.new(...)`, on any transport or behind `server.handle_json`): wrap it with `PostHog::MCP.instrument(server, posthog)`. One line.
- **Path R2 — custom dispatcher** (a Rails / Rack endpoint with no `MCP::Server` to wrap): use the `PostHog::MCP::Client` and call `prepare_tool_list` / `prepare_tool_call` / `capture_tool_call` yourself at the dispatch points.

Read `ruby.md` before editing.

### STEP 3: Install the SDK

#### TypeScript / JavaScript

Install `@posthog/mcp` and `posthog-node` with the project's package manager, pinning `@posthog/mcp` to its current published version (it's in beta) — e.g. `pnpm add @posthog/mcp@<latest> posthog-node`. Read the installed version back from `package.json` / the lockfile rather than guessing: it must be `@posthog/mcp>=0.17.0`, the first release with model capture and conversation IDs on by default. Upgrade an older installed version.

**Never install an MCP SDK.** Both majors are *optional* peer dependencies of `@posthog/mcp`, and the project already has the one it uses. Adding the other pulls in a whole SDK the code never imports.

##### For @modelcontextprotocol/sdk (v1)

No extra constraint beyond the floor above.

##### For @modelcontextprotocol/server (v2)

No extra constraint beyond the floor above. Upgrading an old install matters most here: early releases rejected high-level v2 servers in a check that `instrument()` swallows, so the integration looked healthy and captured nothing.

#### Python

The SDK ships inside `posthog`, so install (or require) `posthog>=7.62.0` with the project's installer — e.g. `pip install "posthog>=7.62.0"`, `uv add "posthog>=7.62.0"`, `poetry add "posthog>=7.62.0"`. It's the first release with model capture and conversation IDs on by default on both paths, including `prepare_tool_result` for custom dispatchers. The MCP SDK is a peer dependency tested across `mcp>=1.26,<3`; don't add or change it as part of this command. jlowin's standalone `fastmcp` package is also supported. A custom-dispatcher (path P2) project needs nothing beyond `posthog`.

#### Go

Run `go get github.com/posthog/posthog-go/posthogmcpsdk@latest` in the module that contains the server, then read the version back from `go.mod`: `posthogmcpsdk` must be `v1.33.0` or later. It pulls in `posthog-go` and raises the `go-sdk` requirement to the supported minimum if needed. The package needs Go 1.25 or later; if the installed toolchain is older and `go get` can't switch to a newer one, emit `[ABORT] go toolchain older than 1.25`. Never add or change anything else in `go.mod` by hand. In the report, say whether `go get` raised the `go` directive (to `1.25.0`) or bumped go-sdk, and tell the user to check the Go version in their Dockerfiles and CI. Serving the `2026-07-28` revision needs go-sdk `v1.8.0` or later; if the project's go-sdk is older, leave it and say so in the report.

#### Ruby

The SDK ships inside `posthog-ruby`, which must be `posthog-ruby >= 3.26.2` (3.26.0 made the defaults match the other SDKs, 3.26.1 fixed `PostHog::MCP::Client.new`, 3.26.2 fixed `$mcp_tools_list`). If the project doesn't depend on it, run `bundle add posthog-ruby --version ">= 3.26.2"` in an app, or, if the server ships as a gem, add `spec.add_dependency "posthog-ruby", ">= 3.26.2"` to its gemspec and run `bundle install`. If it already depends on an older one (directly or through `posthog-rails`), raise the constraint where it's declared and run `bundle update posthog-ruby`.

The gem needs Ruby 3.0 or later; on an older Ruby, emit `[ABORT] ruby older than 3.0`. Path R1 also needs the `mcp` gem at 1.4 or later; if `Gemfile.lock` locks an older one, emit `[ABORT] ruby mcp gem older than 1.4`. Never add, upgrade, or pin the `mcp` gem yourself. On path R1, if `Gemfile.lock` has no `rack`, add it the same way (`bundle add rack` in an app, `spec.add_dependency "rack"` in a gemspec): `PostHog::MCP.instrument` loads the gem's Streamable HTTP transport, which raises `LoadError` without `rack`, even on a stdio server. This holds only until `posthog-ruby` rescues that `LoadError`; once it does, drop this step and revisit the floor. Path R2 needs nothing beyond `posthog-ruby`.

### STEP 4: Instrument the server

Create the PostHog client **once at module scope** (never per request), reading credentials from env (set up in STEP 5).

Every SDK turns on intent, model capture, and conversation IDs by default, so pass no options for them. Add an opt-in option (the missing-capability tool, `identify`, extra properties) only when the user asks for it or a path below requires it.

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
const analytics = instrument(server, posthog) // wrap immediately after constructing the server
// register tools as usual — tools added after instrument() are still captured
```

##### For @modelcontextprotocol/server (v2)

```ts
import { McpServer } from "@modelcontextprotocol/server"
import { instrument } from "@posthog/mcp"

const server = new McpServer({ name: "my-mcp-server", version: "1.0.0" })
const analytics = instrument(server, posthog) // wrap immediately after constructing the server
// register tools with registerTool() as usual — tools added after instrument() are still captured
```

v2 reminders:

- Tools register with `registerTool()` — the deprecated `server.tool()` was removed in v2.
- If the project already calls `instrument(server.server)` — a workaround for an old compatibility check that rejected high-level v2 servers — change it back to `instrument(server)`.

**Path B — `mcp-handler`:** call `instrument(server, posthog)` as the first line of the setup callback, with the `posthog` client created at module scope (not per request). Because the transport is stateless, group calls by user with `identify`:

```ts
import { instrument, getRequestHeaders } from "@posthog/mcp"

const handler = createMcpHandler((server) => {
  instrument(server, posthog, {
    identify: async (request, extra) => {
      const token = getRequestHeaders(extra)?.["authorization"]
      return token ? { distinctId: await resolveUserId(token) } : null
    },
  })
  server.registerTool("...", { /* ... */ }, async () => { /* ... */ })
})
```

**Always read request headers through `getRequestHeaders(extra)`** — in `identify`, `intentFallback`, `eventProperties` and `beforeSend` alike, on either major. The callbacks receive the MCP SDK's `extra` unchanged, and the two majors shape its headers differently — a hand-rolled read that works on one silently returns `undefined` on the other, so `identify()` returns `null` and every event goes out anonymous with no error anywhere. The helper handles both majors and returns a plain lowercase-keyed object. `sdk-v2.md` documents the per-major shapes.

**Path C — custom dispatcher:** swap the existing PostHog client for `PostHogMCP` (a drop-in `posthog-node` subclass) and call the capture helpers at the dispatch points. Read the custom-dispatcher section of `typescript.md` for the full field reference before editing.

```ts
import { PostHogMCP } from "@posthog/mcp"

const posthog = new PostHogMCP(process.env.POSTHOG_PROJECT_TOKEN, {
  host: process.env.POSTHOG_HOST,
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
      serverMutator: instrumentMutator(posthog),
    }),
  ],
})
class AppModule {}
```

`instrumentMutator` returns the server (not `instrument()`'s handle), so it slots straight into the hook. Compose with an existing `serverMutator` if there is one, and handlers nest registers after the mutator runs are still captured. For [custom events](https://posthog.com/docs/mcp-analytics/custom-events), call `instrument()` directly inside your own mutator and keep its handle, returning the server yourself.

When `statelessMode: true` creates a fresh low-level server per request, that path advertises `llm_model` but can't confirm ownership before the call, so the self-reported model can stay empty. Don't add options to work around it.

##### For @modelcontextprotocol/server (v2), any path — sessions and protocol revisions

Protocol revision is a property of each *request*, not of the server. A v2 server serves `2025-11-25` traffic too, so instrument once and never branch on the major. The `2026-07-28` revision removed the `initialize` handshake and the `Mcp-Session-Id` header, so on that traffic **every request becomes its own `$session_id`** unless conversation IDs stay on, as they are by default. Model capture works on both revisions, and its value is self-reported and unverified. `sdk-v2.md` has the rest, including MCP Apps compatibility and the current instrumentation gaps.

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

**Path P2 — custom dispatcher:** swap the existing client for `PostHogMCP` (a drop-in `posthog` client subclass) and call the helpers at the dispatch points. Read the custom-dispatcher section of `python.md` for the error path, `capture_initialize`, and stateless sessions before editing.

```python
import time
from posthog.mcp import PostHogMCP

posthog = PostHogMCP(os.environ["POSTHOG_PROJECT_TOKEN"], host=os.environ["POSTHOG_HOST"])

# when answering tools/list:
tools = posthog.prepare_tool_list(my_tools)

def handle_tools_call(name, arguments):
    prepared = posthog.prepare_tool_call(name, arguments)
    start = time.monotonic()
    result = run_tool(name, prepared.args)
    final = posthog.prepare_tool_result(result, prepared)  # adds the conversation handle
    posthog.capture_tool_call(
        name,
        intent=prepared.intent,
        intent_source=prepared.intent_source,
        llm_model=prepared.llm_model,
        llm_model_source=prepared.llm_model_source,
        parameters=prepared.args,
        response=final.result,
        duration_ms=(time.monotonic() - start) * 1000,
        session_id=final.session_id,
        conversation_id=final.conversation_id,
        distinct_id=distinct_id,  # who the request is from, if known
        protocol_version=protocol_version,  # read this from the current request
    )
    return final.result
```

Return the prepared `tools` from `tools/list`, always dispatch `prepared.args`, not the raw arguments, and return `final.result`. On failure, call `capture_tool_call` with `is_error=True, error=exc` and re-raise. On a stateless server, pass the tool's descriptor as `original_tool=` to `prepare_tool_call`. Resolve `distinct_id` from whatever auth the dispatcher already has; omit it rather than inventing a value. Pass `protocol_version` on every capture. On `2025-11-25`, use the revision the dispatcher's existing session state negotiated during initialize. On `2026-07-28`, read `MCP-Protocol-Version` from the current request because there is no initialize handshake or protocol session. If the dispatcher exposes neither source, omit the property rather than hardcoding a revision. Don't call `capture_initialize` on `2026-07-28`. These calls are fire-and-forget and never throw, so they can't take down a tool.

#### Go

Create the client once in `main` (or wherever the process starts), read the token from the environment, and wrap the server right after constructing it:

```go
import (
	"log"
	"os"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	posthog "github.com/posthog/posthog-go"
	"github.com/posthog/posthog-go/posthogmcp"
	"github.com/posthog/posthog-go/posthogmcpsdk"
)

client, err := posthog.NewWithConfig(os.Getenv("POSTHOG_PROJECT_TOKEN"), posthog.Config{
	Endpoint: "https://us.i.posthog.com", // or https://eu.i.posthog.com
})
if err != nil {
	log.Fatal(err)
}
defer client.Close()

server := mcp.NewServer(&mcp.Implementation{Name: "my-mcp-server", Version: "1.0.0"}, nil)
posthogmcpsdk.Instrument(server, posthogmcp.New(client),
	posthogmcpsdk.WithServerInfo("my-mcp-server", "1.0.0"),
)
// register tools with mcp.AddTool as usual
```

Reuse the name and version the server already passes to `mcp.NewServer` for `WithServerInfo`. Match the existing error-handling style instead of `log.Fatal` if the project has one. On a stdio transport, never log to stdout. After editing, run `go mod tidy` so the new requirements aren't left marked `// indirect`.

If the user asks for `WithMissingCapabilityTool`, also pass `&mcp.ServerOptions{HasTools: true}` to `mcp.NewServer` if the server registers no tools of its own. The Go SDK has no intent fallback, feedback tool, or task handling, and doesn't emit `$mcp_initialize`, `$mcp_tools_list`, or resource events, so don't try to add those. `WithIdentity` is optional; add it only if the server already authenticates callers (`go.md` shows how).

#### Ruby

```ruby
require "posthog/mcp"

posthog = PostHog::Client.new(
  api_key: ENV["POSTHOG_PROJECT_TOKEN"],
  host: "https://us.i.posthog.com" # or https://eu.i.posthog.com
)
```

**Path R1 — official `mcp` gem server:** instrument the server once it's built, before it handles requests:

```ruby
server = MCP::Server.new(name: "my-mcp-server", version: "1.0.0", tools: [SearchDocs])
analytics = PostHog::MCP.instrument(server, posthog)
```

`instrument` is idempotent per server and returns an analytics handle (used later for custom events). If the app uses `posthog-rails` and calls `PostHog.init`, don't create a client: call `PostHog::MCP.instrument(server)`, which uses `PostHog.client`. Make sure that call runs after `PostHog.init`, or it finds no client and sends nothing. `identify:` is optional; add it only if the server already authenticates callers, reading headers from `extra["headers"]` (lowercase keys).

- **stdio:** `$stdout` is the protocol channel. Before creating the client, send the core SDK's logs to stderr with `PostHog::Logging.logger = Logger.new($stderr)`.
- **Streamable HTTP:** `StreamableHTTPTransport`, stateful or `stateless: true`, needs nothing more. If requests reach the server through the app's own Rails / Rack endpoint (`server.handle_json(...)`), add `use PostHog::MCP::RackMiddleware` once to that Rack stack (`config.middleware.use PostHog::MCP::RackMiddleware` in Rails), so callbacks see request headers and stateless or multi-pod deployments keep one `$session_id` per client session.

**Path R2 — custom dispatcher:** create a `PostHog::MCP::Client` (a drop-in `PostHog::Client` subclass) once and call the helpers at the dispatch points. Read the custom-dispatcher section of `ruby.md` for the error path, `capture_initialize`, and sessions before editing.

```ruby
posthog = PostHog::MCP::Client.new(
  api_key: ENV["POSTHOG_PROJECT_TOKEN"],
  host: "https://us.i.posthog.com"
)

# when answering tools/list:
posthog.prepare_tool_list(TOOLS)

# for each tools/call:
prepared = posthog.prepare_tool_call(name, arguments, input_schema: tool[:inputSchema])
started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
result = run_tool(name, prepared.args)
posthog.capture_tool_call(
  name,
  intent: prepared.intent,
  intent_source: prepared.intent_source,
  llm_model: prepared.llm_model,
  llm_model_source: prepared.llm_model_source,
  parameters: prepared.args,
  response: result,
  duration_ms: (Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1000,
  distinct_id: user_id, # who the request is from, if known
  session_id: session_id, # see below
  protocol_version: protocol_version
)
```

Return the prepared list from `tools/list` and always dispatch `prepared.args`, not the raw arguments. On failure, call `capture_tool_call` with `is_error: true, error: e` and re-raise. For `session_id`, add `use PostHog::MCP::RackMiddleware` and follow the mint hook in `ruby.md`; omit identity and session values rather than inventing them. Conversation IDs aren't available on this path.

### STEP 5: Wire up credentials

- Check existing env files (`.env`, `.env.local`, etc.) for a PostHog project token. If a valid `phc_…` token and host are already set, reference those and skip the rest of this step.
- If the token is missing, use the PostHog MCP server's `projects-get` tool to fetch the project's `api_token`. If multiple projects come back, ask the user which to use. If the MCP server isn't connected, ask the user for their project token directly.
- Host: `https://us.i.posthog.com` for US Cloud, `https://eu.i.posthog.com` for EU Cloud.
- Write `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` to the appropriate env file and reference them in code (`process.env.*` in JS, `os.environ[...]` in Python) — never hardcode the token.
- **Go:** write only `POSTHOG_PROJECT_TOKEN` and read it with `os.Getenv`; the host goes in `posthog.Config.Endpoint` as in STEP 4. Go doesn't load `.env` files on its own, so tell the user to export the variable (or load it the way the project already loads config).
- **Ruby:** write only `POSTHOG_PROJECT_TOKEN` and read it with `ENV["POSTHOG_PROJECT_TOKEN"]` (a missing token disables the client instead of raising); the host goes in the client's `host:` option as in STEP 4. Ruby loads `.env` only through a gem such as `dotenv`, so if the project has none, tell the user to export the variable.

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

**Go:**

- `client.Close()` sends queued events, so it must run before the process exits. The `defer client.Close()` from STEP 4 covers a `main` that returns. If the server stops from a signal handler or calls `os.Exit` / `log.Fatal` after running, call `client.Close()` there too (deferred calls don't run on `os.Exit`).
- **STDIO transports specifically:** stdout is the protocol channel — never `fmt.Println` to it. Log to stderr.

**Ruby:**

- **Long-running server (STDIO or persistent HTTP):** add `at_exit { posthog.shutdown }` right after creating the client. On the `posthog-rails` form, add nothing: `posthog-rails` already shuts `PostHog.client` down at exit.
- **Short-lived request handlers (path R2, serverless):** call `posthog.flush` at the end of each request.
- **STDIO transports specifically:** stdout is the protocol channel — never `puts`, `p`, or `print` to it. Never suppress the gem's experimental warning: it goes to stderr, so it can't corrupt the stream. Don't set `$VERBOSE = nil`, override `Warning` or `Kernel.warn`, or redirect stderr.

### STEP 7: Verify

- **TypeScript / JavaScript:** run the project's type-check and/or build script (e.g. `tsc --noEmit`, `pnpm build`) and fix any errors your changes introduced. Run any linter/formatter the project uses on the files you touched.
- **Python:** run the project's type-check / tests if present (`mypy`, `pytest`) and fix any errors your changes introduced. Run any formatter the project uses (`ruff`, `black`) on the files you touched.
- **Go:** run `go build ./... && go vet ./...` and fix any errors your changes introduced. Run `gofmt` on the files you touched.
- **Ruby:** run `ruby -c` on each file you touched and, on path R1, `bundle exec ruby -e 'require "posthog/mcp"; PostHog::MCP.instrument(MCP::Server.new(name: "check"), nil)'` to confirm the gems load and instrument a throwaway server (the experimental and no-client warnings on stderr are expected; a `LoadError` means a missing gem). Run the linter and tests the project already uses (`bundle exec rubocop` on the files you touched, `bundle exec rspec` or `bundle exec rake test`). Don't start the server.
- Check statically that nothing you added passes options that turn model capture or conversation IDs off, and that custom dispatchers hand handlers the prepared arguments, never the raw ones.
- Only if you can exercise the server without starting it for real (an existing test suite or in-memory client): check that `tools/list` advertises `llm_model`, the handler doesn't receive it, and the call lands on `$mcp_tool_call` with a `$mcp_llm_model` (its `$mcp_llm_model_source` is `self_reported` or `client_metadata`). On a `2026-07-28` path, check the first tool call captures without an initialize request.
- The TypeScript, Python, and Ruby wrappers emit `$mcp_resources_list` and `$mcp_resource_read`, never the resource body. Only Ruby emits `$mcp_prompts_list` and `$mcp_prompt_get`. Go emits no resource events; instead of `$mcp_tool_call`, it sends `$mcp_unknown_tool` for a call to an unregistered tool and `$mcp_input_required` for each `2026-07-28` `input_required` round.
- Check every event name in the final report against `events.md`. Failed tools remain `$mcp_tool_call` events with `$mcp_is_error = true` and can emit a sibling `$exception`; there is no `$mcp_tool_failed` event.
- Summarize for the user: which path you used, the files you changed, the env vars to set, and that they'll see `$mcp_*` events in PostHog once the server handles its next request. Link them to https://posthog.com/docs/mcp-analytics for the dashboard and event reference. For Ruby, include the experimental notice from the guardrails.

## Reference files

{references}

`typescript.md`, `python.md`, `go.md`, and `ruby.md` are the installation pages, the source of truth for every path and its options. `sdk-v2.md` covers the SDK-major splits and sessions on `2026-07-28`; `intent.md`, `identifying-users.md`, and `conversation-id.md` cover optional enrichment; `events.md` and `custom-events.md` describe what gets captured.

## Key principles

- **One server, one wrapper.** `instrument()` is idempotent; don't call it twice on the same server.
- **Module-scope client.** Construct the `PostHog` / `Posthog` / `PostHogMCP` / `PostHog::Client` client once, not per request.
- **Env, never hardcode.** The project token comes from an environment variable; so does the host, except in Go and Ruby, where it's set in code.
- **Additive only.** Don't change tool behavior or restructure the server — just wrap/capture.
- **Don't break STDIO.** No `console.*` (JS), `print()` (Python), stdout writes (Go), or `puts` (Ruby) on STDIO transports; use a `logger` (or stderr in Go and Ruby) instead.
- **Pin the SDK at or above the STEP 3 floor** and tell the user the TypeScript, Python, and Go SDKs are in beta (Ruby: see the guardrails).
