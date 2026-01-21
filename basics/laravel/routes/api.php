<?php

use App\Http\Controllers\Api\BurritoController;
use App\Http\Controllers\Api\ErrorTestController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/burrito/consider', [BurritoController::class, 'consider']);
    Route::post('/test-error', [ErrorTestController::class, 'test']);
});
