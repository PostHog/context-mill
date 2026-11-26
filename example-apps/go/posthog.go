package main

import (
	"log"
	"os"

	"github.com/posthog/posthog-go/v2"
)

// newPostHogClient builds the single, process-wide PostHog client.
//
// Key integration points demonstrated here:
//   - One client per process. This is called exactly once from main and the
//     returned client is shared by every request handler. Never construct a new
//     client per request — the SDK batches events on a background goroutine, and
//     a fresh client per request would defeat that and leak resources.
//   - Config from the environment. The project token and host come from env vars
//     (see .env.example) so secrets never live in source.
//   - Fail loudly, but never break the app. A blank token logs a clear warning
//     and we continue with a client anyway; the app stays up, and the missing
//     config is obvious in the logs.
func newPostHogClient() posthog.Client {
	projectToken := os.Getenv("POSTHOG_PROJECT_TOKEN")

	host := os.Getenv("POSTHOG_HOST")
	if host == "" {
		host = "https://us.i.posthog.com"
	}

	if projectToken == "" {
		log.Println("POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, " +
			"this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured")
	}

	// Endpoint is the ingestion/flags host. We do not set PersonalApiKey here:
	// EvaluateFlags works against the flags endpoint with just the project token.
	client, err := posthog.NewWithConfig(projectToken, posthog.Config{
		Endpoint: host,
	})
	if err != nil {
		// NewWithConfig only errors on an invalid interval/config, not on a bad
		// token, so this is a genuine programmer error — fail fast.
		log.Fatalf("failed to create PostHog client: %v", err)
	}

	return client
}
