<?php

namespace App\Http\Livewire;

use Livewire\Component;
use PostHog\Laravel\Facades\PostHog;

class BurritoTracker extends Component
{
    public int $burritoCount = 0;

    public function mount()
    {
        $this->burritoCount = session('burrito_count', 0);
    }

    public function considerBurrito()
    {
        $this->burritoCount++;
        session(['burrito_count' => $this->burritoCount]);

        // PostHog: Track burrito consideration
        PostHog::capture('burrito_considered', [
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
