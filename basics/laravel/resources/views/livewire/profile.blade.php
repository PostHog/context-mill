<div>
    <div class="card">
        <h1>Your Profile</h1>
        <p class="text-gray mb-4">This page demonstrates error tracking with PostHog.</p>

        <table>
            <tr>
                <th>Email</th>
                <td>{{ auth()->user()->email }}</td>
            </tr>
            <tr>
                <th>Date Joined</th>
                <td>{{ auth()->user()->created_at->format('Y-m-d H:i') }}</td>
            </tr>
            <tr>
                <th>Staff Status</th>
                <td>{{ auth()->user()->is_staff ? 'Yes' : 'No' }}</td>
            </tr>
        </table>
    </div>

    <div class="card">
        <h2>Error Tracking Demo</h2>
        <p class="text-gray">Test manual exception capture in PostHog. These buttons trigger errors in the context of your logged-in user.</p>

        @if($successMessage)
            <div style="background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 12px; border-radius: 4px; margin: 15px 0;">
                {{ $successMessage }}
            </div>
        @endif

        @if($errorMessage)
            <div style="background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 12px; border-radius: 4px; margin: 15px 0;">
                {{ $errorMessage }}
            </div>
        @endif

        <div style="display: flex; gap: 10px; margin-top: 15px;">
            <button wire:click="testErrorWithCapture" class="btn" style="background: #dc3545; color: white;">
                Capture Error in PostHog
            </button>
            <button wire:click="testErrorWithoutCapture" class="btn" style="background: #c82333; color: white;">
                Skip PostHog Capture
            </button>
        </div>

        <p class="text-gray" style="margin-top: 15px;">
            This demonstrates manual exception capture where you have control over whether errors are sent to PostHog.
        </p>
    </div>

    <div class="card">
        <h3>Code Example</h3>
        <pre>try {
    throw new \Exception('Test exception from critical operation');
} catch (\Throwable $e) {
    // Capture exception with user context
    $posthog->identify($user->email, $user->getPostHogProperties());
    $eventId = $posthog->captureException($e, $user->email);

    return response()->json([
        'error' => 'Operation failed',
        'error_id' => $eventId,
        'message' => "Error captured in PostHog. Reference ID: {$eventId}"
    ], 500);
}</pre>
    </div>
</div>
