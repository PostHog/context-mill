<?php

namespace App\Http\Livewire\Auth;

use App\Models\User;
use App\Services\PostHogService;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;

class Register extends Component
{
    public string $email = '';
    public string $password = '';
    public string $password_confirmation = '';

    protected $rules = [
        'email' => 'required|email|unique:users,email',
        'password' => 'required|min:6|confirmed',
    ];

    public function register(PostHogService $posthog)
    {
        $validated = $this->validate();

        $user = User::create([
            'email' => $validated['email'],
            'password' => bcrypt($validated['password']),
            'is_staff' => false,
        ]);

        // PostHog: Identify new user and track signup
        $posthog->identify($user->email, $user->getPostHogProperties());
        $posthog->capture($user->email, 'user_signed_up', [
            'signup_method' => 'form',
        ]);

        Auth::login($user);

        session()->flash('success', 'Account created successfully!');

        return redirect()->route('dashboard');
    }

    public function render()
    {
        return view('livewire.auth.register')
            ->layout('components.layouts.guest');
    }
}
