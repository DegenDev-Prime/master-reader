# Master Reader — rebuild overview

Status: adopted after specialist review · 2026-10-19

## 1. Why we are rebuilding

The app currently scores ~3/10 by the owner's assessment. Specific complaints:

- **Novels are not fetched or displayed correctly** (chapter lists clipped at 25 by stale
  cache; counts wrong; source drift).
- **The UI is Literotica-focused** — the domain and screens were built around
  single-page stories and series; novels with thousands of chapters were bolted on.
- **Screens and features feel forced and janky** and do not integrate with Android's
  device flows (back, share, notifications, background work).
- **The plugin system** (hidden-WebView JS extensions) is discarded.

The rebuild starts from the user's mental model — _a shelf of novels, each with chapters,
read offline_ — not from the original source's data model.

## 2. Product definition

Master Reader is a **novel-first, multi-source, offline reader with on-device narration**.

- Sources: RoyalRoad, NovelFire, ScribbleHub, NovelBuddy, NovelBin/NovelFull/FreeWebNovel,
  LightNovelWorld, AO3 — ported from LNReader's MIT parsers; Literotica retained.
- IA: five tabs — Library, Updates, Browse, Audio, More. History, Downloads, Sources and
  Settings are root routes under More (see `UX.md` §6.1).
- Library: shelf with continue-reading, progress, new-chapter updates.
- Reader: native rich text (paragraph blocks with inline emphasis), four themes,
  typography controls, chapter navigation, precise progress.
- Narration: on-device TTS (existing sherpa-onnx + system engines), paragraph highlight,
  tap-to-move, auto-advance, sleep timer.
- Offline: per-chapter downloads, download-ahead, auto-download new chapters, pinned
  downloads never evicted by cache sweeps.
- Platform: Android-only, Expo SDK 57 / RN 0.86 / Hermes, SQLite source of truth,
  FLOSS-only distribution, 18+.

## 3. Design principles

1. **Novel-first language.** Novel, chapter, volume, shelf, progress. "Story/page/series"
   survives only in persistence internals.
2. **One primary action per screen.** Continue reading on the shelf; Read/Listen on the
   novel page; Next chapter in the reader.
3. **Content over chrome.** Covers, titles and chapter text carry the UI. Hairlines and
   spacing do the separation; no shadows, no decoration.
4. **Calm, dark-first editorial skin.** Flat 0-radius surfaces, restrained accent,
   strong type hierarchy, generous margins. Light/sepia/black variants for reading.
5. **Native Android.** Edge-to-edge, correct system-back handling (predictive back stays
   off for 1.0), bottom sheets with drag handles, ripple feedback, haptics, share intents,
   notifications, background tasks.
6. **Offline honesty.** Cached data is shown immediately, labelled "offline"/"stale"
   where relevant; nothing silently breaks.
7. **No dead ends.** Every error has an action: retry, open browser, change source,
   report.
8. **Fast starts.** No hidden WebViews or network work at boot; lazy-mount the browser
   host; cached screens paint first.

## 4. Success metrics (practical)

| Dimension          | 3/10 today                                                                | 9/10 target                                                                                        |
| ------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Design flow        | Literotica vocabulary; button soup; unclear hierarchy                     | Novel-first IA; one primary action per screen; consistent components; native motion                |
| Site compatibility | NovelFire/RR partially working; chapter lists clipped; extensions stale   | 7+ curated sources with fixture-tested parsers; full chapter sync; typed source errors; CF solver  |
| Support            | Errors are dead ends; no health signal                                    | Typed errors with recovery actions; source health badges; refresh/report; docs                     |
| Reading experience | Plain-text paragraphs; cramped chrome; jump validated against stale count | Rich text blocks; typography sheet; chapter navigation; precise progress; TTS sync; download-ahead |

Acceptance is behavioural, not cosmetic: the flows in `UX.md` work on device against real
sites, offline and online, with no clipping and no crashes.

## 5. What survives vs what is rebuilt

**Survives (reused or adapted):**

- SQLite + Drizzle persistence, repositories, backup/restore, EPUB export.
- HTTP transport with response cache, cookies, retry/backoff (extended per `SOURCES.md`).
- `BrowserHost` thin browser (Cloudflare) — now the only WebView, lazily mounted.
- Narration engine (sherpa-onnx + expo-speech), pronunciation rules, player plumbing.
- Library update background task, i18n infrastructure, theme infrastructure.
- Age gate, disclaimers, FLOSS constraints.

**Rebuilt:**

- Source layer: new `NovelSource` contract; LNReader ports; chapter sync; domain types
  `Novel`/`Chapter`. Old `Source`, `SearchFilters`, series plumbing removed.
- Navigation and every screen (`src/app/**`) against the new IA.
- Reader UI and content rendering (HTML → blocks), progress keyed by chapter id.
- Design system: tokens, typography scale, component set (keep 0-radius flat skin).
- Download manager UI and queue semantics (per-chapter, resumable, download-ahead).

**Deleted:**

- `src/extensions/**`, `ExtensionHost`, extensions store/table/screens.
- Literotica-specific browse/search filter UI and copy.
- `DESIGN.md`'s current screen prescriptions (kept only as historical reference; this
  spec set supersedes it).
- Old story/series screens and the "pages" vocabulary in UI code.

## 6. Hard constraints (unchanged)

- Expo SDK 57, React Native 0.86, React 19, TypeScript strict, expo-router.
- Android only. Offline-first. SQLite is the source of truth.
- FLOSS only: no Play Services/Firebase/Crashlytics/analytics/ads; no bundled
  credentials or trademarks; 18+ gate; "unofficial / not affiliated" disclaimer.
- `npm run verify` green before finishing any task.
- No comments unless they explain non-obvious intent.
- User-facing strings only via `src/i18n/en.json`.
- Colours only via the theme; never hard-coded hex.
- Nothing is committed until the owner asks.
