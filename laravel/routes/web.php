<?php

// Add these lines to your existing routes/web.php (do not replace the file).

use App\Http\Controllers\WallpaperController;
use Illuminate\Support\Facades\Route;

// Server-rendered gallery
Route::get('/wallpapers', [WallpaperController::class, 'index'])->name('wallpapers.index');

// Optional JSON proxy for a JavaScript frontend (keeps the API key on the server).
// throttle:60,1 protects your NexWall quota from a single abusive visitor.
Route::prefix('nexwall-api')->middleware('throttle:60,1')->group(function () {
    Route::get('/categories', [WallpaperController::class, 'apiCategories']);
    Route::get('/wallpapers', [WallpaperController::class, 'apiWallpapers']);
});
