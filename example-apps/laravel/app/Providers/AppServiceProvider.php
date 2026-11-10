<?php

namespace App\Providers;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\ServiceProvider;
use PostHog\PostHog;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        if (! config('posthog.enabled')) {
            // A missing token disables PostHog instead of breaking boot.
            if (app()->environment('local') && ! config('posthog.disabled')) {
                Log::warning('POSTHOG_PROJECT_TOKEN is not set; PostHog is disabled. Copy .env.example to .env and set it.');
            }

            return;
        }

        PostHog::init(
            config('posthog.api_key'),
            [
                'host' => config('posthog.host'),
                'debug' => config('posthog.debug'),
            ]
        );
    }
}
