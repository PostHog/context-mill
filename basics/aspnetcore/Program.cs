using System.Security.Claims;
using Microsoft.FeatureManagement;
using PostHog;
using PostHog.Config;
using PostHog.FeatureManagement;

var builder = WebApplication.CreateBuilder(args);

builder.AddPostHog(posthog =>
{
    // `builder.AddPostHog()` already binds the `PostHog` configuration section.
    // These environment-variable fallbacks make the example easy to run locally.
    posthog.PostConfigure(options =>
    {
        options.ProjectToken ??= builder.Configuration["POSTHOG_PROJECT_TOKEN"];
        options.PersonalApiKey ??= builder.Configuration["POSTHOG_PERSONAL_API_KEY"];

        if (Uri.TryCreate(builder.Configuration["POSTHOG_HOST"], UriKind.Absolute, out var hostUrl))
        {
            options.HostUrl = hostUrl;
        }
    });

    // Enables Microsoft.FeatureManagement (`IFeatureManager`) backed by PostHog feature flags.
    posthog.UseFeatureManagement<RequestFeatureFlagContextProvider>();
});

var app = builder.Build();

app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (Exception exception)
    {
        var posthog = context.RequestServices.GetRequiredService<IPostHogClient>();
        posthog.CaptureException(
            exception,
            GetDistinctId(context),
            new Dictionary<string, object>
            {
                ["$current_url"] = $"{context.Request.Scheme}://{context.Request.Host}{context.Request.Path}",
                ["http_method"] = context.Request.Method,
                ["trace_id"] = context.TraceIdentifier,
            },
            groups: null,
            flags: null);
        throw;
    }
});

app.MapGet("/", () => "PostHog ASP.NET Core example");

app.MapPost("/api/todos", async (TodoRequest request, HttpContext context, IPostHogClient posthog) =>
{
    var distinctId = GetDistinctId(context);

    await posthog.IdentifyAsync(
        distinctId,
        personPropertiesToSet: new Dictionary<string, object>
        {
            ["email"] = context.User.FindFirstValue(ClaimTypes.Email) ?? "aspnet-demo@example.com",
        },
        personPropertiesToSetOnce: null,
        context.RequestAborted);

    posthog.Capture(
        distinctId,
        "todo created",
        new Dictionary<string, object>
        {
            ["title_length"] = request.Title.Length,
            ["source"] = "aspnetcore-example",
        },
        groups: null,
        flags: null);

    return Results.Created($"/api/todos/{Guid.NewGuid():N}", request);
});

app.MapGet("/api/features/new-dashboard", async (IFeatureManager featureManager) =>
{
    var enabled = await featureManager.IsEnabledAsync("new-dashboard");
    return Results.Ok(new { enabled });
});

app.Run();

static string GetDistinctId(HttpContext context) => DistinctIds.From(context);

record TodoRequest(string Title);

static class DistinctIds
{
    public static string From(HttpContext context) =>
        context.User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? context.Request.Headers["X-POSTHOG-DISTINCT-ID"].FirstOrDefault()
        ?? context.TraceIdentifier;
}

sealed class RequestFeatureFlagContextProvider(IHttpContextAccessor httpContextAccessor)
    : PostHogFeatureFlagContextProvider
{
    protected override string? GetDistinctId() =>
        httpContextAccessor.HttpContext is { } context ? DistinctIds.From(context) : null;

    protected override ValueTask<FeatureFlagOptions> GetFeatureFlagOptionsAsync()
    {
        var context = httpContextAccessor.HttpContext;
        return ValueTask.FromResult(new FeatureFlagOptions
        {
            PersonProperties = new Dictionary<string, object?>
            {
                ["email"] = context?.User.FindFirstValue(ClaimTypes.Email),
                ["path"] = context?.Request.Path.Value,
            },
            OnlyEvaluateLocally = false,
        });
    }
}
