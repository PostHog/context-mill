<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PostHogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ErrorTestController extends Controller
{
    public function test(Request $request, PostHogService $posthog): JsonResponse
    {
        $shouldCapture = $request->query('capture', 'true') === 'true';
        $user = Auth::user();

        try {
            throw new \Exception('Test exception from critical operation');
        } catch (\Throwable $e) {
            if ($shouldCapture) {
                // Capture in PostHog
                $posthog->identify($user->email, $user->getPostHogProperties());
                $eventId = $posthog->captureException($e, $user->email);

                return response()->json([
                    'error' => 'Operation failed',
                    'error_id' => $eventId,
                    'message' => "Error captured in PostHog. Reference ID: {$eventId}",
                ], 500);
            }

            return response()->json([
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
