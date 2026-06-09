<?php

namespace App\Http\Livewire\Auth;

use App\Services\PostHogService;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;

class Login extends Component
{
    public string $email = '';
    public string $password = '';
    public bool $remember = false;

    protected $rules = [
        'email' => 'required|email',
        'password' => 'required',
    ];

    public function login(PostHogService $posthog)
    {
        $this->validate();

        if (Auth::attempt(['email' => $this->email, 'password' => $this->password], $this->remember)) {
            $user = Auth::user();

            // PostHog: Identify and track login
            $posthog->identify($user->email, $user->getPostHogProperties());
            $posthog->capture($user->email, 'user_logged_in', [
                'login_method' => 'password',
            ]);

            session()->regenerate();

            return redirect()->intended(route('dashboard'));
        }

        $this->addError('email', 'Invalid credentials');
    }

    public function render()
    {
        return view('livewire.auth.login')
            ->layout('components.layouts.guest');
    }
}
