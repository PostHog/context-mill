<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use PostHog\PostHog;
use Symfony\Component\HttpFoundation\Response;

/**
 * Applies request metadata, plus the PostHog distinct ID and session ID headers
 * sent by posthog-js, to every event captured while the request is handled.
 */
final class PostHogRequestContext
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('posthog.enabled')) {
            return $next($request);
        }

        $context = PostHog::contextFromHeaders($request->headers->all());

        $context['properties'] = array_merge(
            $context['properties'] ?? [],
            array_filter([
                '$current_url' => $request->fullUrl(),
                '$request_method' => $request->method(),
                '$request_path' => $request->getPathInfo(),
                '$user_agent' => $request->userAgent(),
                '$ip' => $request->ip(),
            ], static fn ($value): bool => $value !== null && $value !== '')
        );

        return PostHog::withContext(
            $context,
            static fn (): Response => $next($request),
            ['fresh' => true]
        );
    }
}
