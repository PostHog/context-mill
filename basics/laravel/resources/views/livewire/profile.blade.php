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
        <p class="text-gray mb-4">The error tracking demo uses the API endpoint directly. Test it using:</p>

        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <p class="text-sm" style="margin-bottom: 10px;"><strong>Capture error in PostHog:</strong></p>
            <code style="display: block; background: white; padding: 8px; border-radius: 4px; margin-bottom: 15px; font-size: 12px;">
                curl -X POST http://localhost:8000/api/test-error?capture=true
            </code>

            <p class="text-sm" style="margin-bottom: 10px;"><strong>Skip PostHog capture:</strong></p>
            <code style="display: block; background: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                curl -X POST http://localhost:8000/api/test-error?capture=false
            </code>
        </div>

        <p class="text-sm text-gray">
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
