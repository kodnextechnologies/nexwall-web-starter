"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CategoriesResponse, Category, Wallpaper, WallpapersResponse } from "@/lib/nexwall";

// This page runs in the browser and only talks to our own /api/* route handlers.
// The NexWall API key stays on the server.

const PER_PAGE = 24;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    let message = `Request failed (HTTP ${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* body was not JSON */
    }
    if (res.status === 429) {
      const retry = res.headers.get("Retry-After");
      message = `Rate limit reached.${retry ? ` Try again in ${retry} seconds.` : ""} ${message}`;
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [page, setPage] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [selected, setSelected] = useState<Wallpaper | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    getJson<CategoriesResponse>("/api/categories")
      .then((res) => {
        setCategories(res.data);
        setRemaining(res.remaining_requests_today);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const loadPage = useCallback(async (nextPage: number, catId: number | null) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(nextPage),
      per_page: String(PER_PAGE),
      type: "image",
      sort: "newest",
    });
    if (catId !== null) params.set("category_id", String(catId));
    try {
      const res = await getJson<WallpapersResponse>(`/api/wallpapers?${params}`);
      if (id !== requestId.current) return; // a newer request (category change) won
      setWallpapers((prev) => (nextPage === 1 ? res.data : [...prev, ...res.data]));
      setPage(res.current_page);
      setLastPage(res.last_page);
      setRemaining(res.remaining_requests_today);
    } catch (e) {
      if (id === requestId.current) setError((e as Error).message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setWallpapers([]);
    setPage(0);
    void loadPage(1, categoryId);
  }, [categoryId, loadPage]);

  return (
    <main className="container">
      <header className="header">
        <h1>NexWall Wallpapers</h1>
        {remaining !== null && (
          <span className="quota" title="Value from the last uncached API response">
            {remaining} API requests left today
          </span>
        )}
      </header>

      <nav className="chips" aria-label="Categories">
        <button className={categoryId === null ? "chip active" : "chip"} onClick={() => setCategoryId(null)}>
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={categoryId === c.id ? "chip active" : "chip"}
            onClick={() => setCategoryId(c.id)}
          >
            {c.name} <small>({c.wallpaper_count})</small>
          </button>
        ))}
      </nav>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <section className="grid">
        {wallpapers.map((w) => (
          <button key={w.id} className="card" onClick={() => setSelected(w)} aria-label={`Open wallpaper ${w.id}`}>
            {/* Plain <img>: no next/image remotePatterns needed. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={w.thumbnail_url ?? w.image_url} alt={w.tags?.join(", ") || `Wallpaper ${w.id}`} loading="lazy" />
          </button>
        ))}
      </section>

      {!loading && wallpapers.length === 0 && !error && <p className="muted">No wallpapers found.</p>}

      <div className="more">
        {page < lastPage && (
          <button className="button" disabled={loading} onClick={() => loadPage(page + 1, categoryId)}>
            {loading ? "Loading..." : "Load more"}
          </button>
        )}
        {loading && page === 0 && <p className="muted">Loading...</p>}
      </div>

      {selected && (
        <div className="overlay" role="dialog" aria-modal="true" onClick={() => setSelected(null)}>
          <div className="viewer" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.image_url} alt={`Wallpaper ${selected.id}`} />
            <div className="viewer-bar">
              <span>
                {selected.resolution ?? ""} {selected.category ? `· ${selected.category.name}` : ""}
              </span>
              <span className="actions">
                <a className="button" href={selected.image_url} target="_blank" rel="noopener noreferrer">
                  Open full image
                </a>
                <a className="button" href={selected.image_url} download target="_blank" rel="noopener noreferrer">
                  Download
                </a>
                <button className="button secondary" onClick={() => setSelected(null)}>
                  Close
                </button>
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
