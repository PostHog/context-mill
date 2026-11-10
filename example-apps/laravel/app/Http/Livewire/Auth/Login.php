<?php

namespace App\Http\Livewire\Auth;

use Illuminate\Support\Facades\Auth;
use Livewire\Component;
use PostHog\Laravel\Facades\PostHog;

class Login extends Component
{
    public string $email = '';
    public string $password = '';
    public bool $remember = false;

    protected $rules = [
        'email' => 'required|email',
        'password' => 'required',
    ];

    public function login()
    {
        $this->validate();

        if (Auth::attempt(['email' => $this->email, 'password' => $this->password], $this->remember)) {
            $user = Auth::user();

            // PostHog: Identify and track login
            PostHog::identify([
                'distinctId' => $user->getPostHogDistinctId(),
                'properties' => $user->getPostHogProperties(),
            ]);
            PostHog::capture('user_logged_in', [
                'login_method' => 'password',
            ], $user->getPostHogDistinctId());

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
