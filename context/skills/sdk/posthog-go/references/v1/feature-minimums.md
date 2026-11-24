---
title: posthog-go v1 module paths and feature minimums
description: Which module paths v1 uses, and the MCP analytics minimum
---

# posthog-go v1 module paths and feature minimums

Stay on v1 when the project already imports it. Never switch a v1 project to the `/v2` paths.

| Package | v1 module path | Minimum |
|---|---|---|
| Core SDK | `github.com/posthog/posthog-go` | — |
| OpenTelemetry bridge | `github.com/posthog/posthog-go/otel` | — |
| MCP analytics | `github.com/posthog/posthog-go/posthogmcpsdk` | v1.34.0 (first with `WithIntentFallback`) |

For MCP analytics, run `go get github.com/posthog/posthog-go/posthogmcpsdk@latest`, the v1 path. If `go.mod` holds `posthogmcpsdk` below v1.34.0 and `go get` can't raise it (a `replace` or `exclude` directive), keep `go.mod` and emit `[ABORT] posthog sdk upgrade required: posthogmcpsdk <current> (requires >=v1.34.0)`; in the main wizard run, complete the `mcp-analytics` task as not needed with that reason.

v2 (not this skill) adds `/v2` to each path: `github.com/posthog/posthog-go/v2`, `.../otel/v2`, `.../posthogmcpsdk/v2`.
