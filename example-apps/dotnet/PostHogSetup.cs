using PostHog;

public static class PostHogSetup
{
    // Registers the single PostHog client for the app. The SDK reads the "PostHog"
    // configuration section, so we map our environment variables onto it.
    public static void AddPostHogFromEnvironment(this WebApplicationBuilder builder)
    {
        var projectToken = Environment.GetEnvironmentVariable("POSTHOG_PROJECT_TOKEN");
        var host = Environment.GetEnvironmentVariable("POSTHOG_HOST");

        // A blank token never breaks the app: the SDK logs an error and turns every
        // call into a no-op, so we only add a clearer hint in Development.
        if (string.IsNullOrWhiteSpace(projectToken) && builder.Environment.IsDevelopment())
        {
            Console.WriteLine(
                "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, " +
                "this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured");
        }

        builder.Configuration["PostHog:ProjectToken"] = projectToken;
        builder.Configuration["PostHog:HostUrl"] = string.IsNullOrWhiteSpace(host)
            ? "https://us.i.posthog.com"
            : host;

        // Registers IPostHogClient as a singleton: one client for the whole app.
        builder.AddPostHog();
    }
}
