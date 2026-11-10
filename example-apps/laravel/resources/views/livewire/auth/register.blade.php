<div>
    <div class="card">
        <h1>Create an Account</h1>
        <p class="text-gray mb-4">Sign up to explore the PostHog Laravel integration example.</p>

        <form wire:submit="register">
            <label for="email">Email *</label>
            <input
                type="email"
                id="email"
                wire:model="email"
                required
            >
            @error('email') <div class="error">{{ $message }}</div> @enderror

            <label for="password">Password *</label>
            <input
                type="password"
                id="password"
                wire:model="password"
                required
            >
            @error('password') <div class="error">{{ $message }}</div> @enderror

            <label for="password_confirmation">Confirm Password *</label>
            <input
                type="password"
                id="password_confirmation"
                wire:model="password_confirmation"
                required
            >

            <button type="submit">Sign Up</button>
        </form>

        <p style="margin-top: 16px;" class="text-sm text-gray">
            Already have an account? <a href="{{ route('login') }}">Login here</a>
        </p>
    </div>

    <div class="card">
        <h2>PostHog Integration</h2>
        <p class="text-gray">When you sign up, the following PostHog calls are made:</p>
        <ul class="text-gray" style="margin-top: 10px;">
            <li><code>identify()</code> - Sets person properties (email, etc.) for your user ID</li>
            <li><code>capture()</code> - Records the <code>user_signed_up</code> event for that user</li>
        </ul>

        <h3 style="margin-top: 20px;">Code Example</h3>
        <pre>// After creating the user
PostHog::identify([
    'distinctId' => $user->getPostHogDistinctId(),
    'properties' => $user->getPostHogProperties(),
]);
PostHog::capture('user_signed_up', [
    'signup_method' => 'form',
], $user->getPostHogDistinctId());</pre>
    </div>
</div>
