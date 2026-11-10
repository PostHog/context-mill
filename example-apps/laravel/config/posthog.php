<?php

$apiKey = trim((string) env('POSTHOG_PROJECT_TOKEN', ''));
$disabled = filter_var(env('POSTHOG_DISABLED', false), FILTER_VALIDATE_BOOLEAN);

return [
    'api_key' => $apiKey,
    'host' => env('POSTHOG_HOST', 'https://us.i.posthog.com'),
    'disabled' => $disabled,
    // PostHog only runs with a token and without POSTHOG_DISABLED=true.
    'enabled' => $apiKey !== '' && ! $disabled,
    'debug' => env('APP_DEBUG', false),
];
