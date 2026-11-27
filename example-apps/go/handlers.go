package main

import (
	"errors"
	"fmt"
	"html"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/posthog/posthog-go/v2"
)

// app holds the shared dependencies for every request handler. The optional
// PostHog client lives here and is reused across all requests.
type app struct {
	posthog posthog.Client
	mu      sync.RWMutex
	users   map[string]string
}

func (a *app) userIDForAccount(accountKey string) string {
	normalized := strings.ToLower(strings.TrimSpace(accountKey))
	a.mu.RLock()
	if a.users != nil {
		if existing, ok := a.users[normalized]; ok {
			a.mu.RUnlock()
			return existing
		}
	}
	a.mu.RUnlock()

	a.mu.Lock()
	defer a.mu.Unlock()
	if a.users == nil {
		a.users = make(map[string]string)
	}
	if existing, ok := a.users[normalized]; ok {
		return existing
	}
	id := uuid.NewString()
	a.users[normalized] = id
	return id
}

// visitor returns the distinct id for the current request and whether the
// visitor is anonymous.
//
// Signed-in users have a "user_id" cookie, and that stable UUID is the join key
// for all analytics and must match the id your frontend posthog.identify(...)
// call uses so server- and client-side events land on the same person.
//
// Signed-out visitors get a random UUID stored in a cookie so it is reused for
// the rest of the visit. Never share one fixed id across visitors because they
// would all collapse into a single person.
func visitor(w http.ResponseWriter, r *http.Request) (id string, anonymous bool) {
	if c, err := r.Cookie("user_id"); err == nil && strings.TrimSpace(c.Value) != "" {
		return strings.TrimSpace(c.Value), false
	}
	if c, err := r.Cookie("anon_id"); err == nil && strings.TrimSpace(c.Value) != "" {
		return strings.TrimSpace(c.Value), true
	}
	id = uuid.NewString()
	http.SetCookie(w, &http.Cookie{
		Name: "anon_id", Value: id, Path: "/",
		HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
	})
	return id, true
}

// options returns capture options for an event. Anonymous events set the
// process_person_profile option to false so PostHog does not create a person
// profile for the visitor.
func options(anonymous bool) posthog.Options {
	opts := posthog.NewOptions()
	if anonymous {
		opts.Set("process_person_profile", false)
	}
	return opts
}

// home renders the login form or a logout button once logged in.
func (a *app) home(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	id, anonymous := visitor(w, r)
	status := "Signed in as"
	authControls := `<form method="POST" action="/logout"><button type="submit">Log out</button></form>`
	if anonymous {
		status = "Not signed in, anonymous visitor"
		authControls = `
		<form method="POST" action="/login">
			<label>Email <input name="email" type="email" required placeholder="fan@example.com"></label>
			<button type="submit">Log in</button>
		</form>`
	}
	page(w, "Burrito app", fmt.Sprintf(`
		<p>%s: <strong>%s</strong></p>
		%s
		<ul>
			<li><a href="/burrito">Consider a burrito</a> (event tracking)</li>
			<li><a href="/dashboard">Dashboard</a> (feature flag)</li>
			<li><a href="/profile">Profile</a> (error tracking)</li>
		</ul>`, status, html.EscapeString(id), authControls))
}

// login demonstrates user identification.
//
// The Go SDK identifies a user by capturing an event with person properties set
// via the "$set" property. The DistinctId is a stable UUID and never raw PII.
func (a *app) login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	email := strings.TrimSpace(r.FormValue("email"))
	username := strings.TrimSpace(r.FormValue("username"))
	accountKey := email
	if accountKey == "" {
		accountKey = username
	}

	// Require a non-empty login identifier and never fall back to a shared hardcoded distinctId,
	// otherwise blank logins merge unrelated visitors into one PostHog person profile.
	if accountKey == "" {
		http.Error(w, "email or username is required", http.StatusBadRequest)
		return
	}

	userID := a.userIDForAccount(accountKey)

	// Persist the UUID in an HttpOnly cookie so later requests are attributed to the same user.
	http.SetCookie(w, &http.Cookie{
		Name: "user_id", Value: userID, Path: "/",
		HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
	})

	if a.posthog != nil {
		loginMethod := "email"
		if email == "" {
			loginMethod = "username"
		}
		personProps := map[string]any{}
		if email != "" {
			personProps["email"] = email
		}
		if username != "" {
			personProps["username"] = username
		}

		// "$set" attaches person properties to this distinct id, the server-side equivalent of identify().
		if err := a.posthog.Enqueue(posthog.Capture{
			DistinctId: userID,
			Event:      "user_logged_in",
			Properties: posthog.NewProperties().
				Set("login_method", loginMethod).
				Set("$set", personProps),
		}); err != nil {
			log.Printf("failed to enqueue login event: %v", err)
		}
	}

	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (a *app) logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Only capture user_logged_out when an authenticated user session actually exists.
	if c, err := r.Cookie("user_id"); err == nil && strings.TrimSpace(c.Value) != "" && a.posthog != nil {
		if enqErr := a.posthog.Enqueue(posthog.Capture{
			DistinctId: strings.TrimSpace(c.Value),
			Event:      "user_logged_out",
		}); enqErr != nil {
			log.Printf("failed to enqueue logout event: %v", enqErr)
		}
	}

	http.SetCookie(w, &http.Cookie{
		Name: "user_id", Value: "", Path: "/", MaxAge: -1,
		HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

// burrito demonstrates event tracking: capture a business event with a stable
// distinct id and non-PII event properties.
func (a *app) burrito(w http.ResponseWriter, r *http.Request) {
	userId, anonymous := visitor(w, r)

	// Per-session counter kept in a cookie so the event has a changing property.
	count := 1
	if c, err := r.Cookie("burrito_count"); err == nil {
		fmt.Sscanf(c.Value, "%d", &count)
		count++
	}
	http.SetCookie(w, &http.Cookie{
		Name: "burrito_count", Value: fmt.Sprintf("%d", count), Path: "/",
		HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
	})

	if a.posthog != nil {
		if err := a.posthog.Enqueue(posthog.Capture{
			DistinctId: userId,
			Event:      "burrito_considered",
			Properties: posthog.NewProperties().
				Set("total_considerations", count),
			Options: options(anonymous),
		}); err != nil {
			log.Printf("failed to enqueue burrito event: %v", err)
		}
	}

	page(w, "Burrito considered", fmt.Sprintf(`
		<p>You have considered a burrito <strong>%d</strong> time(s).</p>
		<p>A <code>burrito_considered</code> event was captured for <code>%s</code>.</p>
		<p><a href="/">Back home</a></p>`, count, html.EscapeString(userId)))
}

// dashboard demonstrates feature flag evaluation.
//
// Evaluate flags once per request with EvaluateFlags, then read individual flags
// off the returned snapshot with IsEnabled. Avoid the deprecated per-flag
// IsFeatureEnabled and GetFeatureFlag helpers.
func (a *app) dashboard(w http.ResponseWriter, r *http.Request) {
	userId, _ := visitor(w, r)

	showNewFeature := false
	if a.posthog != nil {
		flags, err := a.posthog.EvaluateFlags(posthog.EvaluateFlagsPayload{
			DistinctId: userId,
			FlagKeys:   []string{"new-dashboard-feature"},
		})
		if err != nil {
			// Flag evaluation failing should never take the page down, so log it and fall back to false.
			log.Printf("feature flag evaluation failed: %v", err)
		} else {
			showNewFeature = flags.IsEnabled("new-dashboard-feature")
		}
	}

	body := "<p>You are seeing the <strong>standard</strong> dashboard.</p>"
	if showNewFeature {
		body = "<p>You are seeing the <strong>new</strong> dashboard feature!</p>"
	}
	page(w, "Dashboard", body+fmt.Sprintf(`
		<p>Flag <code>new-dashboard-feature</code> for <code>%s</code>: <strong>%t</strong></p>
		<p><a href="/">Back home</a></p>`, html.EscapeString(userId), showNewFeature))
}

// profile demonstrates error tracking.
//
// The Go SDK captures exceptions via posthog.NewDefaultException, which is then
// enqueued like any other event. We trigger a failure, catch it, and report it
// while keeping the app serving.
func (a *app) profile(w http.ResponseWriter, r *http.Request) {
	userId, anonymous := visitor(w, r)

	var caught string
	if err := riskyOperation(); err != nil {
		caught = err.Error()
		log.Printf("profile risky_operation failed: %v", err)

		if a.posthog != nil {
			// Report the exception to PostHog error tracking. Arguments in order:
			// timestamp, distinct id, exception type (shown as the title), message.
			exception := posthog.NewDefaultException(
				time.Now(),
				userId,
				"ProfileDataError",
				caught,
			)
			exception.Options = options(anonymous)
			if enqErr := a.posthog.Enqueue(exception); enqErr != nil {
				log.Printf("failed to enqueue exception: %v", enqErr)
			}
		}
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
