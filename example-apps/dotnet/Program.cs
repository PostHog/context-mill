// A tiny "burrito app" that mirrors the other PostHog example apps. Each route
// shows one server-side integration point:
//
//   /           home / login form
//   /login      user identification (capture with person properties)
//   /burrito    event tracking (burrito_considered)
//   /dashboard  feature flags (new-dashboard-feature via EvaluateFlagsAsync)
//   /profile    error tracking (CaptureException)

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://localhost:8000");

builder.AddPostHogFromEnvironment();

var app = builder.Build();

app.MapBurritoEndpoints();

// The PostHog client is a DI singleton. When the host shuts down (Ctrl+C or
// SIGTERM) it disposes the client, which flushes any queued events first.
app.Run();
