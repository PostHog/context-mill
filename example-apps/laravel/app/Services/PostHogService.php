<?php

namespace App\Services;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use PostHog\FeatureFlagEvaluations;
use PostHog\PostHog;

/**
 * Thin wrapper over the PostHog PHP SDK. The SDK itself is initialized once in
 * AppServiceProvider; this class only skips calls while PostHog is disabled
 * (no project token, or POSTHOG_DISABLED=true) so callers need no checks.
 */
class PostHogService
{
    public function identify(string $distinctId, array $properties = []): void
    {
        if (! config('posthog.enabled')) {
            return;
        }

        PostHog::identify([
            'distinctId' => $distinctId,
            'properties' => $properties,
        ]);
    }

    public function capture(string $distinctId, string $event, array $properties = []): void
    {
        if (! config('posthog.enabled')) {
            return;
        }

        PostHog::capture([
            'distinctId' => $distinctId,
            'event' => $event,
            'properties' => $properties,
        ]);
    }

    /**
     * Capture an exception. Without an explicit distinct ID the event is
     * attributed to the signed-in user, or to the signed-out visitor's ID
     * with person processing turned off.
     */
    public function captureException(\Throwable $exception, ?string $distinctId = null, array $properties = []): ?string
    {
        if (! config('posthog.enabled')) {
            return null;
        }

        if ($distinctId === null) {
            $distinctId = $this->currentDistinctId();

            if (Auth::id() === null) {
                $properties['$process_person_profile'] = false;
            }
        }

        $eventId = uniqid('error_', true);

        PostHog::captureException($exception, $distinctId, array_merge($properties, [
            'error_id' => $eventId,
        ]));

        return $eventId;
    }

    /**
     * The signed-in user's stable ID, or for a signed-out visitor a random UUID
     * kept in the session so it is reused for the whole visit. Never share one
     * literal ID such as "anonymous" across visitors: PostHog would merge them
     * into a single person. Capture signed-out events with
     * `$process_person_profile` set to false.
     */
    public function currentDistinctId(): string
    {
        if (Auth::id() !== null) {
            return (string) Auth::id();
        }

        if (! request()->hasSession()) {
            return (string) Str::uuid();
        }

        $session = request()->session();

        if (! $session->has('posthog_visitor_id')) {
            $session->put('posthog_visitor_id', (string) Str::uuid());
        }

        return $session->get('posthog_visitor_id');
    }

    /**
     * Evaluate every flag once for the user. Read values from the returned
     * snapshot with isEnabled(), getFlag() and getFlagPayload(). Returns null
     * while PostHog is disabled.
     */
    public function evaluateFlags(string $distinctId, array $personProperties = []): ?FeatureFlagEvaluations
    {
        if (! config('posthog.enabled')) {
            return null;
        }

        return PostHog::evaluateFlags(
            distinctId: $distinctId,
            personProperties: $personProperties,
        );
    }
}
