<?php

namespace App\Http\Livewire;

use App\Services\PostHogService;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;

class BurritoTracker extends Component
{
    public int $burritoCount = 0;

    public function mount()
    {
        $this->burritoCount = session('burrito_count', 0);
    }

    public function considerBurrito(PostHogService $posthog)
    {
        $this->burritoCount++;
        session(['burrito_count' => $this->burritoCount]);

        // PostHog: Track burrito consideration
        $user = Auth::user();
        $posthog->identify($user->email, $user->getPostHogProperties());
        $posthog->capture($user->email, 'burrito_considered', [
            'total_considerations' => $this->burritoCount,
        ]);

        $this->dispatch('burrito-considered');
    }

    public function render()
    {
        return view('livewire.burrito-tracker')
            ->layout('components.layouts.app');
    }
}
