<?php

namespace App\Services;

use PostHog\PostHog;
use Illuminate\Support\Facades\Auth;

class PostHogService
{
    protected $client;

    public function __construct()
    {
        if (config('posthog.disabled')) {
            $this->client = null;
            return;
        }

        // Initialize PostHog if not already initialized
        if (!PostHog::isInitialized()) {
            PostHog::init(
                config('posthog.api_key'),
                [
                    'host' => config('posthog.host'),
                    'debug' => config('posthog.debug'),
                ]
            );
        }

        $this->client = PostHog::getInstance();
    }

    public function identify(string $distinctId, array $properties = []): void
    {
        if (!$this->client) {
            return;
        }

        $this->client->identify([
            'distinctId' => $distinctId,
            'properties' => $properties,
        ]);
    }

    public function capture(string $distinctId, string $event, array $properties = []): void
    {
        if (!$this->client) {
            return;
        }

        $this->client->capture([
            'distinctId' => $distinctId,
            'event' => $event,
            'properties' => $properties,
        ]);
    }

    public function captureException(\Throwable $exception, ?string $distinctId = null): ?string
    {
        if (!$this->client) {
            return null;
        }

        $distinctId = $distinctId ?? Auth::user()?->email ?? 'anonymous';

        $eventId = uniqid('error_', true);

        $this->capture($distinctId, '$exception', [
            'error_id' => $eventId,
            'exception_type' => get_class($exception),
            'exception_message' => $exception->getMessage(),
            'exception_file' => $exception->getFile(),
            'exception_line' => $exception->getLine(),
            'stack_trace' => $exception->getTraceAsString(),
        ]);

        return $eventId;
    }

    public function isFeatureEnabled(string $key, string $distinctId, array $properties = []): bool
    {
        if (!$this->client) {
            return false;
        }

        return $this->client->isFeatureEnabled($key, $distinctId, $properties);
    }

    public function getFeatureFlagPayload(string $key, string $distinctId)
    {
        if (!$this->client) {
            return null;
        }

        return $this->client->getFeatureFlagPayload($key, $distinctId);
    }
}
