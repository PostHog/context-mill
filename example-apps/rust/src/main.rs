//! A tiny "burrito" web service that mirrors the other PostHog example apps.
//!
//! Each route shows one integration point of the `posthog-rs` server SDK:
//!   * `/`          — home / login page
//!   * `/login`     — user identification (attach person properties)
//!   * `/burrito`   — event tracking (`burrito_considered`)
//!   * `/dashboard` — feature flags (`new-dashboard-feature`, snapshot API)
//!   * `/profile`   — error tracking (`capture_exception`)
//!
//! The PostHog client is built **once per process** and shared through Axum
//! state (an `Arc<Client>`). It is never constructed per request.

use std::io::{Error as IoError, ErrorKind};
use std::sync::Arc;

use axum::{
    extract::State,
    response::{Html, IntoResponse, Redirect},
    routing::{get, post},
    Form, Router,
};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use posthog_rs::{
    CaptureExceptionOptions, Client, ClientOptions, EvaluateFlagsOptions, Event,
};
use serde::Deserialize;
use uuid::Uuid;

/// Shared application state. `Arc<Client>` is cheap to clone and lets every
/// request handler reuse the single process-wide PostHog client.
type AppState = Arc<Client>;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    // --- Config from the environment (never hardcode secrets) --------------
    let token = std::env::var("POSTHOG_PROJECT_TOKEN").unwrap_or_default();
    let host = std::env::var("POSTHOG_HOST")
        .unwrap_or_else(|_| "https://us.i.posthog.com".to_string());

    // Fail loudly, but don't break the app: a blank token logs a clear warning
    // and the server still boots (captures simply won't be delivered).
    if token.trim().is_empty() {
        tracing::warn!(
            "POSTHOG_PROJECT_TOKEN is not set. PostHog events will NOT be delivered. \
             Set it in your environment (see .env.example) to enable analytics."
        );
    }

    // --- One client per process --------------------------------------------
    // `client()` takes anything convertible into `ClientOptions`. The tuple
    // form `(api_key, host)` sets both, so we honor POSTHOG_HOST. We build the
    // client once here and share it via Axum state for the whole process.
    let options = ClientOptions::from((token.as_str(), host.as_str()));
    let client: AppState = Arc::new(posthog_rs::client(options).await);

    let app = Router::new()
        .route("/", get(home))
        .route("/login", post(login))
        .route("/burrito", post(consider_burrito))
        .route("/dashboard", get(dashboard))
        .route("/profile", get(profile))
        .with_state(client.clone());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8000")
        .await
        .expect("failed to bind 0.0.0.0:8000");
    tracing::info!("listening on http://localhost:8000");

    // Serve until Ctrl+C, then flush and shut the client down cleanly.
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("server error");

    // --- Explicit flush + shutdown -----------------------------------------
    // `capture` is fire-and-forget, so queued events must be flushed before the
    // process exits or they are lost. `shutdown` stops the background worker.
    tracing::info!("flushing PostHog events before exit...");
    client.flush().await;
    client.shutdown().await;
}

/// Resolve the distinct id for this request and whether the visitor is anonymous.
///
/// Signed-in users have a `user_id` cookie; that stable id must match the id your
/// frontend `posthog.identify(...)` uses so server-side and client-side events
/// attribute to the same person.
///
/// Signed-out visitors get a random UUID stored in an `anon_id` cookie, so it is
/// reused for the rest of the visit instead of every visitor sharing one id. Return
/// the (possibly updated) jar from the handler so the cookie reaches the browser.
fn visitor(jar: CookieJar) -> (CookieJar, String, bool) {
    if let Some(c) = jar.get("user_id") {
        let id = c.value().to_string();
        return (jar, id, false);
    }
    if let Some(c) = jar.get("anon_id") {
        let id = c.value().to_string();
        return (jar, id, true);
    }
    let id = Uuid::new_v4().to_string();
    let jar = jar.add(Cookie::new("anon_id", id.clone()));
    (jar, id, true)
}

/// Anonymous events set `$process_person_profile` to false so PostHog does not
/// create a person profile for the visitor.
fn mark_anonymous(event: &mut Event, anonymous: bool) {
    if anonymous {
        let _ = event.insert_prop("$process_person_profile", false);
    }
}

// ---------------------------------------------------------------------------
// Home / login page
// ---------------------------------------------------------------------------
async fn home(jar: CookieJar) -> impl IntoResponse {
    let (jar, user, anonymous) = visitor(jar);
    let status = if anonymous {
        "Not signed in, anonymous visitor"
    } else {
        "Signed in as"
    };
    // Escape user-controlled values before putting them in HTML (prevents XSS).
    let user = html_escape::encode_text(&user);
    let page = Html(format!(
        r#"<h1>Burrito app</h1>
<p>{status}: <strong>{user}</strong></p>
<form method="post" action="/login">
  <input name="user_id" placeholder="user id" required>
  <input name="email" placeholder="email (optional)">
  <button type="submit">Log in</button>
</form>
<hr>
<form method="post" action="/burrito"><button>Consider a burrito</button></form>
<p><a href="/dashboard">Dashboard (feature flag)</a> &middot;
   <a href="/profile">Profile (error tracking)</a></p>"#
    ));
    (jar, page)
}

#[derive(Deserialize)]
struct LoginForm {
    user_id: String,
    email: Option<String>,
}

// ---------------------------------------------------------------------------
// User identification
// ---------------------------------------------------------------------------
// The server SDK "identifies" a user by attaching person properties to a
// capture. `$set` writes person properties; the distinct id (2nd arg to
// `Event::new`) is the stable user id shared with the frontend.
async fn login(
    State(client): State<AppState>,
    jar: CookieJar,
    Form(form): Form<LoginForm>,
) -> impl IntoResponse {
    let email = form.email.unwrap_or_default();

    let mut event = Event::new("user_logged_in", &form.user_id);
    let _ = event.insert_prop("$set", serde_json::json!({ "email": email }));
    let _ = event.insert_prop("login_method", "email");
    client.capture(event); // fire-and-forget

    // Persist the distinct id for later requests.
    let jar = jar.add(Cookie::new("user_id", form.user_id));
    (jar, Redirect::to("/"))
}

// ---------------------------------------------------------------------------
// Event tracking
// ---------------------------------------------------------------------------
async fn consider_burrito(
    State(client): State<AppState>,
    jar: CookieJar,
) -> impl IntoResponse {
    let (jar, user, anonymous) = visitor(jar);

    let count: u32 = jar
        .get("burrito_count")
        .and_then(|c| c.value().parse().ok())
        .unwrap_or(0)
        + 1;

    let mut event = Event::new("burrito_considered", &user);
    let _ = event.insert_prop("total_considerations", count);
    mark_anonymous(&mut event, anonymous);
    client.capture(event);

    let jar = jar.add(Cookie::new("burrito_count", count.to_string()));
    (
        jar,
        Html(format!(
            "<h1>Burrito considered</h1><p>You have considered {count} burrito(s).</p>\
             <p><a href=\"/\">Back</a></p>"
        )),
    )
}

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------
// Evaluate flags once with `evaluate_flags(...)`, then read individual flags
// off the returned snapshot. Avoid deprecated per-flag helpers.
async fn dashboard(State(client): State<AppState>, jar: CookieJar) -> impl IntoResponse {
    let (jar, user, _) = visitor(jar);

    let show_new_feature = match client
        .evaluate_flags(user.clone(), EvaluateFlagsOptions::default())
        .await
    {
        Ok(flags) => flags.is_enabled("new-dashboard-feature"),
        Err(e) => {
            // Never break the page if flag evaluation fails — fall back to off.
            tracing::warn!("evaluate_flags failed: {e}");
            false
        }
    };

    let body = if show_new_feature {
        "<p>✨ The new dashboard feature is <strong>enabled</strong>.</p>"
    } else {
        "<p>The new dashboard feature is disabled.</p>"
    };
    // Escape the distinct id before rendering it (the raw value went to the SDK above).
    let user = html_escape::encode_text(&user);
    let page = Html(format!(
        "<h1>Dashboard</h1><p>User: {user}</p>{body}<p><a href=\"/\">Back</a></p>"
    ));
    (jar, page)
}

// ---------------------------------------------------------------------------
// Error tracking
// ---------------------------------------------------------------------------
// The Rust SDK CAN capture exceptions. Trigger a failure, then report it with
// `capture_exception_with`, attaching the distinct id and a bit of context.
async fn profile(State(client): State<AppState>, jar: CookieJar) -> impl IntoResponse {
    let (jar, user, anonymous) = visitor(jar);

    let message = match risky_operation() {
        Ok(()) => "no error".to_string(),
        Err(err) => {
            tracing::warn!("profile risky_operation failed: {err}");

            // `property` returns a Result (serialization can fail); keep the
            // context if it serializes, otherwise send the exception without it.
            let mut options = match CaptureExceptionOptions::new()
                .distinct_id(user.clone())
                .property("source", "profile_view")
            {
                Ok(o) => o,
                Err(_) => CaptureExceptionOptions::new().distinct_id(user.clone()),
            };
            if anonymous {
                if let Ok(o) = options.clone().property("$process_person_profile", false) {
                    options = o;
                }
            }
            if let Err(e) = client.capture_exception_with(&err, options).await {
                tracing::warn!("capture_exception failed: {e}");
            }
            err.to_string()
        }
    };

    // Escape user-controlled values before rendering (the raw id went to the SDK above).
    let user = html_escape::encode_text(&user);
    let message = html_escape::encode_text(&message);
    let page = Html(format!(
        "<h1>Profile</h1><p>User: {user}</p>\
         <p>Triggered error (captured by PostHog): <code>{message}</code></p>\
         <p><a href=\"/\">Back</a></p>"
    ));
    (jar, page)
}

/// Stand-in for real work that can fail. Returns a `std::error::Error`, which
/// is exactly what `capture_exception_with` accepts.
fn risky_operation() -> Result<(), IoError> {
    Err(IoError::new(
        ErrorKind::Other,
        "profile data source is temporarily unavailable",
    ))
}

/// Resolves when the process receives Ctrl+C, triggering graceful shutdown.
async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
    tracing::info!("shutdown signal received");
}
