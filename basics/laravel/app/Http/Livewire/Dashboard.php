<?php

namespace App\Http\Livewire;

use App\Services\PostHogService;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;

class Dashboard extends Component
{
    public bool $showNewFeature = false;
    public $featureConfig = null;

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
        );

        // Get feature flag payload
        $this->featureConfig = $posthog->getFeatureFlagPayload(
            'new-dashboard-feature',
            $user->email
        );
    }

    public function render()
    {
        return view('livewire.dashboard')
            ->layout('components.layouts.app');
    }
}
