// Plain JavaScript frontend. It only talks to YOUR proxy (API_BASE), never to
// NexWall directly, so the API key stays on the server.

const API_BASE = window.NEXWALL_API_BASE || "/api";
const PER_PAGE = 24;

const state = { categoryId: null, page: 0, lastPage: 1, loading: false, requestId: 0 };

const $ = (id) => document.getElementById(id);
const els = {
  quota: $("quota"),
  chips: $("chips"),
  error: $("error"),
  grid: $("grid"),
  empty: $("empty"),
  more: $("more"),
  overlay: $("overlay"),
  viewerImg: $("viewer-img"),
  viewerInfo: $("viewer-info"),
  viewerOpen: $("viewer-open"),
  viewerDownload: $("viewer-download"),
  viewerClose: $("viewer-close"),
};

async function api(path, params) {
  const qs = params ? `?${new URLSearchParams(params)}` : "";
  const res = await fetch(`${API_BASE}${path}${qs}`, { headers: { Accept: "application/json" } });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    let message = (body && body.message) || `Request failed (HTTP ${res.status})`;
    if (res.status === 429) {
      const retry = res.headers.get("Retry-After");
      message = `Rate limit reached.${retry ? ` Try again in ${retry} seconds.` : ""} ${message}`;
    }
    throw new Error(message);
  }
  if (body && typeof body.remaining_requests_today === "number") {
    els.quota.textContent = `${body.remaining_requests_today} API requests left today`;
    els.quota.hidden = false;
  }
  return body;
}

function showError(message) {
  els.error.textContent = message || "";
  els.error.hidden = !message;
}

function chip(label, count, categoryId) {
  const button = document.createElement("button");
  button.className = "chip";
  button.dataset.id = categoryId === null ? "" : String(categoryId);
  button.textContent = label + " ";
  if (count !== null) {
    const small = document.createElement("small");
    small.textContent = `(${count})`;
    button.append(small);
  }
  button.addEventListener("click", () => selectCategory(categoryId));
  return button;
}

function renderChips(categories) {
  els.chips.replaceChildren(
    chip("All", null, null),
    ...categories.map((c) => chip(c.name, c.wallpaper_count, c.id)),
  );
  highlightChip();
}

function highlightChip() {
  const active = state.categoryId === null ? "" : String(state.categoryId);
  for (const el of els.chips.children) el.classList.toggle("active", el.dataset.id === active);
}

function renderWallpapers(wallpapers) {
  for (const w of wallpapers) {
    const card = document.createElement("button");
    card.className = "card";
    card.setAttribute("aria-label", `Open wallpaper ${w.id}`);
    const img = document.createElement("img");
    img.src = w.thumbnail_url || w.image_url;
    img.alt = (w.tags && w.tags.join(", ")) || `Wallpaper ${w.id}`;
    img.loading = "lazy";
    card.append(img);
    card.addEventListener("click", () => openViewer(w));
    els.grid.append(card);
  }
}

async function loadPage(page) {
  const id = ++state.requestId;
  state.loading = true;
  els.more.disabled = true;
  els.more.textContent = "Loading...";
  showError("");

  const params = { page, per_page: PER_PAGE, type: "image", sort: "newest" };
  if (state.categoryId !== null) params.category_id = state.categoryId;

  try {
    const res = await api("/wallpapers", params);
    if (id !== state.requestId) return; // a newer request won
    if (page === 1) els.grid.replaceChildren();
    renderWallpapers(res.data);
    state.page = res.current_page;
    state.lastPage = res.last_page;
  } catch (err) {
    if (id === state.requestId) showError(err.message);
  } finally {
    if (id === state.requestId) {
      state.loading = false;
      els.more.disabled = false;
      els.more.textContent = "Load more";
      els.more.hidden = state.page >= state.lastPage;
      els.empty.hidden = els.grid.children.length > 0 || !els.error.hidden;
    }
  }
}

function selectCategory(categoryId) {
  state.categoryId = categoryId;
  state.page = 0;
  els.grid.replaceChildren();
  highlightChip();
  loadPage(1);
}

function openViewer(w) {
  els.viewerImg.src = w.image_url;
  els.viewerImg.alt = `Wallpaper ${w.id}`;
  els.viewerInfo.textContent = [w.resolution, w.category && w.category.name].filter(Boolean).join(" · ");
  els.viewerOpen.href = w.image_url;
  els.viewerDownload.href = w.image_url;
  els.overlay.hidden = false;
}

function closeViewer() {
  els.overlay.hidden = true;
  els.viewerImg.removeAttribute("src");
}

els.more.addEventListener("click", () => loadPage(state.page + 1));
els.viewerClose.addEventListener("click", closeViewer);
els.overlay.addEventListener("click", (e) => {
  if (e.target === els.overlay) closeViewer();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !els.overlay.hidden) closeViewer();
});

api("/categories")
  .then((res) => renderChips(res.data))
  .catch((err) => showError(err.message));
loadPage(1);
