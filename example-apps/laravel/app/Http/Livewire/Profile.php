<?php

namespace App\Http\Livewire;

use Livewire\Component;
use PostHog\Laravel\Facades\PostHog;

class Profile extends Component
{
    public ?string $errorMessage = null;
    public ?string $successMessage = null;

    public function mount()
    {
        // PostHog: Track profile view
        PostHog::capture('profile_viewed');
    }

    public function testErrorWithCapture()
    {
        try {
            // Simulate an error
            throw new \Exception('This is a test error for PostHog tracking');
        } catch (\Exception $e) {
            // Capture the exception in PostHog
            PostHog::captureException($e);

            $this->successMessage = 'Error captured in PostHog!';
            $this->errorMessage = null;
        }
    }

    public function testErrorWithoutCapture()
    {
        try {
            // Simulate an error without capturing
            throw new \Exception('This error was NOT sent to PostHog');
        } catch (\Exception $e) {
            $this->errorMessage = "Error occurred but NOT captured in PostHog: " . $e->getMessage();
            $this->successMessage = null;
        }
    }

    public function render()
    {
        return view('livewire.profile')
            ->layout('components.layouts.app');
    }
}
