<?php

namespace App\Http\Livewire;

use App\Services\PostHogService;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;

class Profile extends Component
{
    public function mount(PostHogService $posthog)
    {
        $user = Auth::user();

        // PostHog: Track profile view
        $posthog->capture($user->email, 'profile_viewed');
    }

    public function render()
    {
        return view('livewire.profile')
            ->layout('components.layouts.app');
    }
}
