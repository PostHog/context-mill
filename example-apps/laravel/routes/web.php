<?php

use App\Http\Livewire\Auth\Login;
use App\Http\Livewire\Auth\Register;
use App\Http\Livewire\BurritoTracker;
use App\Http\Livewire\Dashboard;
use App\Http\Livewire\Profile;
use App\Services\PostHogService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

// Guest routes
Route::middleware('guest')->group(function () {
    Route::get('/', Login::class)->name('login');
    Route::get('/register', Register::class)->name('register');
});

// Authenticated routes
Route::middleware('auth')->group(function () {
    Route::get('/dashboard', Dashboard::class)->name('dashboard');
    Route::get('/burrito', BurritoTracker::class)->name('burrito');
    Route::get('/profile', Profile::class)->name('profile');

    Route::post('/logout', function (PostHogService $posthog) {
        $user = Auth::user();

        // PostHog: Track logout
        $posthog->capture($user->email, 'user_logged_out');

        Auth::logout();
        request()->session()->invalidate();
        request()->session()->regenerateToken();

        return redirect('/');
    })->name('logout');
});
