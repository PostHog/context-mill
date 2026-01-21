<div>
    <div class="card">
        <h1>Dashboard</h1>
        <p class="text-gray">Welcome back, {{ auth()->user()->email }}!</p>
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
