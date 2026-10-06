<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Wallpapers (NexWall API)</title>
    {{-- Plain CSS, no build step needed. --}}
    <style>
        :root { --bg:#0f1115; --panel:#1a1d24; --text:#e8e8ea; --muted:#9aa0aa; --accent:#6c8cff; --danger:#ff6b6b; }
        * { box-sizing: border-box; }
        body { margin:0; background:var(--bg); color:var(--text); font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
        .container { max-width:1200px; margin:0 auto; padding:16px; }
        .header { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px; }
        .header h1 { font-size:1.5rem; margin:8px 0; }
        .quota { font-size:.85rem; color:var(--muted); background:var(--panel); padding:4px 10px; border-radius:999px; }
        .chips { display:flex; gap:8px; overflow-x:auto; padding:12px 0; }
        .chip { flex:none; border:1px solid #2c303a; background:var(--panel); color:var(--text); padding:6px 14px; border-radius:999px; text-decoration:none; }
        .chip small { color:var(--muted); }
        .chip.active { background:var(--accent); border-color:var(--accent); color:#fff; }
        .chip.active small { color:#e6ebff; }
        .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:10px; }
        .card { display:block; background:var(--panel); border-radius:10px; overflow:hidden; aspect-ratio:9/16; }
        .card img { width:100%; height:100%; object-fit:cover; display:block; }
        .pager { display:flex; justify-content:center; align-items:center; gap:12px; padding:24px 0; }
        .button { background:var(--accent); color:#fff; text-decoration:none; padding:8px 16px; border-radius:8px; }
        .button.disabled { background:#2c303a; color:var(--muted); pointer-events:none; }
        .muted { color:var(--muted); text-align:center; }
        .error { background:#3a1d1f; color:var(--danger); padding:10px 14px; border-radius:8px; margin:8px 0; }
    </style>
</head>
<body>
<main class="container">
    <header class="header">
        <h1>Wallpapers</h1>
        @if ($remaining !== null)
            <span class="quota" title="From the last uncached API response">{{ $remaining }} API requests left today</span>
        @endif
    </header>

    <nav class="chips" aria-label="Categories">
        <a href="{{ route('wallpapers.index') }}" class="chip {{ $categoryId === null ? 'active' : '' }}">All</a>
        @foreach ($categories as $category)
            <a href="{{ route('wallpapers.index', ['category' => $category['id']]) }}"
               class="chip {{ $categoryId === (int) $category['id'] ? 'active' : '' }}">
                {{ $category['name'] }} <small>({{ $category['wallpaper_count'] }})</small>
            </a>
        @endforeach
    </nav>

    @if ($error)
        <div class="error" role="alert">{{ $error }}</div>
    @endif

    <section class="grid">
        @foreach ($wallpapers as $wallpaper)
            {{-- Opens the full-size image in a new tab. --}}
            <a class="card" href="{{ $wallpaper['image_url'] }}" target="_blank" rel="noopener noreferrer">
                <img src="{{ $wallpaper['thumbnail_url'] ?? $wallpaper['image_url'] }}"
                     alt="{{ implode(', ', $wallpaper['tags'] ?? []) ?: 'Wallpaper '.$wallpaper['id'] }}"
                     loading="lazy">
            </a>
        @endforeach
    </section>

    @if (! $error && count($wallpapers) === 0)
        <p class="muted">No wallpapers found.</p>
    @endif

    @if ($lastPage > 1)
        @php($query = array_filter(['category' => $categoryId]))
        <nav class="pager" aria-label="Pagination">
            <a class="button {{ $currentPage <= 1 ? 'disabled' : '' }}"
               href="{{ route('wallpapers.index', $query + ['page' => max(1, $currentPage - 1)]) }}">&larr; Previous</a>
            <span class="muted">Page {{ $currentPage }} of {{ $lastPage }} ({{ number_format($total) }} wallpapers)</span>
            <a class="button {{ $currentPage >= $lastPage ? 'disabled' : '' }}"
               href="{{ route('wallpapers.index', $query + ['page' => min($lastPage, $currentPage + 1)]) }}">Next &rarr;</a>
        </nav>
    @endif
</main>
</body>
</html>
