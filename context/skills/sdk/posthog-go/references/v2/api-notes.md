---
title: posthog-go v2 module paths
description: Which module paths v2 uses
---

# posthog-go v2 module paths

New installs use v2. Every v2 release has the features below.

| Package | v2 module path |
|---|---|
| Core SDK | `github.com/posthog/posthog-go/v2` |
| OpenTelemetry bridge | `github.com/posthog/posthog-go/otel/v2` |
| MCP analytics | `github.com/posthog/posthog-go/posthogmcpsdk/v2` |

v1 projects import the same paths without `/v2`. Keep them on v1.
