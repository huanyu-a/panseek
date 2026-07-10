# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PanSeek is a Nuxt 4 web application that aggregates search results from Telegram channels and external plugin sites to find cloud storage resources (Aliyun, Quark, Baidu, 115, Xunlei, etc.). It supports priority-based batch processing, unified LRU caching with namespaces, SQLite hot search persistence (with memory fallback), and deploys to Cloudflare Workers (default), Vercel, or Docker.

## Package Manager

`npm` (lockfile: `package-lock.json`). Always use `npm install`. NOTE: The README.md and AGENTS.md reference `pnpm`, but those are stale — the actual lockfile and build scripts use `npm`.

## Development Commands

```bash
npm dev                  # Start dev server (port 4000)
npm build                # Production build
npm preview              # Preview production build
npm test                 # Run all unit tests (Vitest)
npm test:watch           # Tests in watch mode
npm test:coverage        # Coverage reports (V8)
npm test:api             # API integration tests (node ./test/api.test.mjs)
vitest run test/unit/memoryCache.test.ts   # Run a single test file
vitest run -t "test name pattern"          # Run tests matching a name
npm deploy:cf            # Deploy to Cloudflare Workers
```

There is **no lint or format tool configured** (no ESLint/Prettier/Biome config exists). Follow existing code style instead.

## Architecture

### Search Flow (Two-Tier)

1. **Client** (`composables/useSearch.ts`): Manages search state machine (loading → deepLoading → done), batching, pause/continue, fast/deep phases. Calls `/api/search` and `/api/search.post`.
2. **Server** (`server/core/services/searchService.ts`): Orchestrates concurrent searches across TG channels and plugins with priority batching, caching, timeout control, and plugin health checking.

**Fast Search**: First batch of priority TG channels + plugins returns immediately.  
**Deep Search**: Remaining channels/plugins continue loading in batches.

### Scoring & Ranking

The search scoring system is a direct translation of `pansou/service/search_service.go` (Go). Each result gets a composite score:

- **Time score**: 500 (≤1 day) → 20 (>1 year), decay by age
- **Keyword score**: bonus for priority keywords ("合集", "系列", "全", etc.)
- **Plugin score**: based on plugin priority level — priority 1 = +1000, 2 = +500, 3 = 0, 4 = -200

Results are sorted by total score descending. Plugin priorities range 1–5 (default 3).

### Server Core (`server/core/`)

- **`services/searchService.ts`**: Main orchestrator. Translates Go scoring, merging, filtering, and cache key generation.
- **`services/index.ts`**: Singleton factory for SearchService via `getOrCreateSearchService()`. Caches the instance on `globalThis` under `__panseek_search_service__` so all requests share one service + plugin registry + cache. **Do not instantiate SearchService directly in API routes** — always use the factory. Contains the authoritative dead-plugin removal log (8 dead plugins removed 2026-07-06).
- **`services/tg.ts`**: Telegram channel post fetching with Cheerio HTML parsing.
- **`services/checkService.ts`**: Link validity checking (ok/bad/locked/uncertain) — also a Go translation (`check_service.go`). Exposed via `/api/check/links.post.ts`.
- **`services/hotSearchService.ts`** + **`hotSearchStore.ts`** / **`sqliteHotSearchStore.ts`** / **`memoryHotSearchStore.ts`**: Hot search persistence with adapter pattern. `HotSearchService` tries SQLite first, falls back to memory. SQLite uses `sql.js` (WASM, no native编译). Hot search normalizes terms (full-width → half-width, strips URLs, blocks forbidden patterns) and enforces 7-day window + 30-entry cap.
- **`services/doubanHotService.ts`**: Douban hot list fetching (24h cache per category).
- **`cache/unifiedCache.ts`**: Namespaced cache wrapper around `MemoryCache`. Namespaces: `TG_SEARCH`, `PLUGIN_SEARCH`, `HOT_SEARCH`. Cache keys: `tg:${keyword}:${channels}`, `plugin:${keyword}:${plugins}`.
- **`cache/memoryCache.ts`**: LRU cache with TTL expiration and memory monitoring.
- **`plugins/manager.ts`**: Plugin registry. `BaseAsyncPlugin` is the base class; global registry via `registerGlobalPlugin()`.
- **`plugins/registerAllPlugins.ts`**: **The authoritative plugin list.** All plugins must be explicitly imported and registered here to avoid Rollup tree-shaking of side-effect imports. Dead plugins are commented out with reason tags (`// 端点死亡 (522)`, `// 端点死亡 (CF JS challenge)`, etc.) — follow this convention.
- **`plugins/*.ts`**: ~68 active search plugins (of ~82 implemented). Each extends `BaseAsyncPlugin`.
- **`plugins/pluginHealth.ts`**: Circuit breaker — tracks failure rates, auto-skips unhealthy plugins for 5 minutes (configurable).
- **`plugins/pluginUtils.ts`**: Shared helpers (`searchWithDetailPages`, `extractResultsFromJSON`, etc.) for building plugins. Use these when creating new plugins.
- **`utils/fetch.ts`**: `fetchWithRetry` — network wrapper with retry/timeout/abort (via `AbortSignal`).
- **`utils/regex.ts`**: All cloud-storage URL patterns and extraction logic — direct translation of `pansou/util/regex_util.go`. Includes `cutTitleByKeywords`, `getLinkType`, per-platform regex.
- **`utils/searchKeyword.ts`**: Keyword variant generation for deep search (CJK-aware splitting, noise-word filtering, bracket removal). `buildSearchKeywordVariants` returns up to 6 normalized variants.
- **`utils/errors.ts`**: Error classification and `ErrorCollector`.
- **`utils/logger.ts`**: Logging (per-module loggers via `createLogger`).
- **`types/models.ts`**: Core interfaces — `SearchResult`, `MergedLink`, `MergedLinks`, `SearchResponse`, `SearchRequest`, `FilterConfig`.
- **`types/check.ts`**: Check service types (`CheckItem`, `CheckResult`, `CheckResponse`).

### Plugin Interface

Plugins implement `AsyncSearchPlugin` (extend `BaseAsyncPlugin`):

```typescript
interface AsyncSearchPlugin {
  name(): string;
  priority(): number;          // 1–5, lower = faster/higher-quality
  search(keyword: string, ext?: Record<string, any>): Promise<SearchResult[]>;
  setMainCacheKey(key: string): void;      // optional override
  setCurrentKeyword(keyword: string): void; // optional override
  skipServiceFilter(): boolean;             // optional override, default false
}
```

New plugins should use helpers from `plugins/pluginUtils.ts`. There is also a codegen script `generate-plugins.cjs` that batch-generates plugin files from a list (used historically to scaffold 68 plugins).

### Auth & Security

- **`SEARCH_PASSWORD`** env var enables the password gate. When set, `/api/auth/status` returns `locked: true`, users must POST to `/api/auth/unlock`.
- **`server/utils/requireAuth.ts`**: Enforces the auth check on protected routes (search, hot-searches).
- **`server/utils/unlockRateLimiter.ts`**: Brute-force protection on unlock (5 failures → lockout).
- **`server/middleware/rateLimiter.ts`**: Per-IP rate limiting on API routes. `/api/search` = 10 req/min, `/api/hot-searches` = 30 req/min, default = 60 req/min. Health check and auth routes are exempt.
- **Image proxy** (`/api/img.get.ts`) has SSRF protection via URL whitelist.

### Client-Side

- **`app.vue`**: Single-page app with header, search box, results, hot searches, Douban section, settings drawer.
- **`composables/useSearch.ts`**: Search state machine (loading → deepLoading → done), with pause/resume. Maintains `searchSeq` for race condition handling, tracks `AbortController` instances.
- **`composables/useSettings.ts`**: User settings (enabled plugins, TG channels, cloud types, concurrency, timeout). Uses `STORAGE_KEYS` / `SETTINGS_VERSION` from config for localStorage namespacing and migration.
- **`composables/useAuth.ts`**: Password gate — calls `/api/auth/status` and `/api/auth/unlock`.
- **`composables/useWxAuth.ts`**: WeChat mini-program auth integration (`wx-auth-sdk`).
- **`composables/useSeoConfig.ts`**: Centralized SEO meta configuration.
- **`composables/useDarkMode.ts`**: Theme switching.
- **`composables/useToast.ts`**: Toast notifications.
- **`utils/extractMergedFromResponse.ts`** + **`utils/mergeMergedByType.ts`**: Client-side result merging helpers.
- **Components**: `SearchBox`, `ResultGroup`, `ResultHeader`, `PasswordGate`, `HotSearchSection`, `DoubanHotSection`, `SettingsDrawer`, `ErrorBoundary`.
- **`types/search.ts`**: Client-side type re-declarations (mirrors server `models.ts`).

### Configuration (`config/`)

- **`channels.json`**: TG channel lists (`priorityChannels`, `defaultChannels`), concurrency, timeouts, cache TTL. Loaded into `nuxt.config.ts` runtimeConfig.
- **`plugins.ts`**: Plugin names (`ALL_PLUGIN_NAMES`), cloud types (`CLOUD_TYPES`), platform info (`PLATFORM_INFO` with colors/icons), `DEFAULT_USER_SETTINGS`, `STORAGE_KEYS`, `SETTINGS_VERSION`. **Warning**: this list is shared by frontend, backend, and mini-program — changing names requires checking all three.
- **`doubanHot.ts`**: Douban API configuration.
- **`data/`**: SQLite database for hot search persistence (Docker/local only, not in git).

### Abort Signal Handling

API routes that call the search service must handle client disconnect. `search.get.ts` implements `getClientAbortSignal()` — it tries `event._signal` (h3 native) and falls back to listening on `event.node.req` `close` events. The signal is passed through to `fetchWithRetry` so actual HTTP requests are aborted when the client disconnects.

## API Routes (`server/api/`)

All routes use the `name.method.ts` convention (e.g., `search.get.ts`, `hot-searches.post.ts`).

Key routes: `search.get.ts`/`search.post.ts`, `hot-searches.get.ts`/`hot-searches.post.ts`, `auth/status.get.ts`/`auth/unlock.post.ts`, `douban-hot.get.ts`, `img.get.ts` (image proxy), `health.get.ts`, `plugin-health.get.ts`, `check/links.post.ts` (link validity), `hot-search-stats.get.ts`.

**Route rules** in `nuxt.config.ts` disable SWR/caching for ALL API routes (`{ swr: false, cache: false }`) — this is **critical** because search depends on cookie auth and hot-searches must reflect writes immediately. Do not re-enable caching on API routes. The `/**` catch-all enables SWR 3600 only for non-API assets.

There is also a `server/routes/sitemap.xml.get.ts` for SEO.

### `vercel.json`

Sets `Cache-Control: no-cache, no-store, must-revalidate` on all `/api/*` responses (belt-and-suspenders with routeRules).

## Deployment

- **Cloudflare Workers** (default): `wrangler.toml` with `nodejs_compat` flag. `npm deploy:cf` or `wrangler Deploy`. CF uses memory-only hot search (no SQLite), isolate-local cache.
- **Vercel**: Auto-detected via `VERCEL` env var. Sets `nitro.preset: "vercel"`, functions maxDuration 60s.
- **Docker**: `Dockerfile` uses `node:20-alpine`, multi-stage build, `NITRO_PRESET=node-server`, runs as non-root `node` user. Data dir `/app/data` for SQLite hot search persistence. CI builds push to GHCR and Docker Hub. `deploy/` folder has production docker-compose, nginx conf.
- **Nitro preset**: Defaults to `node-server`, overridable via `NITRO_PRESET` env var or `VERCEL` auto-detection.

## CI/CD (`.github/workflows/`)

- **`docker-image.yml`**: Builds and pushes Docker image on push to main/dev. Publishes to GHCR and Docker Hub (if secrets configured).
- **`sync-upstream.yml`**: Daily cron (03:00 UTC) merges from upstream `main` into fork's default branch.

## Testing

- Framework: Vitest with Node environment, globals enabled.
- Config: `vitest.config.ts` — includes `test/unit/**/*.test.ts`, alias `#internal` → `.nuxt`.
- Coverage: V8 provider, excludes `node_modules/`, `test/`, `*.d.ts`, config/index files.
- Run `npm test` before committing changes to `server/core/`.

## Conventions

- Vue composables: `use` prefix (`useSearch`, `useSettings`, `useAuth`).
- Server routes: `name.get.ts` / `name.post.ts` under `server/api/`.
- Unit tests: `test/unit/*.test.ts`.
- Code style: 2-space indent, semicolons, double quotes.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `refactor:`, `delete:`). Keep subjects short and imperative, one logical change per commit.

## Analytics

Baidu Tongji (百度统计) via client-only plugin `plugins/baidu-tongji.client.ts`. ID is stored in the `NUXT_PUBLIC_BAIDU_TONGJI_ID` env var and exposed through `runtimeConfig.public.baiduTongjiId` — never hardcoded in source. The plugin applies layered anti-scraping: env-var ID (not in repo), runtime URL assembly (no `hm.js?<FULL_ID>` literal in source), hostname whitelist (`panseek.bx9y.com.cn` only), and deferred injection via `requestIdleCallback`. Baidu's own server-side domain whitelist is a second layer of protection. Does not track SPA route changes — standard page-view stats only. Empty ID (default) = analytics disabled.

## Environment Variables

- `SEARCH_PASSWORD`: Optional password for search access. Empty = no password gate.
- `LOG_LEVEL`: Logging level (default: `info`).
- `NITRO_PRESET`: Deployment preset (auto-detect if unset).
- `PORT`: Server port (default: `4000`).
- `VERCEL`: Auto-detected for Vercel deployment.
- `NUXT_PUBLIC_BAIDU_TONGJI_ID`: Baidu Tongji tracking ID. `NUXT_PUBLIC_` prefix exposes it to the client at build time. Empty = disabled.

## Adding a New Plugin

1. Create `server/core/plugins/myplugin.ts` extending `BaseAsyncPlugin`, using helpers from `pluginUtils.ts`.
2. Import + register it in `server/core/plugins/registerAllPlugins.ts` (required — otherwise Rollup tree-shaking drops it).
3. Add its name to `ALL_PLUGIN_NAMES` in `config/plugins.ts`.
4. Set priority 1–5 (1 = fastest/highest-quality, 3 = default, 5 = slowest/torrent-class).

Dead plugins: comment out the registration line in `registerAllPlugins.ts` with a reason tag like `// 端点死亡 (502)` and optionally remove from `ALL_PLUGIN_NAMES`.
