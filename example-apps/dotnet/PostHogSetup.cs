using PostHog;

public static class PostHogSetup
{
    // Registers the single PostHog client for the app when POSTHOG_PROJECT_TOKEN is set.
    public static bool AddPostHogFromEnvironment(this WebApplicationBuilder builder)
    {
        // Read the project token optionally and never register PostHog with a blank or fallback token,
        // so unconfigured environments skip SDK initialization cleanly.
        var projectToken = Environment.GetEnvironmentVariable("POSTHOG_PROJECT_TOKEN")?.Trim();
        if (string.IsNullOrWhiteSpace(projectToken))
        {
            return false;
        }

        var host = Environment.GetEnvironmentVariable("POSTHOG_HOST")?.Trim();

        builder.Configuration["PostHog:ProjectToken"] = projectToken;
        builder.Configuration["PostHog:HostUrl"] = string.IsNullOrWhiteSpace(host)
            ? "https://us.i.posthog.com"
            : host;

        // Registers IPostHogClient as a singleton, one client for the whole app.
        builder.AddPostHog();
        return true;
    }

    public static void WarnIfPostHogUnconfigured(this WebApplication app)
    {
        if (app.Services.GetService<IPostHogClient>() is null && !app.Environment.IsProduction())
        {
            app.Logger.LogWarning(
                "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured");
        }
    }
}
