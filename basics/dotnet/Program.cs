using Microsoft.Extensions.Options;
using PostHog;

var projectToken = Environment.GetEnvironmentVariable("POSTHOG_PROJECT_TOKEN");
if (string.IsNullOrWhiteSpace(projectToken))
{
    Console.Error.WriteLine("Set POSTHOG_PROJECT_TOKEN before running this example.");
    return 1;
}

var host = Environment.GetEnvironmentVariable("POSTHOG_HOST") ?? "https://us.i.posthog.com";
var distinctId = Environment.GetEnvironmentVariable("DEMO_DISTINCT_ID") ?? $"dotnet-demo-{Environment.UserName}";

await using var posthog = new PostHogClient(Options.Create(new PostHogOptions
{
    ProjectToken = projectToken,
    HostUrl = new Uri(host),
    PersonalApiKey = Environment.GetEnvironmentVariable("POSTHOG_PERSONAL_API_KEY"),
}));

try
{
    await posthog.IdentifyAsync(
        distinctId,
        personPropertiesToSet: new Dictionary<string, object>
        {
            ["email"] = "dotnet-demo@example.com",
            ["runtime"] = ".NET",
        },
        personPropertiesToSetOnce: new Dictionary<string, object>
        {
            ["first_seen_in"] = "dotnet-console-example",
        },
        CancellationToken.None);

    var action = args.FirstOrDefault() ?? "run demo";
    posthog.Capture(
        distinctId,
        "dotnet demo action performed",
        new Dictionary<string, object>
        {
            ["action"] = action,
            ["argument_count"] = args.Length,
            ["environment"] = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT") ?? "Development",
        },
        groups: null,
        flags: null);

    Console.WriteLine($"Captured demo action for {distinctId}.");
    return 0;
}
catch (Exception exception)
{
    posthog.CaptureException(
        exception,
        distinctId,
        new Dictionary<string, object>
        {
            ["component"] = "dotnet-console-example",
        },
        groups: null,
        flags: null);
    throw;
}
finally
{
    // Console apps, scripts, and workers should flush before process exit.
    await posthog.FlushAsync();
}
