<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use PostHog\Laravel\Facades\PostHog;

class ErrorTestController extends Controller
{
    public function test(Request $request): JsonResponse
    {
        $shouldCapture = $request->query('capture', 'true') === 'true';

        try {
            throw new \Exception('Test exception from critical operation');
        } catch (\Throwable $e) {
            if ($shouldCapture) {
                // Capture in PostHog
                PostHog::captureException($e, properties: ['operation' => 'critical']);

                return response()->json([
                    'error' => 'Operation failed',
                    'message' => 'Error captured in PostHog.',
                ], 500);
            }

            return response()->json([
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
