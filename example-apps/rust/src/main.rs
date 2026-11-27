//! A tiny "burrito" web service that mirrors the other PostHog example apps.
//!
//! Each route shows one integration point of the `posthog` server SDK:
//!   * `/`          home and login page
//!   * `/login`     user identification (attach person properties)
//!   * `/logout`    clear the signed-in session cookie
//!   * `/burrito`   event tracking (`burrito_considered`)
//!   * `/dashboard` feature flags (`new-dashboard-feature`, snapshot API)
//!   * `/profile`   error tracking (`capture_exception_with`)
//!
//! The PostHog client is built **once per process** when configured and shared
//! through Axum state (`Option<Arc<Client>>`). It is never constructed per request.

use std::collections::HashMap;
use std::io::{Error as IoError, ErrorKind};
use std::sync::{Arc, Mutex};

use axum::{
    extract::State,
    http::StatusCode,
    response::{Html, IntoResponse, Redirect, Response},
    routing::{get, post},
    Form, Router,
};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use posthog::{
    CaptureExceptionOptions, Client, ClientOptions, EvaluateFlagsOptions, Event,
};
use serde::Deserialize;
use uuid::Uuid;

/// Shared application state. `Option<Arc<Client>>` is cheap to clone and lets
/// every request handler reuse the single process-wide PostHog client when configured.
#[derive(Clone)]
struct AppState {
    posthog: Option<Arc<Client>>,
    users: Arc<Mutex<HashMap<String, String>>>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    // Read the project token optionally and never call posthog::client with a blank or default key,
    // so unconfigured environments skip SDK initialization cleanly.
    let token = std::env::var("POSTHOG_PROJECT_TOKEN")
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());

    let host = std::env::var("POSTHOG_HOST")
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| "https://us.i.posthog.com".to_string());

    let posthog_client = match token {
        Some(token) => {
            // One client per process. ClientOptions::from((api_key, host)) configures
            // both the project token and POSTHOG_HOST.
            let options = ClientOptions::from((token.as_str(), host.as_str()));
            Some(Arc::new(posthog::client(options).await))
        }
        None => {
            if cfg!(debug_assertions)
                || std::env::var("APP_ENV").as_deref() != Ok("production")
            {
                tracing::warn!(
                    "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured"
                );
            }
            None
        }
    };

    let state = AppState {
        posthog: posthog_client,
        users: Arc::new(Mutex::new(HashMap::new())),
    };

    let app = Router::new()
        .route("/", get(home))
        .route("/login", post(login))
        .route("/logout", post(logout))
        .route("/burrito", post(consider_burrito))
        .route("/dashboard", get(dashboard))
        .route("/profile", get(profile))
        .with_state(state.clone());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8000")
        .await
        .expect("failed to bind 0.0.0.0:8000");
    tracing::info!("listening on http://localhost:8000");

    // Serve until Ctrl+C, then flush and shut the client down cleanly.
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("server error");

    // `capture` is fire-and-forget, so queued events must be flushed before the
    // process exits or they are lost. `shutdown` stops the background worker.
    if let Some(client) = &state.posthog {
        tracing::info!("flushing PostHog events before exit...");
        client.flush().await;
        client.shutdown().await;
    }
}

/// Resolve the distinct id for this request and whether the visitor is anonymous.
///
/// Signed-in users have a `user_id` cookie, and that stable UUID must match the id
/// your frontend `posthog.identify(...)` uses so server-side and client-side events
/// attribute to the same person.
///
/// Signed-out visitors get a random UUID stored in an `anon_id` cookie, so it is
/// reused for the rest of the visit instead of sharing one fixed id across visitors.
fn visitor(jar: CookieJar) -> (CookieJar, String, bool) {
    if let Some(id) = jar
        .get("user_id")
        .map(|c| c.value().trim().to_string())
        .filter(|v| !v.is_empty())
    {
        return (jar, id, false);
    }
    if let Some(id) = jar
        .get("anon_id")
        .map(|c| c.value().trim().to_string())
        .filter(|v| !v.is_empty())
    {
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

async fn home(jar: CookieJar) -> impl IntoResponse {
    let (jar, user, anonymous) = visitor(jar);
    let status = if anonymous {
        "Not signed in, anonymous visitor"
    } else {
        "Signed in as"
    };
    let auth_controls = if anonymous {
        r#"<form method="post" action="/login">
  <input name="username" placeholder="username" required>
  <input name="email" type="email" placeholder="email (optional)">
  <button type="submit">Log in</button>
</form>"#
    } else {
        r#"<form method="post" action="/logout">
  <button type="submit">Log out</button>
</form>"#
    };
    // Escape user-controlled values before putting them in HTML to prevent XSS.
    let user = html_escape::encode_text(&user);
    let page = Html(format!(
        r#"<h1>Burrito app</h1>
<p>{status}: <strong>{user}</strong></p>
{auth_controls}
<hr>
<form method="post" action="/burrito"><button>Consider a burrito</button></form>
<p><a href="/dashboard">Dashboard (feature flag)</a> &middot;
   <a href="/profile">Profile (error tracking)</a></p>"#
    ));
    (jar, page)
}

#[derive(Deserialize)]
struct LoginForm {
    username: Option<String>,
    email: Option<String>,
    user_id: Option<String>,
}

// The server SDK identifies a user by attaching person properties via `$set`
// on a capture. The distinct id is a stable UUID and never raw PII.
async fn login(
    State(state): State<AppState>,
    jar: CookieJar,
    Form(form): Form<LoginForm>,
) -> Response {
    let email = form
        .email
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string);
    let username = form
        .username
        .as_deref()
        .or(form.user_id.as_deref())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string);

    let account_key = email.as_deref().or(username.as_deref());

    // Require a non-empty login identifier and never fall back to a shared placeholder id,
    // otherwise blank submissions merge unrelated visitors into one PostHog person profile.
    let Some(account_key) = account_key else {
        return (
            StatusCode::BAD_REQUEST,
            "A username or email is required to log in.",
        )
            .into_response();
    };

    let normalized = account_key.to_lowercase();
    let distinct_id = {
        let mut users = state.users.lock().unwrap_or_else(|e| e.into_inner());
        users
            .entry(normalized)
            .or_insert_with(|| Uuid::new_v4().to_string())
            .clone()
    };

    if let Some(client) = &state.posthog {
        let login_method = if email.is_some() { "email" } else { "username" };
        let mut person_props = serde_json::Map::new();
        if let Some(email_val) = &email {
            person_props.insert(
                "email".to_string(),
                serde_json::Value::String(email_val.clone()),
            );
        }
        if let Some(username_val) = &username {
            person_props.insert(
                "username".to_string(),
                serde_json::Value::String(username_val.clone()),
            );
        }

        let mut event = Event::new("user_logged_in", &distinct_id);
        let _ = event.insert_prop("$set", serde_json::Value::Object(person_props));
        let _ = event.insert_prop("login_method", login_method);
        client.capture(event);
    }

    // Persist the stable UUID for later requests.
    let jar = jar.add(Cookie::new("user_id", distinct_id));
    (jar, Redirect::to("/")).into_response()
}

async fn logout(State(state): State<AppState>, jar: CookieJar) -> impl IntoResponse {
    // Only capture user_logged_out when a signed-in user session cookie is present.
    if let Some(user_id) = jar
        .get("user_id")
        .map(|c| c.value().trim().to_string())
        .filter(|v| !v.is_empty())
    {
        if let Some(client) = &state.posthog {
            let event = Event::new("user_logged_out", &user_id);
            client.capture(event);
        }
    }

    let jar = jar.remove(Cookie::from("user_id"));
    (jar, Redirect::to("/"))
}

async fn consider_burrito(
    State(state): State<AppState>,
    jar: CookieJar,
) -> impl IntoResponse {
    let (jar, user, anonymous) = visitor(jar);

    let count: u32 = jar
        .get("burrito_count")
        .and_then(|c| c.value().parse().ok())
        .unwrap_or(0)
        + 1;

    if let Some(client) = &state.posthog {
        let mut event = Event::new("burrito_considered", &user);
        let _ = event.insert_prop("total_considerations", count);
        mark_anonymous(&mut event, anonymous);
        client.capture(event);
    }

    let jar = jar.add(Cookie::new("burrito_count", count.to_string()));
    (
        jar,
        Html(format!(
            "<h1>Burrito considered</h1><p>You have considered {count} burrito(s).</p>\
             <p><a href=\"/\">Back</a></p>"
        )),
    )
}

// Evaluate flags once with `evaluate_flags(...)`, then read individual flags
// off the returned snapshot. Avoid deprecated per-flag helpers.
async fn dashboard(State(state): State<AppState>, jar: CookieJar) -> impl IntoResponse {
    let (jar, user, _) = visitor(jar);

    let show_new_feature = if let Some(client) = &state.posthog {
        match client
            .evaluate_flags(user.clone(), EvaluateFlagsOptions::default())
            .await
        {
            Ok(flags) => flags.is_enabled("new-dashboard-feature"),
            Err(e) => {
                // Never break the page if flag evaluation fails, so fall back to false.
                tracing::warn!("evaluate_flags failed: {e}");
                false
            }
        }
    } else {
        false
    };

    let body = if show_new_feature {
        "<p>✨ The new dashboard feature is <strong>enabled</strong>.</p>"
    } else {
        "<p>The new dashboard feature is disabled.</p>"
    };
    let user = html_escape::encode_text(&user);
    let page = Html(format!(
        "<h1>Dashboard</h1><p>User: {user}</p>{body}<p><a href=\"/\">Back</a></p>"
    ));
    (jar, page)
}

// Report failures with `capture_exception_with`, attaching the distinct id and non-PII context.
async fn profile(State(state): State<AppState>, jar: CookieJar) -> impl IntoResponse {
    let (jar, user, anonymous) = visitor(jar);

    let message = match risky_operation() {
        Ok(()) => "no error".to_string(),
        Err(err) => {
            tracing::warn!("profile risky_operation failed: {err}");

            if let Some(client) = &state.posthog {
                // `property` returns a Result, so keep the context if it serializes
                // and otherwise send the exception with the distinct id alone.
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
            }
            err.to_string()
        }
    };

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
/// is what `capture_exception_with` accepts.
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
