package main

import (
	"errors"
	"fmt"
	"html"
	"log"
	"net/http"
	"time"

	"github.com/posthog/posthog-go"
)

// app holds the shared dependencies for every request handler. The single
// PostHog client lives here and is reused across all requests.
type app struct {
	posthog posthog.Client
}

// distinctId returns a stable user id for the current request, falling back to
// "anonymous" before anyone has logged in. This id is the join key for all
// analytics: it MUST match the id your frontend `posthog.identify(...)` call
// uses so server- and client-side events land on the same person.
func distinctId(r *http.Request) string {
	if c, err := r.Cookie("user_id"); err == nil && c.Value != "" {
		return c.Value
	}
	return "anonymous"
}

// home renders the login form (or a short greeting once logged in).
func (a *app) home(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	page(w, "Burrito app", fmt.Sprintf(`
		<p>Signed in as: <strong>%s</strong></p>
		<form method="POST" action="/login">
			<label>User id <input name="user_id" value="burrito-fan-42"></label>
			<label>Email <input name="email" value="fan@example.com"></label>
			<button type="submit">Log in</button>
		</form>
		<ul>
			<li><a href="/burrito">Consider a burrito</a> (event tracking)</li>
			<li><a href="/dashboard">Dashboard</a> (feature flag)</li>
			<li><a href="/profile">Profile</a> (error tracking)</li>
		</ul>`, html.EscapeString(distinctId(r))))
}

// login demonstrates user identification.
//
// The Go SDK identifies a user by capturing an event with person properties set
// via the "$set" property. The DistinctId is the stable user id and must match
// the id used by your frontend identify() call.
func (a *app) login(w http.ResponseWriter, r *http.Request) {
	userId := r.FormValue("user_id")
	if userId == "" {
		userId = "burrito-fan-42"
	}
	email := r.FormValue("email")

	// Persist the id in a simple cookie so later requests are attributed.
	// HttpOnly keeps it away from client-side JS; Secure sends it over HTTPS
	// only; SameSite guards against CSRF.
	http.SetCookie(w, &http.Cookie{
		Name: "user_id", Value: userId, Path: "/",
		HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
	})

	a.posthog.Enqueue(posthog.Capture{
		DistinctId: userId,
		Event:      "user_logged_in",
		Properties: posthog.NewProperties().
			Set("login_method", "email").
			// "$set" attaches person properties to this distinct id — the
			// server-side equivalent of identify().
			Set("$set", map[string]any{"email": email}),
	})

	http.Redirect(w, r, "/", http.StatusSeeOther)
}

// burrito demonstrates event tracking: capture a business event with a stable
// distinct id and a couple of event properties.
func (a *app) burrito(w http.ResponseWriter, r *http.Request) {
	userId := distinctId(r)

	// Toy per-session counter kept in a cookie — just so the event has a
	// changing property to show off.
	count := 1
	if c, err := r.Cookie("burrito_count"); err == nil {
		fmt.Sscanf(c.Value, "%d", &count)
		count++
	}
	http.SetCookie(w, &http.Cookie{
		Name: "burrito_count", Value: fmt.Sprintf("%d", count), Path: "/",
		HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
	})

	a.posthog.Enqueue(posthog.Capture{
		DistinctId: userId,
		Event:      "burrito_considered",
		Properties: posthog.NewProperties().
			Set("total_considerations", count),
	})

	page(w, "Burrito considered", fmt.Sprintf(`
		<p>You have considered a burrito <strong>%d</strong> time(s).</p>
		<p>A <code>burrito_considered</code> event was captured for <code>%s</code>.</p>
		<p><a href="/">Back home</a></p>`, count, html.EscapeString(userId)))
}

// dashboard demonstrates feature flag evaluation.
//
// Evaluate flags once per request with EvaluateFlags, then read individual flags
// off the returned snapshot with IsEnabled. This is the current API — avoid the
// deprecated per-flag IsFeatureEnabled/GetFeatureFlag helpers.
func (a *app) dashboard(w http.ResponseWriter, r *http.Request) {
	userId := distinctId(r)

	showNewFeature := false
	flags, err := a.posthog.EvaluateFlags(posthog.EvaluateFlagsPayload{
		DistinctId: userId,
		FlagKeys:   []string{"new-dashboard-feature"},
	})
	if err != nil {
		// Flag evaluation failing should never take the page down — log it and
		// fall back to the flag being off.
		log.Printf("feature flag evaluation failed: %v", err)
	} else {
		showNewFeature = flags.IsEnabled("new-dashboard-feature")
	}

	body := "<p>You are seeing the <strong>standard</strong> dashboard.</p>"
	if showNewFeature {
		body = "<p>🎉 You are seeing the <strong>new</strong> dashboard feature!</p>"
	}
	page(w, "Dashboard", body+fmt.Sprintf(`
		<p>Flag <code>new-dashboard-feature</code> for <code>%s</code>: <strong>%t</strong></p>
		<p><a href="/">Back home</a></p>`, html.EscapeString(userId), showNewFeature))
}

// profile demonstrates error tracking.
//
// The Go SDK captures exceptions via posthog.NewDefaultException, which is then
// enqueued like any other event. We deliberately trigger a failure, catch it,
// and report it — the app keeps serving.
func (a *app) profile(w http.ResponseWriter, r *http.Request) {
	userId := distinctId(r)

	var caught string
	if err := riskyOperation(); err != nil {
		caught = err.Error()
		log.Printf("profile risky_operation failed: %v", err)

		// Report the exception to PostHog error tracking. Arguments in order:
		// timestamp, distinct id, exception type (shown as the title), message.
		exception := posthog.NewDefaultException(
			time.Now(),
			userId,
			"ProfileDataError",
			caught,
		)
		a.posthog.Enqueue(exception)
	}

	page(w, "Profile", fmt.Sprintf(`
		<p>User: <strong>%s</strong></p>
		<p>Triggered and captured an exception: <code>%s</code></p>
		<p><a href="/">Back home</a></p>`, html.EscapeString(userId), html.EscapeString(caught)))
}

func riskyOperation() error {
	return errors.New("profile data source is temporarily unavailable")
}

// page writes a minimal HTML document so the example needs no template files.
func page(w http.ResponseWriter, title, body string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `<!doctype html><html><head><meta charset="utf-8">`+
		`<title>%s</title></head><body><h1>%s</h1>%s</body></html>`, title, title, body)
}
