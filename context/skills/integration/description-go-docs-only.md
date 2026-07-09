# PostHog integration for {display_name}

This skill helps you add PostHog analytics to {display_name} applications using the official PostHog Go SDK documentation.

## Instructions

1. Detect the existing Go app structure. Check `go.mod`, `go.sum`, `cmd/`, `internal/`, HTTP/router setup, worker entry points, and existing logging/error handling.
2. Read the reference files below before changing code. They are the source of truth for SDK installation, initialization, event capture, identification, feature flags, group analytics, and error tracking.
3. Install the SDK with `go get github.com/posthog/posthog-go` instead of manually editing `go.mod`.
4. Initialize one PostHog client per process with configuration from environment variables. Close it during graceful shutdown so queued events flush.
5. Add captures at meaningful request, job, or business-action boundaries. Use a stable `DistinctId` that matches the frontend/user identity.
6. Verify with the project's normal Go commands, such as `go test ./...`, `go vet ./...`, or the repository's existing checks.

## Reference files

{references}

## Key principles

- **Environment variables**: Always use environment variables for PostHog keys. Never hardcode them.
- **Minimal changes**: Add PostHog code alongside existing integrations. Don't replace or restructure existing code.
- **Match the docs**: Follow the Go reference's initialization, capture, feature flag, and error tracking patterns exactly.
- **Analytics contract**: Treat event names, property names, and feature flag keys as part of an analytics contract. Reuse existing names and patterns found in the project. When introducing new ones, make them clear, descriptive, and consistent with existing conventions.

## Framework guidelines

{commandments}
