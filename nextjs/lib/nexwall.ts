// Server-side helper for the NexWall Developer API.
// Only import this from route handlers / server code: it reads NEXWALL_API_KEY.

export const NEXWALL_BASE_URL =
  process.env.NEXWALL_BASE_URL ?? "https://nexwall.kodnextech.com/api/developer/v1";

/** Response headers worth passing back to the browser. */
const FORWARDED_HEADERS = [
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
  "x-developer-api-plan",
  "retry-after",
];

/**
 * Calls NexWall from the server and returns a Response for the browser.
 *
 * `revalidate` is passed to Next.js' fetch cache: identical requests within that
 * many seconds are answered from the cache and do not use your daily quota.
 */
export async function proxyToNexWall(
  path: string,
  query: URLSearchParams,
  revalidate: number,
): Promise<Response> {
  const apiKey = process.env.NEXWALL_API_KEY;
  if (!apiKey) {
    return Response.json(
      { message: "NEXWALL_API_KEY is not set. Copy .env.example to .env.local and add your key." },
      { status: 500 },
    );
  }

  const qs = query.toString();
  const url = `${NEXWALL_BASE_URL}${path}${qs ? `?${qs}` : ""}`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      next: { revalidate },
    });
  } catch {
    return Response.json({ message: "Could not reach the NexWall API." }, { status: 502 });
  }

  const headers = new Headers({
    "Content-Type": "application/json",
    // Let the browser / CDN reuse the answer briefly too.
    "Cache-Control": upstream.ok ? `public, max-age=60, s-maxage=${revalidate}` : "no-store",
  });
  for (const name of FORWARDED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  }

  // Pass the body through unchanged (success JSON or the API's error JSON).
  const body = await upstream.text();
  return new Response(body, { status: upstream.status, headers });
}

/** Copies only the query parameters we allow from the browser request. */
export function pickParams(source: URLSearchParams, allowed: readonly string[]): URLSearchParams {
  const out = new URLSearchParams();
  for (const key of allowed) {
    const value = source.get(key);
    if (value !== null && value !== "") out.set(key, value.slice(0, 100));
  }
  return out;
}

// ---- Types (subset of the API response, see https://nexwall.kodnextech.com/openapi.json) ----

export interface Category {
  id: number;
  name: string;
  slug: string;
  cover_image_url: string | null;
  wallpaper_count: number;
  is_premium: boolean;
}

export interface Wallpaper {
  id: number;
  category_id: number;
  image_url: string;
  thumbnail_url: string | null;
  is_premium: boolean;
  type: "image" | "live";
  video_url: string | null;
  video_thumbnail_url: string | null;
  duration_seconds: number | null;
  tags: string[] | null;
  resolution: string | null;
  file_size: number | string | null;
  category: Category | null;
  categories: Category[];
}

export interface CategoriesResponse {
  data: Category[];
  plan: string;
  remaining_requests_today: number;
}

export interface WallpapersResponse {
  data: Wallpaper[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  plan: string;
  remaining_requests_today: number;
}
