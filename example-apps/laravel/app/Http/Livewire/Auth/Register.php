<?php

namespace App\Http\Livewire\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;
use PostHog\Laravel\Facades\PostHog;

class Register extends Component
{
    public string $email = '';
    public string $password = '';
    public string $password_confirmation = '';

    protected $rules = [
        'email' => 'required|email|unique:users,email',
        'password' => 'required|min:6|confirmed',
    ];

    public function register()
    {
        $validated = $this->validate();

        $user = User::create([
            'email' => $validated['email'],
            'password' => bcrypt($validated['password']),
            'is_staff' => false,
        ]);

        // PostHog: Identify new user and track signup
        PostHog::identify([
            'distinctId' => $user->getPostHogDistinctId(),
            'properties' => $user->getPostHogProperties(),
        ]);
        PostHog::capture('user_signed_up', [
            'signup_method' => 'form',
        ], $user->getPostHogDistinctId());

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
