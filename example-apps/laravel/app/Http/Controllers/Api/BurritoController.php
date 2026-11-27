<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use PostHog\Laravel\Facades\PostHog;

class BurritoController extends Controller
{
    public function consider(Request $request): JsonResponse
    {
        // Increment session counter
        $burritoCount = session('burrito_count', 0) + 1;
        session(['burrito_count' => $burritoCount]);

        // PostHog: Track event
        PostHog::capture('burrito_considered', [
            'total_considerations' => $burritoCount,
        ]);

        return response()->json([
            'success' => true,
            'count' => $burritoCount,
        ]);
    }
}
