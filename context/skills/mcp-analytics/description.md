# Add PostHog MCP analytics

Use this skill to instrument a user's own **MCP server** with PostHog MCP analytics via the [`@posthog/mcp`](https://posthog.com/docs/mcp-analytics) SDK. Once instrumented, every tool call, agent intent, and failure the server handles is captured as a `$mcp_*` event in PostHog — so the user can see which tools get used, what agents are trying to do, error rates, and latency.

This is **not** about adding the PostHog MCP *server* to a coding agent (that's `wizard mcp add`). This skill instruments the user's *own* MCP server code so it reports analytics about itself.

## Scope and guardrails

- **TypeScript / JavaScript only.** `@posthog/mcp` is a Node SDK. If the MCP server is written in Python, Go, Rust, or anything else, **stop**: emit `[ABORT] not a javascript mcp server` on its own line and do nothing else. (MCP analytics is TS/JS-only today; a Python SDK is on the roadmap.) Do not attempt to instrument a non-JS server.
- **This must be an MCP server.** If the project is a normal app with no MCP server, **stop**: emit `[ABORT] no mcp server found` on its own line and do nothing else.
- **Beta SDK — pin the version.** `@posthog/mcp` is pre-1.0 and may ship breaking changes in minor releases. Install it pinned (see STEP 3).
- **Minimal, additive changes only.** Add instrumentation alongside the existing server; do not restructure tool handlers or change their behavior. The wrapper is designed to be one line.

## Instructions

Follow these steps IN ORDER.

### STEP 1: Confirm this is a TS/JS MCP server, and find its entry point

- Read `package.json`. Confirm the project is TypeScript/JavaScript. If it is not, apply the guardrail above and stop.
- Look for MCP server signals in dependencies and source:
  - `@modelcontextprotocol/sdk` — the official SDK (most common).
  - `mcp-handler` — the Next.js / Vercel adapter.
  - `fastmcp`, `xmcp`, or a similar TS MCP framework.
  - A custom HTTP/edge handler that speaks the MCP protocol directly (JSON-RPC methods like `tools/call`, `initialize`, an `Mcp-Session-Id` header) without any of the above.
- Identify the file and the exact place where the server is constructed or where MCP requests are dispatched. Read it before editing.
- Determine the package manager from the lockfile (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lockb`).
- If PostHog MCP analytics is already wired in (an `instrument(` call from `@posthog/mcp`, or a `PostHogMCP` client), don't duplicate it — verify it's correct and skip to STEP 7.

### STEP 2: Choose the instrumentation path

Pick exactly one based on what STEP 1 found. When in doubt, read the bundled reference docs — `installation.md` covers paths A and B; `custom-servers.md` covers path C.

- **Path A — official SDK server object** (`new Server(...)` or `new McpServer(...)` from `@modelcontextprotocol/sdk`): wrap it with `instrument(server, posthog)`. One line.
- **Path B — `mcp-handler`** (`createMcpHandler((server) => { ... })`): same `instrument(server, posthog)` call, inside the setup callback. Because Vercel's transport is stateless, also wire `identify` (STEP 4) and flush per invocation (STEP 6).
- **Path C — custom dispatcher** (Hono / Express / Cloudflare Worker / edge function with no SDK server object to wrap): use the `PostHogMCP` client and call `captureToolCall` / `captureInitialize` yourself at the dispatch points. More placement, same resulting events.

### STEP 3: Install the SDKs

- Install `@posthog/mcp` and `posthog-node` using the project's package manager. Pin `@posthog/mcp` to its current published version (it's pre-1.0) — e.g. `pnpm add @posthog/mcp@<latest> posthog-node`. Read the installed `@posthog/mcp` version back from `package.json` / the lockfile rather than guessing a number.
- Run the install as a background task; continue with the next steps while it completes. Do not hand-edit dependency versions in `package.json`.

### STEP 4: Instrument the server

Create the `posthog-node` client **once at module scope** (never per request), reading credentials from env (set up in STEP 5):

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

### STEP 5: Wire up credentials

- Check existing env files (`.env`, `.env.local`, etc.) for a PostHog project API key. If a valid `phc_…` key and host are already set, reference those and skip the rest of this step.
- If the key is missing, use the PostHog MCP server's `projects-get` tool to fetch the project's `api_token`. If multiple projects come back, ask the user which to use. If the MCP server isn't connected, ask the user for their project API key directly.
- Host: `https://us.i.posthog.com` for US Cloud, `https://eu.i.posthog.com` for EU Cloud.
- Write `POSTHOG_PROJECT_API_KEY` and `POSTHOG_HOST` to the appropriate env file and reference them in code — never hardcode the key.

### STEP 6: Ensure events get flushed

`posthog-node` batches events; the user owns the client's lifecycle.

- **Long-running server (STDIO or a persistent HTTP server):** drain on shutdown.

  ```ts
  process.on("SIGTERM", async () => {
    await posthog.shutdown()
    process.exit(0)
  })
  ```

- **Serverless / edge (mcp-handler on Vercel, Workers, Lambda):** `SIGTERM` is unreliable — flush at the end of each invocation with `await posthog.flush()`, or `ctx.waitUntil(posthog.flush())` where supported.
- **STDIO transports specifically:** the server's stdout is the protocol channel. Do not add `console.log` for debugging — it corrupts the MCP stream. If you need SDK-internal warnings, pass a `logger` option to `instrument()` that writes to stderr or a file.

### STEP 7: Verify

- Run the project's type-check and/or build script from `package.json` (e.g. `tsc --noEmit`, `pnpm build`) and fix any errors your changes introduced.
- Run any linter/formatter the project uses on the files you touched.
- Summarize for the user: which path you used, the files you changed, the env vars to set, and that they'll see `$mcp_*` events in PostHog once the server handles its next request. Link them to https://posthog.com/docs/mcp-analytics for the dashboard and event reference.

## Reference files

{references}

`installation.md` is the source of truth for paths A and B and the full `instrument()` options table (`identify`, `context`/intent, `enableConversationId`, `reportMissing`, `beforeSend`, `eventProperties`). `custom-servers.md` is the source of truth for path C (`PostHogMCP`, `captureToolCall`, `captureInitialize`, and the per-call field mapping). `intent.md`, `identifying-users.md`, and `conversation-id.md` cover optional enrichment; `events.md` and `custom-events.md` describe what gets captured.

## Key principles

- **One server, one wrapper.** `instrument()` is idempotent; don't call it twice on the same server.
- **Module-scope client.** Construct the `PostHog` / `PostHogMCP` client once, not per request.
- **Env, never hardcode.** The project API key and host come from environment variables.
- **Additive only.** Don't change tool behavior or restructure the server — just wrap/capture.
- **Don't break STDIO.** No `console.*` logging on STDIO transports; use a `logger` instead.
- **Pin the beta SDK** and tell the user it's pre-1.0.
