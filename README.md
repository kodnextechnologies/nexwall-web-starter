# Wallpaper API Web Starter — Next.js, React, Laravel & JavaScript (Free NexWall API)

Three small, open-source web starters for the [NexWall **free wallpaper API**](https://nexwall.kodnextech.com/wallpaper-api/free-wallpaper-api): a Next.js (App Router, TypeScript) app for React developers, drop-in files for an existing Laravel project, and a plain HTML/CSS/JavaScript page with a zero-dependency Node.js proxy. Each one shows wallpaper categories, a paginated wallpaper grid, the full-size image and a download link, and each keeps your API key on the server behind a small cached proxy.

## Examples

| Folder | Stack | What you get | Key stays on |
| --- | --- | --- | --- |
| [`nextjs/`](nextjs) | Next.js 16 (App Router), React 19, TypeScript | Route handlers `/api/wallpapers` + `/api/categories` (cached proxy) and a client page with category chips, grid, "Load more", full image viewer | Next.js server |
| [`laravel/`](laravel) | Laravel 10 / 11 / 12, PHP 8.1+ | `NexWallClient` service (Http facade + `Cache::remember`), controller, Blade view with category filter and pagination, optional JSON proxy routes. **Drop-in files, not a full app** | Laravel server |
| [`vanilla-js/`](vanilla-js) | HTML, CSS, JavaScript, Node.js 18+ (no npm dependencies) | `server.mjs` static server + `/api/*` proxy with in-memory cache, and a framework-free frontend | Node.js server |

All three use the same proxy contract (`GET {proxy}/categories` and `GET {proxy}/wallpapers?page=&per_page=&category_id=&type=&search=&sort=`, returning the API's JSON unchanged), so the vanilla-js frontend also works on top of the Next.js or Laravel proxy.

## Features

- API key read from an environment variable on the server only; the browser never sees it
- Allow-listed query parameters (`page`, `per_page`, `category_id`, `type`, `search`, `sort`) so your proxy cannot be used to call arbitrary endpoints
- Response caching to save quota (5 minutes for wallpaper pages, 1 hour for categories by default)
- Category filter, 9:16 wallpaper grid with lazy-loaded thumbnails, pagination ("Load more" or previous/next)
- Full-size image viewer with "Open full image" and "Download"
- Shows `remaining_requests_today` from the API
- Handles `401`, `404`, `422` and `429` (shows the `Retry-After` wait time); errors are never cached
- Rate-limit headers (`X-RateLimit-*`, `X-Developer-Api-Plan`, `Retry-After`) are passed through by the Next.js and Node proxies

## Get a free API key

Sign up at **https://nexwall.kodnextech.com/developers/register**. The free plan needs no credit card.

```bash
git clone https://github.com/kodnextechnologies/nexwall-web-starter.git
cd nexwall-web-starter
```

## Quick start: Next.js (and React)

Requires Node.js 20.9+.

```bash
cd nextjs
npm install
cp .env.example .env.local      # then set NEXWALL_API_KEY=your_key_here
npm run dev                     # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run typecheck` (`next typegen && tsc --noEmit`).

How it works:

```
Browser (app/page.tsx, client component)
   │  fetch("/api/wallpapers?page=2&category_id=5")
   ▼
app/api/wallpapers/route.ts  ──►  lib/nexwall.ts  ──►  NexWall API
   (allow-lists params)           adds Authorization: Bearer $NEXWALL_API_KEY
                                  fetch(..., { next: { revalidate: 300 } })
```

```
nextjs/
├── app/
│   ├── api/categories/route.ts   # GET /api/categories  (cached 1 hour)
│   ├── api/wallpapers/route.ts   # GET /api/wallpapers  (cached 5 minutes)
│   ├── layout.tsx
│   ├── page.tsx                  # client UI: chips, grid, Load more, viewer
│   └── globals.css
├── lib/nexwall.ts                # server-side proxy helper + response types
├── next.config.ts
└── .env.example                  # copy to .env.local
```

**Why the cache?** The free plan allows **100 requests per day**. Without caching, every visitor and every "Load more" click would use one request, and a handful of visitors could use up the day's quota. With `next: { revalidate: 300 }`, Next.js stores each unique response (for example "page 2 of category 5") in its Data Cache and answers identical requests from it for 5 minutes without calling NexWall. Adjust the numbers in the two route handlers to taste. Two side effects: `sort=random` returns the same "random" page for up to 5 minutes, and the "requests left today" badge can show a value up to 5 minutes old.

**React without Next.js?** `app/page.tsx` is an ordinary React component that calls `/api/...` with `fetch`. You can reuse it in a Vite or Create React App project as long as some server (the Laravel or Node proxy below, or your own) answers `/api/categories` and `/api/wallpapers`.

**Images:** the starter uses a plain `<img loading="lazy">`, so no `next/image` configuration is needed. To switch to `next/image`, add an `images.remotePatterns` entry for `nexwall.kodnextech.com` (and any other host that appears in `image_url` / `thumbnail_url`); see the comment in `next.config.ts`.

## Quick start: Laravel

`laravel/` is **not** a full Laravel application. It contains files you copy into an existing Laravel 10, 11 or 12 project (PHP 8.1+). No extra Composer packages are needed and there is no frontend build step.

```
laravel/
├── app/Services/NexWallClient.php                # Http facade + Cache::remember
├── app/Services/NexWallException.php             # status + retryAfter
├── app/Http/Controllers/WallpaperController.php  # Blade page + JSON proxy
├── config/nexwall.php
├── resources/views/wallpapers/index.blade.php    # grid, category filter, pagination (plain CSS)
├── routes/web.php                                # snippet to ADD to your routes file
└── .env.example                                  # lines to add to your .env
```

1. Copy the files into the same paths in your project:

   ```bash
   cp -r laravel/app/* /path/to/your-app/app/
   cp laravel/config/nexwall.php /path/to/your-app/config/
   mkdir -p /path/to/your-app/resources/views/wallpapers
   cp laravel/resources/views/wallpapers/index.blade.php /path/to/your-app/resources/views/wallpapers/
   ```

2. Add the lines from `laravel/.env.example` to your `.env`:

   ```
   NEXWALL_API_KEY=your_key_here
   ```

3. **Add** (do not replace) the routes from `laravel/routes/web.php` to your `routes/web.php`:

   ```php
   use App\Http\Controllers\WallpaperController;

   Route::get('/wallpapers', [WallpaperController::class, 'index'])->name('wallpapers.index');

   Route::prefix('nexwall-api')->middleware('throttle:60,1')->group(function () {
       Route::get('/categories', [WallpaperController::class, 'apiCategories']);
       Route::get('/wallpapers', [WallpaperController::class, 'apiWallpapers']);
   });
   ```

4. Clear cached config if you use it (`php artisan config:clear`), run `php artisan serve` and open `/wallpapers`.

Notes:

- `NexWallClient::fromConfig()` reads `config/nexwall.php`. Successful responses are cached with `Cache::remember` in your default cache store (`NEXWALL_CACHE_TTL`, default 300 seconds; categories `NEXWALL_CATEGORIES_CACHE_TTL`, default 3600). Failed requests throw before anything is stored, so errors are not cached.
- Errors become a `NexWallException` with `status` (401, 404, 422, 429, 0 for connection failures) and `retryAfter` (from the `Retry-After` header on 429). The Blade page shows the message; the JSON routes return it with the same status code and `Retry-After` header.
- The `/nexwall-api/*` routes are optional. Keep them only if a JavaScript frontend needs the data; `throttle:60,1` limits each visitor to 60 requests per minute.
- The client also has `categoryWallpapers($id, $params)` and `wallpaper($id)` for `GET /categories/{id}/wallpapers` and `GET /wallpapers/{id}`.

## Quick start: Vanilla JavaScript

Requires Node.js 18+. There is nothing to install.

```bash
cd vanilla-js
cp .env.example .env            # then set NEXWALL_API_KEY=your_key_here
node server.mjs                 # http://localhost:3000
```

`server.mjs` loads `.env` automatically on Node 20.12+ / 21.7+. On older versions, set the variable yourself (`NEXWALL_API_KEY=your_key node server.mjs`, or in PowerShell `$env:NEXWALL_API_KEY="your_key"; node server.mjs`) or use `node --env-file=.env server.mjs` on Node 20.6+.

```
vanilla-js/
├── server.mjs        # static server for ./public + /api/* proxy with in-memory cache
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js        # calls API_BASE (default "/api"), never NexWall directly
├── package.json      # "npm start" / "npm run check"; no dependencies
└── .env.example
```

The proxy forwards only `GET /api/categories`, `/api/wallpapers`, `/api/wallpapers/{id}` and `/api/categories/{id}/wallpapers`, with the allow-listed query parameters. Successful (200) responses are kept in memory for `NEXWALL_CACHE_TTL` seconds (default 300, up to 500 entries); the response header `X-Proxy-Cache: HIT|MISS` shows which you got. The cache is per process and is cleared on restart.

### Use the same frontend with the Next.js or Laravel proxy

- **Next.js:** copy `vanilla-js/public/*` into `nextjs/public/` (for example `nextjs/public/vanilla/`) and open `/vanilla/index.html`. The Next.js route handlers already answer `/api/categories` and `/api/wallpapers`.
- **Laravel:** copy `vanilla-js/public/*` into your Laravel `public/nexwall/` folder and add this line to `index.html` before `app.js`:

  ```html
  <script>window.NEXWALL_API_BASE = "/nexwall-api";</script>
  ```

  Then open `/nexwall/index.html`.

Serving the frontend from the same origin as the proxy avoids any CORS setup.

### Calling the API directly from the browser (local experiments only)

The NexWall API sends `Access-Control-Allow-Origin: *`, so a browser page *can* call it directly:

```js
// LOCAL EXPERIMENTS ONLY. Anyone who opens DevTools can copy this key.
const res = await fetch("https://nexwall.kodnextech.com/api/developer/v1/wallpapers?per_page=10", {
  headers: { Authorization: "Bearer YOUR_KEY", Accept: "application/json" },
});
```

That is handy for a quick test on your own machine, but the key is visible to every visitor and can be used to drain your quota. **Never ship a page that contains your key.** Use one of the proxies above.

## Keep your API key secret

- Put the key in `.env` / `.env.local` (all ignored by `.gitignore`) or in your host's secret settings. Commit only `.env.example`.
- In Next.js, never name it `NEXT_PUBLIC_...`; in Vite, never `VITE_...`. Those prefixes are inlined into the browser bundle.
- In Laravel, read it only through `config('nexwall.api_key')` on the server and never pass it to a Blade view or JavaScript.
- Keep the parameter allow-list and caching in your proxy, and consider rate limiting it (the Laravel routes use `throttle:60,1`).
- If a key ends up in a commit or a public page, treat it as compromised and replace it.

## API endpoints used

Base URL: `https://nexwall.kodnextech.com/api/developer/v1`

Every request sends `Authorization: Bearer <API_KEY>` and `Accept: application/json`.

| Endpoint | Next.js | Laravel | Vanilla JS proxy |
| --- | --- | --- | --- |
| `GET /categories` | `/api/categories` | `categories()`, `/nexwall-api/categories` | `/api/categories` |
| `GET /wallpapers?page=&per_page=&category_id=&type=&search=&sort=` | `/api/wallpapers` | `wallpapers()`, `/nexwall-api/wallpapers` | `/api/wallpapers` |
| `GET /categories/{id}/wallpapers` | | `categoryWallpapers()` | `/api/categories/{id}/wallpapers` |
| `GET /wallpapers/{id}` | | `wallpaper()` | `/api/wallpapers/{id}` |

Parameters: `per_page` 1-100 (default 50; these starters use 24); `type` is `image` or `live` (live requires Ultra); `search` is 2-100 characters and matches tags; `sort` is `newest`, `oldest`, `popular` or `random`. List responses include `current_page`, `last_page`, `per_page`, `total`, `plan` and `remaining_requests_today`.

Full reference: [API docs](https://nexwall.kodnextech.com/wallpaper-api/docs) · [OpenAPI spec](https://nexwall.kodnextech.com/openapi.json) · [Sandbox](https://nexwall.kodnextech.com/wallpaper-api/sandbox)

## Rate limits & plans

| Plan | Price | Requests per day | Content |
| --- | --- | --- | --- |
| Free | Free, no credit card | 100 | Non-premium categories |
| Pro | ₹399 / $4.99 per month | 10,000 | |
| Ultra | ₹899 / $10.99 per month | 50,000 | Includes live (video) wallpapers |

- The free plan also allows up to 60 requests per minute and one API key.
- Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` and `X-Developer-Api-Plan` headers; the JSON body includes `plan` and `remaining_requests_today`.
- When you run out, the API returns **HTTP 429** with a `Retry-After` header. The starters show the wait time and do not retry on their own.
- On a public website, 100 requests per day goes quickly even with caching. The free plan is meant for development and personal projects.
- **Commercial or monetized sites and apps** (ads, subscriptions, paid products, client work) need a **Pro or Ultra** plan under the [NexWall Developer API License](https://nexwall.kodnextech.com/wallpaper-api/license).

## Notes and limitations

- **Download:** the image files are served from a different origin than your site, and browsers ignore the `download` attribute on cross-origin links. Clicking "Download" therefore usually opens the image in a new tab, where it can be saved. A same-origin download route is left out to keep the proxies small.
- Live (video) wallpapers need the Ultra plan; the starters request `type=image` only.
- No automated tests are included. The code is checked with `npm run typecheck` / `next build` (Next.js), `php -l` (Laravel PHP files) and `node --check` (vanilla-js); the Laravel files have not been run inside every Laravel version listed.

## Related starters

- [Flutter wallpaper app](https://github.com/kodnextechnologies/nexwall-flutter-wallpaper-app)
- [Android Kotlin wallpaper app (Jetpack Compose)](https://github.com/kodnextechnologies/nexwall-android-kotlin-wallpaper-app)
- [React Native / Expo wallpaper app](https://github.com/kodnextechnologies/nexwall-react-native-expo-wallpaper-app)
- [Python client and CLI with a daily wallpaper changer](https://github.com/kodnextechnologies/nexwall-python)

## License

The source code is released under the [MIT License](LICENSE).

Wallpaper images and videos returned by the API are **not** covered by the MIT license. Their use is governed by the [NexWall Developer API License](https://nexwall.kodnextech.com/wallpaper-api/license).
