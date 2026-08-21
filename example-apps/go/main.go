// Command posthog-go-example is a tiny "burrito app" that mirrors the other
// PostHog example apps. Each route shows one server-side integration point:
//
//	/          home / login form
//	/login     user identification (capture with $set person properties)
//	/burrito   event tracking (burrito_considered)
//	/dashboard feature flags (new-dashboard-feature via EvaluateFlags)
//	/profile   error tracking (NewDefaultException)
//
// The PostHog client is created once and flushed on shutdown.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	// One client per process. Created here, shared by every handler, closed on
	// shutdown so queued events flush before we exit.
	client := newPostHogClient()

	a := &app{posthog: client}

	mux := http.NewServeMux()
	mux.HandleFunc("/", a.home)
	mux.HandleFunc("/login", a.login)
	mux.HandleFunc("/burrito", a.burrito)
	mux.HandleFunc("/dashboard", a.dashboard)
	mux.HandleFunc("/profile", a.profile)

	srv := &http.Server{Addr: ":8000", Handler: mux}

	// Graceful shutdown: on SIGINT/SIGTERM, stop the server and Close() the
	// PostHog client so the background batch of events is flushed before exit.
	// Close() blocks until the queue drains — skipping it can drop events.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Println("listening on http://localhost:8000")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-stop
	log.Println("shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}

	// Flush and shut down the PostHog client.
	if err := client.Close(); err != nil {
		log.Printf("error closing PostHog client: %v", err)
	}
	log.Println("bye")
}
