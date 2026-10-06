<?php

return [

    /*
    |--------------------------------------------------------------------------
    | NexWall Developer API
    |--------------------------------------------------------------------------
    |
    | Get a free key (no credit card): https://nexwall.kodnextech.com/developers/register
    | Docs: https://nexwall.kodnextech.com/wallpaper-api/docs
    |
    */

    'base_url' => env('NEXWALL_BASE_URL', 'https://nexwall.kodnextech.com/api/developer/v1'),

    // Server-side only. Never expose this in Blade, JavaScript or Vite env vars.
    'api_key' => env('NEXWALL_API_KEY'),

    // Seconds to cache successful responses. The free plan allows 100 requests
    // per day, so caching matters: identical requests within this window are
    // served from your cache store and do not use quota.
    'cache_ttl' => (int) env('NEXWALL_CACHE_TTL', 300),

    // Categories change rarely, so they get a longer cache.
    'categories_cache_ttl' => (int) env('NEXWALL_CATEGORIES_CACHE_TTL', 3600),

    // HTTP timeout in seconds.
    'timeout' => (int) env('NEXWALL_TIMEOUT', 10),

];
