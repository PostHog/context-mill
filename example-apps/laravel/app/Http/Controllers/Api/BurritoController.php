<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PostHogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class BurritoController extends Controller
{
    public function consider(Request $request, PostHogService $posthog): JsonResponse
    {
        $user = Auth::user();

        // Increment session counter
        $burritoCount = session('burrito_count', 0) + 1;
        session(['burrito_count' => $burritoCount]);

        // PostHog: Track event
        $posthog->identify($user->email, $user->getPostHogProperties());
        $posthog->capture($user->email, 'burrito_considered', [
            'total_considerations' => $burritoCount,
        ]);

        return response()->json([
            'success' => true,
            'count' => $burritoCount,
        ]);
    }
}
