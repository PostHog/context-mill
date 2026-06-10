<div>
    <div class="card">
        <h1>Welcome to PostHog Laravel Example</h1>
        <p class="text-gray mb-4">This example demonstrates how to integrate PostHog with a Laravel application.</p>

        <form wire:submit="login">
            <label for="email">Email</label>
            <input
                type="email"
                id="email"
                wire:model="email"
                required
            >
            @error('email') <div class="error">{{ $message }}</div> @enderror

            <label for="password">Password</label>
            <input
                type="password"
                id="password"
                wire:model="password"
                required
            >
            @error('password') <div class="error">{{ $message }}</div> @enderror

            <div style="margin-bottom: 15px;">
                <label style="display: inline; font-weight: normal;">
                    <input type="checkbox" wire:model="remember" style="width: auto; margin-right: 5px;">
                    Remember me
                </label>
            </div>

            <button type="submit">Login</button>
        </form>

        <p style="margin-top: 16px;" class="text-sm text-gray">
            Don't have an account? <a href="{{ route('register') }}">Sign up here</a>
        </p>
        <p class="text-sm text-gray">
            <strong>Tip:</strong> Default credentials are admin@example.com/admin
        </p>
    </div>

    <div class="card">
        <h2>Features Demonstrated</h2>
        <ul class="text-gray">
            <li>User registration and identification</li>
            <li>Event tracking</li>
            <li>Feature flags</li>
            <li>Error tracking</li>
        </ul>
    </div>
</div>
