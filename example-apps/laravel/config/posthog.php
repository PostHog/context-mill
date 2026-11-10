<?php

$integer = static function (string $name): ?int {
    $value = env($name);
    return $value === null || $value === '' ? null : (int) $value;
};
$decimal = static function (string $name): ?float {
    $value = env($name);
    return $value === null || $value === '' ? null : (float) $value;
};
$consumer = env('POSTHOG_CONSUMER');

return [
    'enabled' => env('POSTHOG_ENABLED', true),
    'project_token' => env('POSTHOG_PROJECT_TOKEN'),
    // Deprecated: the older name for the project token, read only when project_token is blank.
    'api_key' => env('POSTHOG_API_KEY'),
    'host' => env('POSTHOG_HOST', 'https://us.i.posthog.com'),
    'secret_key' => env('POSTHOG_SECRET_KEY'),
    'release_id' => env('POSTHOG_RELEASE_ID'),
    'capture_exceptions' => true,
    'capture_ip' => env('POSTHOG_CAPTURE_IP', true),
    'header_context' => true,
    'queue_context' => true,
    'laravel_queue' => [
        'enabled' => env('POSTHOG_LARAVEL_QUEUE_ENABLED', false),
        'connection' => env('POSTHOG_LARAVEL_QUEUE_CONNECTION'),
        'name' => env('POSTHOG_LARAVEL_QUEUE_NAME'),
    ],
    // Invokable container class; receives the application and returns a distinct ID or null.
    'distinct_id' => null,
    // Invokable container class; receives the application and returns group identifiers.
    'groups' => null,
    'sdk' => array_filter([
        'disableGeoip' => true,
        'timeout' => $decimal($consumer === 'socket' ? 'POSTHOG_SOCKET_TIMEOUT_SECONDS' : 'POSTHOG_TIMEOUT_MS'),
        'http_timeout_ms' => $decimal('POSTHOG_TIMEOUT_MS'),
        'batch_size' => $integer('POSTHOG_BATCH_SIZE'),
        'max_queue_size' => $integer('POSTHOG_MAX_QUEUE_SIZE'),
        'flush_interval_seconds' => $decimal('POSTHOG_FLUSH_INTERVAL_SECONDS'),
        'compress_request' => env('POSTHOG_COMPRESS_REQUEST'),
        'consumer' => $consumer,
        'feature_flag_request_timeout_ms' => $integer('POSTHOG_FF_REQUEST_TIMEOUT_MS'),
        'feature_flag_request_max_retries' => $integer('POSTHOG_FF_REQUEST_MAX_RETRIES'),
        // before_send, error_handler and flag_definition_cache_provider accept container class names.
    ], static fn ($value) => $value !== null && $value !== ''),
    'flag_cache' => [
        'enabled' => false,
        'store' => null,
        'ttl' => 300,
        'refresh_interval' => 30,
    ],
];
