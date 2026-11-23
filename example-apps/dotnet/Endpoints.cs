using System.Net;
using PostHog;

public static class Endpoints
{
    // Returns the distinct id for the request and whether the visitor is anonymous.
    //
    // Signed-in users have a "user_id" cookie; that stable id is the join key for all
    // analytics and must match the id your frontend posthog.identify(...) call uses
    // so server- and client-side events land on the same person.
    //
    // Signed-out visitors get a random GUID stored in a cookie so it is reused for
    // the rest of the visit. Never share one fixed id across visitors: they would
    // all collapse into a single person.
    private static (string Id, bool Anonymous) Visitor(HttpContext context)
    {
        if (context.Request.Cookies.TryGetValue("user_id", out var userId) && !string.IsNullOrEmpty(userId))
        {
            return (userId, false);
        }

        if (context.Request.Cookies.TryGetValue("anon_id", out var anonId) && !string.IsNullOrEmpty(anonId))
        {
            return (anonId, true);
        }

        anonId = Guid.NewGuid().ToString();
        context.Response.Cookies.Append("anon_id", anonId, CookieOptions);
        return (anonId, true);
    }

    // Anonymous events set $process_person_profile to false so PostHog does not
    // create a person profile for the visitor.
    private static Dictionary<string, object> EventProperties(bool anonymous, Dictionary<string, object>? properties = null)
    {
        properties ??= new Dictionary<string, object>();
        if (anonymous)
        {
            properties["$process_person_profile"] = false;
        }
        return properties;
    }

    private static CookieOptions CookieOptions => new()
    {
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.Lax,
    };

    public static void MapBurritoEndpoints(this WebApplication app)
    {
        app.MapGet("/", (HttpContext context) =>
        {
            var (userId, anonymous) = Visitor(context);
            return Page("Burrito app", $"""
            <p>{(anonymous ? "Not signed in, anonymous visitor" : "Signed in as")}: <strong>{Html(userId)}</strong></p>
            <form method="POST" action="/login">
                <label>User id <input name="user_id" value="burrito-fan-42"></label>
                <label>Email <input name="email" value="fan@example.com"></label>
                <button type="submit">Log in</button>
            </form>
            <ul>
                <li><a href="/burrito">Consider a burrito</a> (event tracking)</li>
                <li><a href="/dashboard">Dashboard</a> (feature flag)</li>
                <li><a href="/profile">Profile</a> (error tracking)</li>
            </ul>
            """);
        });

        // User identification: capture an event with person properties. The
        // distinct id is the stable user id.
        app.MapPost("/login", (HttpContext context, IPostHogClient posthog) =>
        {
            var form = context.Request.Form;
            var userId = form["user_id"].ToString();
            if (string.IsNullOrEmpty(userId))
            {
                userId = "burrito-fan-42";
            }

            context.Response.Cookies.Append("user_id", userId, CookieOptions);

            posthog.Capture(
                userId,
                "user_logged_in",
                properties: new() { ["login_method"] = "email" },
                personPropertiesToSet: new() { ["email"] = form["email"].ToString() },
                personPropertiesToSetOnce: new() { ["first_login_method"] = "email" });

            return Results.Redirect("/");
        }).DisableAntiforgery();

        // Event tracking: capture a business event with the visitor's distinct id
        // and an event property.
        app.MapGet("/burrito", (HttpContext context, IPostHogClient posthog) =>
        {
            var (userId, anonymous) = Visitor(context);

            var count = int.TryParse(context.Request.Cookies["burrito_count"], out var previous)
                ? previous + 1
                : 1;
            context.Response.Cookies.Append("burrito_count", count.ToString(), CookieOptions);

            posthog.Capture(
                userId,
                "burrito_considered",
                properties: EventProperties(anonymous, new() { ["total_considerations"] = count }));

            return Page("Burrito considered", $"""
                <p>You have considered a burrito <strong>{count}</strong> time(s).</p>
                <p>A <code>burrito_considered</code> event was captured for <code>{Html(userId)}</code>.</p>
                <p><a href="/">Back home</a></p>
                """);
        });

        // Feature flags: evaluate once per request, then read flags off the
        // returned snapshot.
        app.MapGet("/dashboard", async (HttpContext context, IPostHogClient posthog, ILogger<Program> logger) =>
        {
            var (userId, _) = Visitor(context);

            var showNewFeature = false;
            try
            {
                var flags = await posthog.EvaluateFlagsAsync(
                    userId,
                    options: new AllFeatureFlagsOptions
                    {
                        FlagKeysToEvaluate = ["new-dashboard-feature"],
                    });
                showNewFeature = flags.IsEnabled("new-dashboard-feature");
            }
            catch (Exception exception)
            {
                // A failed flag evaluation should never take the page down.
                logger.LogError(exception, "Feature flag evaluation failed");
            }

            var body = showNewFeature
                ? "<p>You are seeing the <strong>new</strong> dashboard feature!</p>"
                : "<p>You are seeing the <strong>standard</strong> dashboard.</p>";

            return Page("Dashboard", $"""
                {body}
                <p>Flag <code>new-dashboard-feature</code> for <code>{Html(userId)}</code>: <strong>{showNewFeature}</strong></p>
                <p><a href="/">Back home</a></p>
                """);
        });

        // Error tracking: catch an exception and report it with CaptureException.
        // The app keeps serving.
        app.MapGet("/profile", (HttpContext context, IPostHogClient posthog, ILogger<Program> logger) =>
        {
            var (userId, anonymous) = Visitor(context);

            var caught = "";
            try
            {
                RiskyOperation();
            }
            catch (Exception exception)
            {
                caught = exception.Message;
                logger.LogError(exception, "Profile risky operation failed");

                posthog.CaptureException(
                    exception,
                    userId,
                    EventProperties(anonymous, new() { ["route"] = "/profile" }));
            }

            return Page("Profile", $"""
                <p>User: <strong>{Html(userId)}</strong></p>
                <p>Triggered and captured an exception: <code>{Html(caught)}</code></p>
                <p><a href="/">Back home</a></p>
                """);
        });
    }

    private static void RiskyOperation() =>
        throw new InvalidOperationException("profile data source is temporarily unavailable");

    private static string Html(string value) => WebUtility.HtmlEncode(value);

    // A minimal HTML document so the example needs no template files.
    private static IResult Page(string title, string body) => Results.Content(
        $"<!doctype html><html><head><meta charset=\"utf-8\"><title>{title}</title></head>" +
        $"<body><h1>{title}</h1>{body}</body></html>",
        "text/html; charset=utf-8");
}
