<?php

namespace App\Http\Controllers;

use App\Services\NexWallClient;
use App\Services\NexWallException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class WallpaperController extends Controller
{
    private NexWallClient $nexwall;

    public function __construct()
    {
        $this->nexwall = NexWallClient::fromConfig();
    }

    /**
     * Server-rendered gallery: GET /wallpapers?category=5&page=2
     */
    public function index(Request $request): View
    {
        $validated = $request->validate([
            'category' => ['nullable', 'integer', 'min:1'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $categoryId = isset($validated['category']) ? (int) $validated['category'] : null;
        $page = (int) ($validated['page'] ?? 1);

        $categories = [];
        $result = null;
        $error = null;

        try {
            $categories = $this->nexwall->categories()['data'] ?? [];
            $result = $this->nexwall->wallpapers([
                'page' => $page,
                'per_page' => 24,
                'category_id' => $categoryId,
                'type' => 'image',
                'sort' => 'newest',
            ]);
        } catch (NexWallException $e) {
            report($e);
            $error = $e->getMessage();
        }

        return view('wallpapers.index', [
            'categories' => $categories,
            'categoryId' => $categoryId,
            'wallpapers' => $result['data'] ?? [],
            'currentPage' => $result['current_page'] ?? $page,
            'lastPage' => $result['last_page'] ?? 1,
            'total' => $result['total'] ?? 0,
            'remaining' => $result['remaining_requests_today'] ?? null,
            'error' => $error,
        ]);
    }

    /**
     * JSON proxy: GET /nexwall-api/categories
     * Lets a JavaScript frontend (e.g. the vanilla-js example) use the API without seeing the key.
     */
    public function apiCategories(): JsonResponse
    {
        return $this->json(fn () => $this->nexwall->categories());
    }

    /**
     * JSON proxy: GET /nexwall-api/wallpapers?page=&per_page=&category_id=&type=&search=&sort=
     */
    public function apiWallpapers(Request $request): JsonResponse
    {
        $params = $request->only(NexWallClient::WALLPAPER_PARAMS);

        return $this->json(fn () => $this->nexwall->wallpapers($params));
    }

    private function json(callable $call): JsonResponse
    {
        try {
            return response()->json($call());
        } catch (NexWallException $e) {
            $status = $e->status >= 400 ? $e->status : 502;
            $headers = $e->retryAfter !== null ? ['Retry-After' => (string) $e->retryAfter] : [];

            return response()->json(['message' => $e->getMessage()], $status, $headers);
        }
    }
}
