<div>
    <div class="card">
        <h1>Burrito Consideration Tracker</h1>
        <p class="text-gray mb-4">This page demonstrates custom event tracking with PostHog.</p>

        <div class="count">{{ $burritoCount }}</div>
        <p style="text-align: center; color: #666; margin-bottom: 20px;">Times you've considered a burrito</p>

        <div style="text-align: center;">
            <button
                wire:click="considerBurrito"
                wire:loading.attr="disabled"
            >
                <span wire:loading.remove>Consider a Burrito</span>
                <span wire:loading>Considering...</span>
            </button>
        </div>
    </div>

    <div class="card">
        <h3>Code Example</h3>
        <pre>// Livewire component method
public function considerBurrito(PostHogService $posthog)
{
    $this->burritoCount++;
    session(['burrito_count' => $this->burritoCount]);

    $user = Auth::user();
    $posthog->identify($user->email, $user->getPostHogProperties());
    $posthog->capture($user->email, 'burrito_considered', [
        'total_considerations' => $this->burritoCount,
    ]);
}</pre>
    </div>
</div>
