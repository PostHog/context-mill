<?php

use App\Http\Middleware\PostHogRequestContext;
use App\Services\PostHogService;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // PostHog: request context for events captured during a request
        $middleware->append(PostHogRequestContext::class);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // PostHog: Laravel handles most request exceptions before PHP sees them as
        // uncaught, so report them explicitly. Reporting honours dontReport.
        $exceptions->report(function (Throwable $e): void {
            if (! config('posthog.enabled')) {
                return;
            }

            app(PostHogService::class)->captureException($e, null, [
                '$current_url' => request()->fullUrl(),
                '$request_method' => request()->method(),
            ]);
        });
    })->create();
