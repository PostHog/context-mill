package main

import (
	"log/slog"
	"os"
	"strings"

	"github.com/posthog/posthog-go/v2"
)

// newPostHogClient builds the single process-wide PostHog client when configured.
//
// Key integration points demonstrated here:
//   - One client per process. This is called once from main and the returned client
//     is shared by every request handler. Never construct a new client per request,
//     because the SDK batches events on a background goroutine.
//   - Config from the environment. The project token and host come from env vars
//     (see .env.example) so secrets never live in source.
//   - Skip client creation when unconfigured. A missing token logs a clear warning
//     outside production and returns nil instead of initializing with a blank key.
func newPostHogClient() (posthog.Client, error) {
	// Read the project token optionally and never call posthog.NewWithConfig with an empty or fallback key,
	// so unconfigured runs skip background batching cleanly.
	projectToken := strings.TrimSpace(os.Getenv("POSTHOG_PROJECT_TOKEN"))
	if projectToken == "" {
		if os.Getenv("GO_ENV") != "production" && os.Getenv("APP_ENV") != "production" {
			slog.Warn("POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured")
		}
		return nil, nil
	}

	host := strings.TrimSpace(os.Getenv("POSTHOG_HOST"))
	if host == "" {
		host = "https://us.i.posthog.com"
	}

	// Endpoint is the ingestion and flags host. We do not set PersonalApiKey here,
	// because EvaluateFlags works against the flags endpoint with just the project token.
	return posthog.NewWithConfig(projectToken, posthog.Config{
		Endpoint: host,
	})
}
