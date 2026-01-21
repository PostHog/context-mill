<?php

namespace App\Http\Livewire;

use App\Services\PostHogService;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;

class Dashboard extends Component
{
    public bool $showNewFeature = false;
    public $featureConfig = null;
    public ?string $errorMessage = null;
    public ?string $successMessage = null;

    public function mount(PostHogService $posthog)
    {
        $user = Auth::user();

        // PostHog: Track dashboard view
        $posthog->capture($user->email, 'dashboard_viewed', [
            'is_staff' => $user->is_staff,
        ]);

        // Check feature flag
        $this->showNewFeature = $posthog->isFeatureEnabled(
            'new-dashboard-feature',
            $user->email,
            $user->getPostHogProperties()
        ) ?? false;

        // Get feature flag payload
        $this->featureConfig = $posthog->getFeatureFlagPayload(
            'new-dashboard-feature',
            $user->email
        );
    }

    public function testErrorWithCapture(PostHogService $posthog)
    {
        $user = Auth::user();

        try {
            // Simulate an error
            throw new \Exception('This is a test error for PostHog tracking');
        } catch (\Exception $e) {
            // Capture the exception in PostHog
            $errorId = $posthog->captureException($e, $user->email);

            $this->successMessage = "Error captured in PostHog! Error ID: {$errorId}";
            $this->errorMessage = null;
        }
    }

    public function testErrorWithoutCapture()
    {
        try {
            // Simulate an error without capturing
            throw new \Exception('This error was NOT sent to PostHog');
        } catch (\Exception $e) {
            $this->errorMessage = "Error occurred but NOT captured in PostHog: " . $e->getMessage();
            $this->successMessage = null;
        }
    }

    public function render()
    {
        return view('livewire.dashboard')
            ->layout('components.layouts.app');
    }
}
