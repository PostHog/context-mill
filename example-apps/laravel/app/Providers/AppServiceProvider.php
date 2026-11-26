<?php

namespace App\Providers;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    private static bool $warnedMissingPostHogKey = false;

    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Leave POSTHOG_API_KEY unset rather than falling back to a default key so posthog-laravel
        // stays cleanly disabled without calling PostHog::init manually.
        $apiKey = trim((string) config('posthog.api_key', ''));
        if ($apiKey === '' && ! $this->app->isProduction() && ! self::$warnedMissingPostHogKey) {
            self::$warnedMissingPostHogKey = true;
            Log::warning(
                'POSTHOG_API_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_API_KEY is configured'
            );
        }
    }
}
