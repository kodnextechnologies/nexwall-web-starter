<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Small server-side client for the NexWall Developer API (v1).
 *
 * Successful responses are cached (config('nexwall.cache_ttl')) so repeated
 * page views do not use your daily quota. Errors are never cached.
 */
class NexWallClient
{
    /** Query parameters accepted by GET /wallpapers. */
    public const WALLPAPER_PARAMS = ['page', 'per_page', 'category_id', 'type', 'search', 'sort'];

    public function __construct(
        private readonly string $baseUrl,
        private readonly ?string $apiKey,
        private readonly int $cacheTtl = 300,
        private readonly int $categoriesCacheTtl = 3600,
        private readonly int $timeout = 10,
    ) {
    }

    public static function fromConfig(): self
    {
        return new self(
            rtrim((string) config('nexwall.base_url'), '/'),
            config('nexwall.api_key'),
            (int) config('nexwall.cache_ttl', 300),
            (int) config('nexwall.categories_cache_ttl', 3600),
            (int) config('nexwall.timeout', 10),
        );
    }

    /** GET /categories */
    public function categories(): array
    {
        return $this->get('/categories', [], $this->categoriesCacheTtl);
    }

    /**
     * GET /wallpapers
     *
     * @param  array{page?:int, per_page?:int, category_id?:int, type?:string, search?:string, sort?:string}  $params
     */
    public function wallpapers(array $params = []): array
    {
        return $this->get('/wallpapers', $this->only($params));
    }

    /** GET /categories/{id}/wallpapers */
    public function categoryWallpapers(int $categoryId, array $params = []): array
    {
        return $this->get("/categories/{$categoryId}/wallpapers", $this->only($params));
    }

    /** GET /wallpapers/{id} */
    public function wallpaper(int $id): array
    {
        return $this->get("/wallpapers/{$id}");
    }

    private function only(array $params): array
    {
        $params = array_intersect_key($params, array_flip(self::WALLPAPER_PARAMS));

        return array_filter($params, fn ($v) => $v !== null && $v !== '');
    }

    private function get(string $path, array $query = [], ?int $ttl = null): array
    {
        if (blank($this->apiKey)) {
            throw new NexWallException('NEXWALL_API_KEY is not set. Add it to your .env file.', 500);
        }

        ksort($query);
        $cacheKey = 'nexwall:'.md5($path.'?'.http_build_query($query));

        // If request() throws, nothing is stored, so errors are not cached.
        return Cache::remember($cacheKey, $ttl ?? $this->cacheTtl, fn () => $this->request($path, $query));
    }

    private function request(string $path, array $query): array
    {
        try {
            $response = Http::withToken($this->apiKey)
                ->acceptJson()
                ->timeout($this->timeout)
                ->get($this->baseUrl.$path, $query);
        } catch (ConnectionException $e) {
            throw new NexWallException('Could not reach the NexWall API.', 0);
        }

        if ($response->successful()) {
            return $response->json() ?? [];
        }

        throw $this->toException($response);
    }

    private function toException(Response $response): NexWallException
    {
        $status = $response->status();
        $body = (array) ($response->json() ?? []);
        $apiMessage = is_string($body['message'] ?? null) ? $body['message'] : null;

        $retryAfter = $response->header('Retry-After');
        $retryAfter = is_numeric($retryAfter) ? (int) $retryAfter : null;

        $message = match ($status) {
            401 => 'Invalid or missing NexWall API key (401).',
            404 => 'Not found (404).',
            422 => 'Invalid request parameters (422).',
            429 => 'NexWall rate limit reached (429).'.($retryAfter !== null ? " Try again in {$retryAfter} seconds." : ''),
            default => "NexWall API error (HTTP {$status}).",
        };

        if ($apiMessage !== null) {
            $message .= ' '.$apiMessage;
        }

        return new NexWallException($message, $status, $retryAfter, $body);
    }
}
