---
title: posthog-go v1 module paths
description: Which module paths v1 uses
---

# posthog-go v1 module paths

Stay on v1 when the project already imports it. Never switch a v1 project to the `/v2` paths.

| Package | v1 module path |
|---|---|
| Core SDK | `github.com/posthog/posthog-go` |
| OpenTelemetry bridge | `github.com/posthog/posthog-go/otel` |
| MCP analytics | `github.com/posthog/posthog-go/posthogmcpsdk` |

For MCP analytics, run `go get github.com/posthog/posthog-go/posthogmcpsdk@latest`, the v1 path.

v2 (not this skill) adds `/v2` to each path: `github.com/posthog/posthog-go/v2`, `.../otel/v2`, `.../posthogmcpsdk/v2`.
