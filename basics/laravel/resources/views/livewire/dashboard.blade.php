<div>
    <div class="card">
        <h1>Dashboard</h1>
        <p class="text-gray">Welcome back, {{ auth()->user()->email }}!</p>
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

        <h3 style="margin-top: 20px;">Code Example</h3>
        <pre>try {
    // Critical operation that might fail
    processPayment();
} catch (\Throwable $e) {
    // Manually capture this specific exception
    $errorId = $posthog->captureException($e, $user->email);

    return response()->json([
        'error' => 'Operation failed',
        'error_id' => $errorId
    ], 500);
}</pre>
        <p class="text-gray" style="margin-top: 10px;">This demonstrates manual exception capture where you have control over whether errors are sent to PostHog.</p>
    </div>

    <div class="card">
        <h2>Feature Flags</h2>

        @if($showNewFeature)
            <div class="feature-flag">
                <strong>New Feature Enabled!</strong>
                <p style="margin-top: 10px;">You're seeing this because the <code>new-dashboard-feature</code> flag is enabled for you.</p>

                @if($featureConfig)
                    <p style="margin-top: 15px;"><strong>Feature Configuration:</strong></p>
                    <pre>{{ json_encode($featureConfig, JSON_PRETTY_PRINT) }}</pre>
                @endif
            </div>
        @else
            <p class="text-gray">The <code>new-dashboard-feature</code> flag is not enabled for your account.</p>
        @endif

        <h3 style="margin-top: 20px;">Code Example</h3>
        <pre>// Check if feature flag is enabled
$showNewFeature = $posthog->isFeatureEnabled(
    'new-dashboard-feature',
    $user->email,
    $user->getPostHogProperties()
);

// Get feature flag payload
$featureConfig = $posthog->getFeatureFlagPayload(
    'new-dashboard-feature',
    $user->email
);</pre>
    </div>

</div>
