# Source architecture v2 — spec

Status: revised after API + architecture review · 2026-10-19

## 1. Goals

1. **Correctness first.** A novel's chapter list must never be clipped, stale, or
   reordered by cache state. Reading progress must survive chapter-list growth.
2. **Site compatibility from proven code.** Port the parsing logic of LNReader's
   MIT-licensed plugins instead of hand-rolling selectors. LNReader is the closest
   ecosystem (React Native + TypeScript + Hermes, 175 English sources).
3. **No runtime plugin system.** Remove the hidden-WebView JS extension runtime. All
   sources are built-in, pure, unit-tested TypeScript modules. The WebView stays only
   as the transport escape hatch for Cloudflare ("thin browser"), not as a code runner.
4. **Uniform source contract.** One interface for every source (novels, fanfic,
   Literotica). Browse, search, detail, chapters, reader, downloads, updates all consume
   the same shapes.
5. **Observable failures.** Every source error maps to a typed error the UI can act on
   (retry, open browser, change source, report site). No dead-end spinners.

Non-goals for this wave: user-installed third-party plugin repos, source auto-updates
from a registry, a declarative rule language, iOS/web.

## 2. Licensing and attribution

- LNReader app and plugins are **MIT, © 2021 Rajarshee Chatterjee**.
- Every ported file starts with:

  ```ts
  // Ported from LNReader (https://github.com/LNReader/lnreader-plugins),
  // MIT License, Copyright (c) 2021 Rajarshee Chatterjee.
  // Modifications: transport, validation and domain adapters for Master Reader.
  ```

- Add `THIRD_PARTY_NOTICES.md` at repo root listing LNReader + license text, and add
  the same notice to the in-app About/licenses screen.
- Do not copy LNReader branding, icons, or bundled site favicons. Source icons are
  either locally drawn glyphs, remote site favicons fetched at runtime, or absent.
- Keep the "unofficial / not affiliated" disclaimer and the age gate.
- **Never port GPL/MPL code.** Shosetsu, Kotatsu, Legado, NovelDokusha and
  IReader-extensions are GPL/MPL. Only LNReader (MIT) source code is ported. Mihon /
  Keiyoushi are Apache-2.0: borrow _transport patterns_ (CF interceptor, trust model)
  by reimplementation with attribution, not verbatim code.

## 3. Architecture

```
UI (screens/stores)
  │
services/catalog.ts ─── services/chapters.ts ─── services/updates.ts
  │                                              services/downloads.ts
  ▼
sources/registry.ts ──> sources/<id>/index.ts  (NovelSource, pure parse + transport calls)
  │                         │
  │                         └── sources/transport (cache, cookies, retry, rate limit,
  │                              CF single-flight solver, typed errors)
  │                              └── services/browser-fetch.ts (hidden WebView, CF bypass)
  ▼
db/repositories/* (SQLite is the source of truth for library, chapters, progress)
```

Rules:

- `src/sources/**` must not import `@/db/*` (Vitest can't load the SQLite native
  module). Sources return plain objects; `services/catalog.ts` persists them.
- A source receives exactly one capability object at creation:
  `{ http, browser }` (`SourceDeps`). It never touches the DB, filesystem, settings
  store or UI. User settings arrive through the declared `settings` + `configure()`.
- A `services/source-runtime.ts` factory builds those capabilities per source with the
  source's transport policy (concurrency, interval, cache TTLs, browser mode, health
  recorder). Sources never construct an `HttpClient` themselves. The browser loader
  moves from `src/sources/browser-loader.ts` to the service layer; an import-boundary
  lint/test forbids `src/sources/**` from importing `@/services/*` or `@/db/*`.
- Parsers are pure `(payload, baseUrl) => domain` functions with zod validation on JSON
  and defensive selectors on HTML; each has a fixture test.
- The transport is cache-agnostic (existing `ResponseCacheStore` seam) and owns UA,
  cookies, retries, per-host rate limits, the Cloudflare solver and typed errors.
- A source declares `browser: 'never' | 'on-challenge' | 'always'`. The transport is the
  authority on challenge detection; the flag is a hint (RoyalRoad today is `always`).
- Parsing library: cheerio **1.0.0-rc.12** (the exact version LNReader bundles on
  Hermes) for cheerio-based ports; `htmlparser2` v12 for the RoyalRoad state machine.
  A spike task validates both on device before P1 ports land.

## 4. The source contract

Named `NovelSource` (`src/sources/types.ts`). Shapes deliberately mirror LNReader's
`Plugin.PluginBase` so ports stay mechanical **except for the documented adapters in
§7**.

### 4.1 Identity

- Every novel and chapter has an opaque, URL-safe, provider-stable `id`.
- **`id` is the persisted identity.** Never a URL: provider paths contain `/` and `?`,
  break Expo Router segments, and change when a site changes domains.
- The source owns URL construction from ids (`resolveUrl`).
- Ports must **preserve existing ids** for `novelfire` (slug, e.g. `shadow-slave`),
  `royalroad` (numeric, e.g. `21220`) and `literotica`. They already match the stable
  tail of the upstream path. Chapter ids for those sources keep their current scheme
  (NovelFire: chapter number string; RoyalRoad: numeric chapter id) so existing
  downloads and progress keep resolving.
- If a source cannot reconstruct a URL from a short id, the port may encode the provider
  path into the id (URL-safe base64) — still opaque to the app.
- A future `story_aliases` / `chapter_aliases` table handles provider URL-scheme changes;
  v1 does not need it because the ports preserve legacy ids.

### 4.2 Types

```ts
export type SourceCapability =
  'popular' | 'latest' | 'search' | 'filters' | 'chapter-pages' | 'volumes' | 'adult';

export type SourceInfo = {
  id: string;
  name: string;
  lang: string;
  baseUrl: string;
  capabilities: readonly SourceCapability[];
  /** Upstream/source revision for provenance and filter migrations. */
  version: string;
  contractVersion: 1;
  adult?: boolean;
};

export type NovelStatus = 'ongoing' | 'completed' | 'hiatus' | 'cancelled' | 'licensed' | 'unknown';

/** Item returned by popular/latest/search listings. */
export type NovelSummary = {
  id: string;
  title: string;
  coverUrl?: string | null;
  author?: string | null;
  description?: string | null;
  tags?: string[];
  lang?: string | null;
  /** Rating out of 5. */
  rating?: number | null;
  chapterCount?: number | null;
  status?: NovelStatus | null;
  /** unix seconds */
  updatedAt?: number | null;
};

export type NovelDetails = NovelSummary & {
  wordCount?: number | null;
  /** Provider extras the UI may show (e.g. views, votes). */
  stats?: Record<string, string | number> | null;
  /** First chapter-list page. May be empty with a non-null nextPage. */
  chapterList: ChapterListPage;
};

export type ChapterSummary = {
  id: string;
  title: string;
  number?: number | null;
  /** ISO-ish date; parsed tolerantly to unix seconds by the catalog. */
  releasedAt?: string | null;
  /** Volume/group title when the source exposes volumes (LNReader `chapter.page`). */
  volume?: string | null;
  volumeIndex?: number | null;
};

export type ChapterListPage = {
  chapters: ChapterSummary[];
  /**
   * Opaque cursor for the next chapter-list page.
   * `null` **only** when the provider explicitly signalled the end.
   * An empty page with a non-null cursor is a SourceParseError, never "done".
   */
  nextPage: string | null;
  /** Provider hint; never the sole termination condition. */
  totalPages?: number | null;
};

export type ListingPage<T> = {
  items: T[];
  hasNext: boolean;
  nextPage?: number | null;
  total?: number | null;
};

export type ListingRequest = {
  /** 1-based, validated positive integer. */
  page: number;
  latest?: boolean;
  filters?: FilterValues;
};

export type ChapterContent = {
  /** Provider-derived HTML; sanitized centrally by the app. */
  html: string;
  /** Base URL for resolving relative images/links. */
  baseUrl: string;
  title?: string;
  wordCount?: number;
};

export type BrowserMode = 'never' | 'on-challenge' | 'always';

export type SourceRequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  browser?: BrowserMode;
};

export type ImageRequest = { headers?: Record<string, string> };

export type SourceSetting =
  | { key: string; type: 'switch'; label: string; default: boolean }
  | {
      key: string;
      type: 'picker';
      label: string;
      default: string;
      options: readonly FilterOption[];
    }
  | { key: string; type: 'text'; label: string; default: string };

export type SourceSettings = Readonly<Record<string, string | boolean>>;

export type SourceDeps = {
  http: import('./transport/http').HttpClient;
  browser: import('./browser-loader').BrowserLoader;
};

export interface NovelSource {
  readonly info: SourceInfo;
  readonly browser?: BrowserMode;
  readonly settings?: readonly SourceSetting[];

  /** Popular or latest listing. Unsupported modes throw SourceUnsupportedError. */
  getListing(
    request: ListingRequest,
    options?: SourceRequestOptions,
  ): Promise<ListingPage<NovelSummary>>;

  /** LNReader has no search filters; do not invent them. */
  search(
    query: string,
    page: number,
    options?: SourceRequestOptions,
  ): Promise<ListingPage<NovelSummary>>;

  /** Metadata + first chapter-list page. Starts at chapter 1. */
  getNovel(id: string, options?: SourceRequestOptions): Promise<NovelDetails>;

  /**
   * Cheap update probe used by background checks. When implemented, the update
   * service calls this first and only runs a full sync when the count/date changed.
   */
  getNovelStatus?(
    id: string,
    options?: SourceRequestOptions,
  ): Promise<{
    chapterCount?: number | null;
    updatedAt?: number | null;
    status?: NovelStatus | null;
  }>;

  /** Required when getNovel can return a non-null nextPage. */
  getChapterPage?(
    id: string,
    cursor: string,
    options?: SourceRequestOptions,
  ): Promise<ChapterListPage>;

  /** Chapter body. Fetches by (novelId, chapterId); sources own URL construction. */
  getChapter(
    novelId: string,
    chapterId: string,
    options?: SourceRequestOptions,
  ): Promise<ChapterContent>;

  getFilters?(): SourceFilters;

  /** Called at creation and whenever settings change; may invalidate caches. */
  configure?(values: SourceSettings): void;

  /** Absolute URL for "open on web" / share. */
  resolveUrl(
    target:
      { kind: 'novel'; novelId: string } | { kind: 'chapter'; novelId: string; chapterId: string },
  ): string;

  /** Per-URL headers for covers/chapter images (referer, cookies). */
  imageRequest?(url: string, ctx: { novelId?: string; chapterId?: string }): ImageRequest;
}
```

### 4.3 Contract notes

- **Chapter pagination is not volume grouping.** LNReader's `chapter.page` means a
  volume title in volume-mode sources; separate `ChapterListPage.nextPage` carries list
  pagination. Ports map `parseNovel` → `getNovel` and `parsePage` → `getChapterPage`.
- **Page 1 always exists.** If `getNovel` cannot return chapter page 1, it returns
  `chapterList: { chapters: [], nextPage: '1' }`. Sync starts at `nextPage`, not at 2.
- **Listings**: `hasNext` must be computed from the provider page, not from "array is
  non-empty". A repeated page is a parse error, not more results.
- **Empty chapter content** is `SourceParseError`, never `''`.
- **`getNovel` throws `SourceNotFoundError`**; it never returns `null`.
- **Cancellation** rethrows as `SourceCancelledError`; never swallow `AbortError`.
- **Offline** is a transport/catalog condition, not a source condition. Sources have no
  cache and no offline branch.
- **Multi-page chapter content** (rare) is concatenated by the source's `getChapter`;
  the contract has no content-page cursor in v1.

## 5. Filters

Adopt LNReader's declarative model verbatim (same type strings, so ports keep their
definitions):

```ts
export type FilterOption = { label: string; value: string; labelKey?: string };

export type SourceFilters = Record<string, Filter>;

export type Filter =
  | { type: 'Text'; label: string; value: string; labelKey?: string }
  | {
      type: 'Picker';
      label: string;
      value: string;
      options: readonly FilterOption[];
      labelKey?: string;
    }
  | {
      type: 'Checkbox';
      label: string;
      value: string[];
      options: readonly FilterOption[];
      labelKey?: string;
    }
  | { type: 'Switch'; label: string; value: boolean; labelKey?: string }
  | {
      type: 'XCheckbox';
      label: string;
      value: { include?: string[]; exclude?: string[] };
      options: readonly FilterOption[];
      labelKey?: string;
    };

export type FilterValue<F> = F extends { type: 'Text' | 'Picker' }
  ? string
  : F extends { type: 'Switch' }
    ? boolean
    : F extends { type: 'Checkbox' }
      ? string[]
      : F extends { type: 'XCheckbox' }
        ? { include?: string[]; exclude?: string[] }
        : never;

export type FilterValues<F extends SourceFilters = SourceFilters> = {
  [K in keyof F]: FilterValue<F[K]>;
};
```

- `getFilters()` returns fresh defaults (cloned); the catalog persists values per source
  in the settings store.
- A pure `resolveFilterValues(defaults, stored)` merges values, drops unknown keys,
  type-checks each value and normalizes XCheckbox arrays. Sources never see stale keys.
- Filters apply to **listings only**; `search` takes no filters (matching LNReader).
- Source labels are provider data, not app chrome: `labelKey` (e.g.
  `sources.royalroad.filters.genres`) localizes the app-owned ones; otherwise the
  provider label renders as-is.

## 6. Curated source set

"Family" = one template + per-site config and fixtures. "Adapters" in §7 are expected
for every port; "mechanical" here means the selectors and flow transfer directly.

| Priority | Source id         | Site                | Origin               | Difficulty | Notes                                                                                                                   |
| -------- | ----------------- | ------------------- | -------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| P0       | `novelfire`       | novelfire.net       | LNReader multisrc    | Medium     | DataTables AJAX; request a large `length` first, fall back to 100/page with 5-page chunks + 3.5 s backoff; CF sometimes |
| P0       | `royalroad`       | royalroad.com       | LNReader english     | Low        | inline `window.chapters` JSON; `#chapter-content`; volume mode off by default                                           |
| P0       | `scribblehub`     | scribblehub.com     | LNReader english     | Low        | clean HTML; rich filters                                                                                                |
| P0       | `novelbuddy`      | novelbuddy.me       | LNReader english     | Low        | clean JSON API; best JSON template                                                                                      |
| P1       | `novelbin`        | novelbin.com        | readnovelfull family | Low        | one template also covers NovelFull/FreeWebNovel                                                                         |
| P1       | `novelfull`       | novelfull.com       | readnovelfull family | Low        | same template                                                                                                           |
| P1       | `freewebnovel`    | freewebnovel.com    | readnovelfull family | Low        | image referer; anti-scramble needs a pure TS rewrite                                                                    |
| P1       | `lightnovelworld` | lightnovelworld.org | LNReader english     | Low/Med    | verify current host; domain churn                                                                                       |
| P2       | `archiveofourown` | archiveofourown.org | LNReader english     | Medium     | adult-content gating; huge catalogue                                                                                    |
| P2       | `mtlnovel`        | mtlnovels.com       | LNReader multisrc    | Low/Med    | machine translation aggregator                                                                                          |
| P2       | `wuxiaworld`      | wuxiaworld.com      | LNReader english     | High       | protobuf + JSON API; defer                                                                                              |
| —        | `literotica`      | literotica.com      | existing             | —          | keep as legacy; adapter to the new contract                                                                             |
| —        | `novelupdates`    | novelupdates.com    | LNReader english     | —          | directory, not a reader — skip                                                                                          |

P0 = required for the first device build. P1 = same wave if parsers land green.
P2 = follow-up wave. WTR-LAB (AES-GCM, 2.2k lines) is explicitly out of scope.

Each ported source ships with: `index.ts` (class + factory), `parsers.ts` (pure),
`schemas.ts` (zod for JSON), `fixtures/*` (recorded payloads), `parsers.test.ts`,
`source.test.ts`, and an entry in `sources/registry.ts`.

## 7. Porting recipe (from LNReader)

Ports are **adapters, not copy-paste**. Expect per-source code for the items below.

1. Copy the upstream plugin to `src/sources/<id>/upstream.ts` for provenance (not
   compiled).
2. Replace `@libs/fetch` with `deps.http`; pass UA/Referer explicitly where the plugin
   sets `imageRequestInit`.
3. Replace `@libs/filterInputs`/`@libs/novelStatus` with local types/constants.
4. **NovelFire bug**: upstream imports `defaultCover` from `@/types/constants`, which
   fails at runtime. Use the app's `DEFAULT_COVER`.
5. Extract selectors into pure parse functions; validate JSON with zod; record fixtures
   with a dev script.
6. `parseNovel` → `getNovel`, `parsePage` → `getChapterPage`, `parseChapter` →
   `getChapter` (return `{ html, baseUrl }`), `popularNovels` → `getListing`.
7. Map ids: preserve legacy ids for P0 sources (see §4.1); make upstream paths opaque
   inside the port.
8. Rewrite stateful upstream fields (`novelList`, `draw`, `lastPage`, `lastSearch`) as
   stateless logic or per-instance request state that cannot leak across pages. The
   catalog dedupes by id; sources must compute `hasNext` from the provider.
9. Rewrite `storage`/`pluginSettings` as `SourceSetting` + `configure`.
10. Rewrite `customJS`/anti-scramble snippets as pure TypeScript HTML transforms.
11. Tests must not hit the network. Fixtures are committed.
12. Upstream reference sources live under `docs/upstream/<id>.txt` (not `.ts`), so
    `tsc` never sees LNReader imports. Only the ported, adapted code is compiled.

### Sanitisation

Chapter HTML is untrusted. Sanitize **centrally at ingestion** in
`src/sources/sanitize.ts` before it is stored:

- allowlist tags: `p, br, hr, h1–h6, em, strong, i, b, u, s, blockquote, ul, ol, li,
a, img, figure, figcaption, sup, sub, span, div, table, thead, tbody, tr, td, th, pre,
code`;
- allowlist attributes: `href` (http/https only), `src` (http/https/data:image only),
  `alt`, `title`, `colspan`, `rowspan`;
- strip `script, style, iframe, object, embed, form, input, button, video, audio,
source, link, meta, svg, math` and all `on*` attributes;
- resolve relative `href`/`src` against `ChapterContent.baseUrl`;
- external links open in the system browser (never in-app navigation);
- images are fetched through `imageRequest()` headers, never a raw WebView;
- malicious fixtures (script tags, `javascript:` URLs, event handlers, huge nesting)
  are part of the sanitizer tests.

Keeping the sanitizer pure and source-agnostic means every port benefits and the reader
can assume a safe block tree.

### Gotchas carried over

| Gotcha                              | Handling                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `chapter.page` = volume title       | map to `ChapterSummary.volume`; never a cursor                             |
| RoyalRoad volume mode               | setting `enableVol`; order by provider order, then volumeIndex             |
| NovelFire 429 + "rate limited" HTML | transport backoff + per-source concurrency 1                               |
| NovelFire DataTables `length`       | try a large length (1000–5000); fall back to 100/page                      |
| Cloudflare challenge                | `browser: 'on-challenge'`/`'always'` → BrowserHost; typed error on failure |
| `Buffer` absent                     | never port repo-side helpers; use `Uint8Array`/`TextDecoder`               |
| `new URL(relative, base)`           | add `react-native-url-polyfill/auto` at app entry                          |
| cheerio                             | `cheerio@1.0.0-rc.12`; spike before P1                                     |
| images needing Referer              | `imageRequest()` + `services/browser-fetch`; don't rely on WebView headers |

## 8. Chapter synchronisation (the "clipped at 25" fix)

New service `services/chapters.ts`:

```ts
export type SyncOptions = {
  force?: boolean;
  signal?: AbortSignal;
  /** Safety cap on chapter-list pages (default 500). */
  maxPages?: number;
  onProgress?: (progress: { cursor: string; fetched: number; totalPages?: number | null }) => void;
};

export type SyncResult = {
  inserted: number;
  updated: number;
  orphaned: number;
  pagesFetched: number;
  complete: boolean;
  truncated: boolean;
  error?: SourceError;
};

export function syncChapters(
  sourceId: string,
  novelId: string,
  options?: SyncOptions,
): Promise<SyncResult>;
```

Algorithm:

1. `getNovel(id)` → metadata + first `chapterList` page.
2. Follow `nextPage` with `getChapterPage` until it is `null` (cap `maxPages`).
   An empty page with a non-null cursor is a `SourceParseError`.
3. Deduplicate by chapter `id`, preserving first-occurrence order; reject empty ids.
4. Upsert metadata (`title`, `number`, `volume`, `volumeIndex`, `releasedAt`).
5. Insert missing chapters. **Never delete a chapter that has content.** Chapters absent
   from the provider list but present locally are marked `orphaned` and sort last.
6. If the provider order differs from stored `index`, run the reindex transaction (§9).
   Otherwise just update metadata in place.
7. Update `stories.chapter_count`, `stories.chapters_synced_at`, `stories.status`.
8. Reading progress is keyed by **chapter id**, so renumbering never moves the bookmark.

Triggers: opening a novel, opening the chapter list (if older than 1 h or the provider
count changed), pull-to-refresh on Library/Updates, background update task, and an
explicit "Refresh chapters" action. Offline: return cached chapters with `stale: true`;
never clear.

`getStoryPages`-style cache-first short-circuits are removed: the source list is always
revalidated when online, and the UI renders cached data while the refresh is in flight.

**Progressive sync**: for NovelFire (3k+ chapters), `getNovel` returns the full list via
the DataTables endpoint when possible. If the endpoint caps `length`, sync emits progress
and the chapter screen renders pages as they arrive; the toolbar shows
"Loading chapters… 1,200 / 3,204" instead of blocking.

## 9. Persistence

The persistence design lives in `DATA.md`. In short:

- a new `chapters` table keyed by `(source_id, novel_id, id)` with a separate `position`
  column and content in the same row;
- metadata and content are written through different repository methods, so a sync can
  never erase downloaded content;
- `pages` remains only as the one-time migrator's source, never read by new code;
- progress/history/narration gain `chapter_id`; per-chapter download state and
  `story_updates` are added;
- the upgrade is an idempotent, transactional app-level migration tested with a legacy
  SQL fixture.

## 10. Transport behaviour

- Per-source concurrency cap (default 4; NovelFire 1) and min interval (default 250 ms).
  The timeout starts **after** a queue slot is acquired.
- Responses and `HttpError` expose **status and headers**; the CF detector needs
  `cf-mitigated`/`Server`, and rate limiting needs `Retry-After`.
- Retry matrix: 429 → exponential backoff (3 attempts) honouring `Retry-After`
  (seconds or RFC-1123), 5xx → 2 retries, CF challenge → one browser attempt, then
  `SourceNeedsBrowserError`.
- **Cloudflare solver** (patterns from Mihon/Kotatsu, reimplemented):
  - detect `cf-mitigated: challenge`, else `403/503` + `Server: cloudflare*`;
  - per-host single-flight lock so N tapped chapters trigger one challenge at a time;
  - open the URL in `BrowserHost`, wait for `cf_clearance`, accept only a **changed**
    cookie value, 30 s timeout;
  - **cookie handoff**: `BrowserHost` alone cannot hand cookies back. Either
    (a) add a small native `CookieManager` bridge module exposing `getCookie(url)` /
    `flush()` (MIT, same pattern as `modules/sherpa-tts`), or
    (b) route every request for that host through `BrowserHost` while the challenge
    state is unresolved. Implement (a); keep (b) as the fallback.
  - align the WebView user agent with the `HttpClient` UA; a mismatch makes
    `cf_clearance` unreliable;
  - interactive Turnstile (no automatic pass) opens a **visible** verification screen
    with the real site, then reads cookies and retries;
  - on failure clear the host cookies and raise `SourceNeedsBrowserError` with the URL.
- Cookie jar keyed by `(domain, path, name)`, not by name alone, so two hosts cannot
  overwrite each other. Shared with BrowserHost.
- Cache policy is per request: listings 5 min, novel metadata 1 h, chapter content
  immutable while present, images 7 days. Offline serves cached and marks stale.
- Connectivity: combine the user's offline toggle with real network state
  (`expo-network`); do not claim "offline" solely from a setting, nor hit the network
  while the toggle is on.
- User agent: a stable Android UA; never pretend to be a browser build the site blocks.

### Source health and observability

Every fetch records, per source and operation: `lastOkAt`, `lastErrorAt`,
`lastErrorKind`, `failCount`, `latencyMs` (p50). Stored in a `source_health` table
(source id + operation primary key) so it survives restarts. Used to:

- show a quiet "Source is having trouble" badge on Browse/source manager after 3
  consecutive parse failures (still usable; never auto-disabled without telling the user);
- surface the last error in source details with a "Report" action that copies the
  source id + URL + error kind (no content);
- drive the "needs update" chip when `SourceParseError` repeats.

Logging: dev-only verbose; release logs error kind + source id only (no URLs with
credentials, no chapter content).

## 11. Error taxonomy

```ts
export type SourceOperation = 'listing' | 'search' | 'novel' | 'chapter-list' | 'chapter-content';

export class SourceError extends Error {
  sourceId: string;
  operation: SourceOperation;
  url?: string;
  retryAfterMs?: number;
  cause?: unknown;
}
export class SourceOfflineError extends SourceError {}
export class SourceNotFoundError extends SourceError {}
export class SourceRateLimitedError extends SourceError {}
export class SourceNeedsBrowserError extends SourceError {
  reason: 'cloudflare' | 'js' | 'auth';
}
export class SourceParseError extends SourceError {
  fixtureHash?: string;
}
export class SourceCancelledError extends SourceError {}
export class SourceUnsupportedError extends SourceError {}
```

| Error                     | Cause                      | UI                                                          |
| ------------------------- | -------------------------- | ----------------------------------------------------------- |
| `SourceOfflineError`      | no network, no cache       | inline offline state + retry                                |
| `SourceRateLimitedError`  | 429                        | "Slow down — retrying in Ns" (`retryAfterMs`) + queue pause |
| `SourceNeedsBrowserError` | CF/JS challenge not solved | "Open site to verify" action → BrowserHost; retry           |
| `SourceNotFoundError`     | novel/chapter removed      | "No longer available" + back                                |
| `SourceParseError`        | selector drift             | "Source needs an update" + report action; log fixture hash  |
| `SourceCancelledError`    | user left / aborted        | silent; no toast                                            |
| `SourceUnsupportedError`  | mode not offered           | hide the affordance (bug if surfaced)                       |

Transport owns HTTP retries; sources own only body-level detection (a 200 "rate
limited" page) and must not retry parse failures.

## 12. Acceptance criteria

- [ ] Opening NovelFire → Shadow Slave shows the full chapter count (3,000+) and the
      correct chapter titles; cached 25-chapter data no longer clips the list.
- [ ] Reading progress survives a chapter sync that inserts chapters before the current
      position (bookmark stays on the same chapter id).
- [ ] Downloading chapter N, then syncing, keeps chapter N downloaded.
- [ ] Existing library entries and downloads from the current build still resolve after
      the source migration (legacy ids preserved).
- [ ] RoyalRoad Mother of Learning shows the full chapter list; volume grouping appears
      when the source exposes volumes.
- [ ] Search on each P0 source returns results; empty results end pagination without
      error; a repeated page raises `SourceParseError`.
- [ ] Cloudflare challenge on a browser-mode source resolves on device and the chapter
      loads.
- [ ] `npm run verify` green; each source has fixture tests; no source imports `@/db/*`.
- [ ] `src/extensions/*` deleted; `ExtensionHost` gone; no hidden WebView at startup
      other than `BrowserHost` mounted lazily on first need.

## 13. Explicitly out of scope (future waves)

- **Declarative rule sources** (a small CSS/JSON/regex/template engine). Valuable for
  long-tail sites and user-importable rules, but a separate project; do not clone
  Legado's selector language.
- **Runtime plugin installs** (LNReader-compatible subset in a WebView bridge with trust
  prompts, hash pinning and a kill switch).
- Source auto-update from a registry.
- Login/account sources (Webnovel, WuxiaWorld) and protobuf/AES sources (WTR-LAB).
