// Zero-dependency proxy + static file server for the NexWall Wallpaper API.
// Node.js 18+ (uses the built-in http module and global fetch).
//
//   NEXWALL_API_KEY=your_key node server.mjs        # macOS / Linux
//   node --env-file=.env server.mjs                  # Node 20.6+
//
// Serves ./public and forwards a small allow-list of /api/* routes to NexWall,
// adding the API key on the server so it never reaches the browser.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env if present (process.loadEnvFile exists on Node 20.12+ / 21.7+).
try {
  process.loadEnvFile?.(".env");
} catch {
  /* no .env file: rely on real environment variables */
}

const PORT = Number(process.env.PORT ?? 3000);
const API_KEY = process.env.NEXWALL_API_KEY ?? "";
const BASE_URL = (process.env.NEXWALL_BASE_URL ?? "https://nexwall.kodnextech.com/api/developer/v1").replace(/\/$/, "");
const CACHE_TTL_MS = Number(process.env.NEXWALL_CACHE_TTL ?? 300) * 1000;
const PUBLIC_DIR = resolve(fileURLToPath(new URL("./public", import.meta.url)));

const ALLOWED_PARAMS = ["page", "per_page", "category_id", "type", "search", "sort"];
const FORWARDED_HEADERS = [
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
  "x-developer-api-plan",
  "retry-after",
];
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

/** Tiny in-memory cache: key -> { expires, status, headers, body }. Only 200 responses are stored. */
const cache = new Map();
const MAX_CACHE_ENTRIES = 500;

/** Maps a browser path to an upstream API path, or null if not allowed. */
function upstreamPath(pathname) {
  if (pathname === "/api/categories") return "/categories";
  if (pathname === "/api/wallpapers") return "/wallpapers";
  let m = pathname.match(/^\/api\/wallpapers\/(\d+)$/);
  if (m) return `/wallpapers/${m[1]}`;
  m = pathname.match(/^\/api\/categories\/(\d+)\/wallpapers$/);
  if (m) return `/categories/${m[1]}/wallpapers`;
  return null;
}

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(data));
}

async function handleApi(url, res) {
  const path = upstreamPath(url.pathname);
  if (!path) return sendJson(res, 404, { message: "Unknown API route." });
  if (!API_KEY) {
    return sendJson(res, 500, { message: "NEXWALL_API_KEY is not set. Copy .env.example to .env and add your key." });
  }

  const query = new URLSearchParams();
  for (const key of ALLOWED_PARAMS) {
    const value = url.searchParams.get(key);
    if (value) query.set(key, value.slice(0, 100));
  }
  query.sort();
  const qs = query.toString();
  const target = `${BASE_URL}${path}${qs ? `?${qs}` : ""}`;

  const hit = cache.get(target);
  if (hit && hit.expires > Date.now()) {
    res.writeHead(hit.status, { ...hit.headers, "X-Proxy-Cache": "HIT" });
    return res.end(hit.body);
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return sendJson(res, 502, { message: "Could not reach the NexWall API." });
  }

  const body = await upstream.text();
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  for (const name of FORWARDED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) headers[name] = value;
  }

  if (upstream.status === 200) {
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
    cache.set(target, { expires: Date.now() + CACHE_TTL_MS, status: 200, headers, body });
  }

  res.writeHead(upstream.status, { ...headers, "X-Proxy-Cache": "MISS" });
  res.end(body);
}

async function handleStatic(url, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    return res.end("Bad request");
  }
  if (pathname.endsWith("/")) pathname += "index.html";

  const filePath = normalize(join(PUBLIC_DIR, pathname));
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + sep)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end();
  }
  try {
    if (url.pathname.startsWith("/api/")) await handleApi(url, res);
    else await handleStatic(url, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { message: "Internal server error." });
    else res.end();
  }
});

server.listen(PORT, () => {
  console.log(`NexWall vanilla-js starter running at http://localhost:${PORT}`);
  if (!API_KEY) console.warn("Warning: NEXWALL_API_KEY is not set; /api/* will return 500.");
});
