# Rebuild plan — sources + UX, 3 → 9

Status: revised after architecture review · 2026-10-19

Companion docs: `00-OVERVIEW.md`, `SOURCES.md`, `DATA.md`, `UX.md`.

## 0. Ground rules

- Work happens in the existing tree; nothing is committed until the owner asks.
- Before the first destructive edit: snapshot to
  `/tmp/opencode/storyvault-pre-rebuild.tgz` (src, docs, config; no node_modules) and
  copy the device DB before migration.
- Every wave ends with `npm run verify` green **and** a release build installed and
  smoke-tested on emulator-5554 where runtime behaviour changed.
- Keep the app runnable at every wave boundary. New contracts land beside legacy ones;
  consumers migrate before old code is deleted.
- Prefer pure modules + fixture tests. No network in unit tests.
- `UX.md` is frozen before screen implementation starts.

## 1. Workstreams and file ownership

| Stream | Scope                                               | Owns (examples)                                                                         |
| ------ | --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| S1     | Data model, migrator, repositories, migration tests | `src/db/**`                                                                             |
| S2     | Source runtime, transport v2, sanitizer             | `src/sources/transport/**`, `src/services/source-runtime.ts`, `src/sources/sanitize.ts` |
| S3     | Source ports (one agent per source/family)          | `src/sources/<id>/**`                                                                   |
| S4     | Chapter sync, updates, downloads services           | `src/services/chapters.ts`, `updates.ts`, `downloads.ts`                                |
| D      | Tokens, typography, component kit, motion           | `src/theme/**`, `src/components/ui/**`                                                  |
| N      | App shell, tabs, routes, deep links, intents        | `src/app/_layout.tsx`, `(tabs)/_layout.tsx`, `src/navigation/**`                        |
| C1     | Library + story detail                              | `src/app/(tabs)/index.tsx`, `src/app/story/**`                                          |
| C2     | Browse + search + source manager                    | `src/app/(tabs)/browse.tsx`, `src/app/search.tsx`, `src/app/sources/**`                 |
| C3     | Updates, downloads, history, settings               | `src/app/(tabs)/updates.tsx`, `downloads/**`, `history.tsx`, `settings/**`              |
| R      | Reader + narration adapter                          | `src/app/reader/**`, `src/narration/**` (adapter only)                                  |
| Q      | Reviews, test matrix, device verification           | —                                                                                       |

Shared files (i18n, routes, theme tokens) have one owner per wave.

## 2. Waves

### Wave 0 — Foundations (freeze before coding)

1. Snapshot tree + device DB.
2. Land the new contracts **beside** the old ones:
   - `src/sources/contract.ts` (the `NovelSource` API from `SOURCES.md` §4),
   - `src/sources/errors.ts`,
   - `src/models/novel.ts` (`Novel`, `Chapter`, `NovelStatus`, progress types).
     Do not touch `src/sources/types.ts` yet; both compile together.
3. Design tokens + typography scale stub (`src/theme/tokens.ts`).
4. Dependency/native decision:
   - JS: `cheerio@1.0.0-rc.12`, `htmlparser2@^12`, `sanitize-html`,
     `react-native-url-polyfill`, `zod` (present), `better-sqlite3` (dev only).
   - Native (one prebuild in Wave 1): `expo-network`, `expo-haptics`,
     `expo-notifications`, cookie bridge module (`modules/cookie-bridge`), share-intent
     handling (native module or a config plugin), predictive back enabled.
5. Migration test harness scaffold (`better-sqlite3` + legacy SQL fixture).
6. `THIRD_PARTY_NOTICES.md` (LNReader MIT, Mihon pattern attribution).

Gate: typecheck green with old + new contracts; `db:check` runnable; decisions recorded
in `PLAN.md`.

### Wave 1 — Data + transport + first sources

Owner split: S1 (data), S2 (runtime/transport/sanitizer), S3 (two ports).

1. **Data (S1)**: schema additions from `DATA.md`; `chapters`, `chapter_downloads`,
   `story_updates`, `source_health`; `stories`/progress/history/narration columns;
   drop `extensions`; generate migration; app-level `migrateLegacyData()`; repository
   contracts; migration tests with a legacy fixture; DB backup before migration.
2. **Runtime/transport (S2)**: `SourceRuntime` factory; per-source policy; response
   status/headers; typed errors; `Retry-After`; CF solver + cookie bridge (or
   browser-only fallback); origin-keyed cookie jar; sanitizer; connectivity state;
   source health; import-boundary test.
3. **First ports (S3)**: NovelFire + RoyalRoad, preserving legacy ids, with fixtures
   and sanitizer integration. Literotica adapter (eager pages → chapters `p<index>`).
4. **Chapter sync (S4)**: `syncChapters`, progressive events, reindex transaction,
   orphan handling, `story_updates` insertion, aggregate downloads recompute.
5. **Cleanup**: delete `src/extensions/**`, `ExtensionHost`, extension store/screen/DB
   references; update `AGENTS.md`, `README.md`, `docs/EXTENSIONS.md`.
6. **Legacy UI bridge**: old screens keep working by adapting service calls; no redesign.

Gate: `npm run verify`; on device, Shadow Slave chapter list exceeds 25 via the new sync;
Mother of Learning shows its full list; downloaded chapters survive a sync; upgrade from
a pre-rebuild DB keeps library/progress/downloads.

### Wave 2 — Remaining sources (parallel with Wave 3 design)

S3 agents, one per source/family, with disjoint directories:

- P0: ScribbleHub, NovelBuddy.
- P1: readnovelfull family (NovelBin/NovelFull/FreeWebNovel), LightNovelWorld, AO3.

Gate: each source has fixture + source tests; search/listing/detail/chapter all pass with
recorded payloads; `npm run verify`.

### Wave 3 — Design system + shell

1. Tokens/typography/components (D) per `UX.md`: AppBar, Screen, Section, rows, covers,
   progress, chips, segmented control, sheets, skeletons, empty/error states, motion.
2. Shell/navigation (N): 5 tabs (Library, Updates, Browse, Audio, More), stack routes
   (`story/[sourceId]/[id]`, `chapters/[sourceId]/[id]`,
   `reader/[sourceId]/[novelId]/[chapterId]`, `downloads*`, `history`, `sources`,
   `settings/*`, `audio/player`), encoded route params, deep links, share intent,
   predictive back **off** for 1.0, lazy BrowserHost, global mini-player slot.
3. Placeholder screens behind the new routes.

Gate: app boots to the new shell; themes switch; back stack correct; no hidden WebView at
startup; placeholder navigation works; release build installed.

### Wave 4 — Screens

Implement `UX.md` in disjoint slices:

- C1: Library (hero, shelf, filters, context menu, empty/offline) + Novel detail.
- C2: Browse (source chips, popular/latest, filters), Search (per-source + global),
  Source manager, filters sheet.
- C3: Updates, Downloads, History, Settings (appearance/reading/downloads/updates/
  narration/sources/storage/backup/about), backup/restore screens.

Gate: every screen functional against real sources; device matrix rows 1–6, 8–10, 13, 15
pass; `npm run verify`.

### Wave 5 — Reader + narration

1. HTML → block renderer (paragraphs/headings/quotes/lists/hr/images/inline emphasis)
   with tests; TTS spans derive from the same blocks.
2. Reader chrome: immersive, tap zones, prev/next chapter from the chapter repository,
   progress, chapter sheet, typography sheet (global + per-novel), themes.
3. Progress: chapter id + paragraph index + char offset + scroll %; restore; history.
4. Prefetch next chapter; download-ahead; offline chapter state.
5. Narration adapter: paragraph highlight, tap-to-move, auto-advance, sleep timer,
   mini-player, lock-screen controls; existing engines untouched.

Gate: full NovelFire and RoyalRoad chapters read on device; TTS highlight/advance; progress
survives a sync; typography persists; reader back returns to the right screen.

### Wave 6 — Downloads, updates, device flows

1. Per-chapter download queue from `DATA.md` §6 (pause/resume/cancel/retry, Wi-Fi-only,
   auto-download, download-ahead).
2. Updates: `getNovelStatus` fast path, full sync on change, `story_updates`, background
   task, one summary notification, notification permission/channel.
3. Share intent / clipboard import → add-novel sheet; deep links.
4. Backup v2 + v1 import; EPUB from chapters/HTML.

Gate: device matrix rows 7, 11, 12, 14; download survives restart; updates produce rows
and a notification; backup round-trip green; EPUB opens.

### Wave 7 — Hardening

1. Full device matrix, including offline, CF challenge, 429, parse failure, 3k chapters.
2. Accessibility pass (labels, roles, 44dp, contrast, fontScale).
3. Performance: cold start, library scroll, chapter list, reader; memory.
4. `code-reviewer` pass; fix; final `npm run verify`; release build.

## 3. Parallelisation map

```
Wave 0   [me]
Wave 1   [S1 data]  [S2 runtime]  [S3 ports]  [S4 sync]      (disjoint dirs)
Wave 2   [S3 ports]                                    while Wave 3 starts
Wave 3   [D tokens/components]  [N shell]
Wave 4   [C1]  [C2]  [C3]                                   (disjoint dirs)
Wave 5   [R blocks] → [R chrome/TTS]
Wave 6   [S4 downloads/updates]  [N intents/notifications]
Wave 7   [Q + me]
```

Shared files are edited only by their owner in a given wave; i18n keys for a wave are
added in one commit-sized change by that wave's owner.

## 4. Device test matrix

| #   | Flow                                            | Expected                                            |
| --- | ----------------------------------------------- | --------------------------------------------------- |
| 1   | Cold start offline                              | Library paints from cache; offline banner; no crash |
| 2   | Browse RoyalRoad → novel → chapter              | Full chapter list; content loads                    |
| 3   | Browse NovelFire → Shadow Slave                 | 3,000+ chapters; ch. 1 and ch. 114 load             |
| 4   | Search ScribbleHub                              | Results; pagination; empty state                    |
| 5   | Add to library → shelf progress                 | Correct chapter count and %                         |
| 6   | Read 3 chapters → kill app → reopen             | Resume at exact chapter/scroll                      |
| 7   | Download 5 chapters → airplane mode             | Chapters readable offline                           |
| 8   | Download all (small novel) → sync               | No duplicates; progress intact                      |
| 9   | Chapter jump to 114                             | Opens chapter 114                                   |
| 10  | Reader typography/theme changes                 | Persist across restart                              |
| 11  | TTS: play, highlight, tap-to-move, auto-advance | Works; lock screen controls                         |
| 12  | Back gesture from reader                        | Returns to chapter list/novel; no lost state        |
| 13  | Share URL from browser into app                 | Import sheet prefilled                              |
| 14  | Background update check                         | Updates tab shows new chapters; notification        |
| 15  | Source failure (bad URL/parse)                  | Typed error with action, no dead end                |

## 5. Risks and mitigations

| Risk                                    | Mitigation                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| Cheerio/Metro/Hermes incompatibility    | Wave 1 spike; fallback: htmlparser2 + css-select wrapper                           |
| Cookie bridge complexity                | Browser-only fallback for `browser: 'always'` sources; visible verification screen |
| Scope creep into all 175 sources        | Curated P0/P1 set; declarative engine explicitly deferred                          |
| Parallel agents collide                 | Disjoint file ownership; shared files single-owner; verify between waves           |
| Data loss on migration                  | App-level idempotent migrator; DB snapshot; legacy fixture tests                   |
| Provider renumbering breaks chapter ids | Provider-stable ids + orphaned content kept; alias table in a later wave           |
| Build flakiness / emulator dies         | Restart script; warm Gradle; build retry loop                                      |
| Background updates too heavy            | `getNovelStatus` fast path; full sync only on change; 24 h floor                   |
| TTS regression during reader rewrite    | Narration modules untouched except a span adapter; device test 11                  |
| Real sites change mid-rebuild           | Fixture tests + health metrics; per-source isolation                               |

## 6. Definition of done

- All wave gates passed; `npm run verify` green (typecheck, lint, tests incl. migration
  harness, prettier, db:check); release APK installed on device.
- `SOURCES.md` §12, `DATA.md` §10 and `UX.md` acceptance criteria checked.
- No `src/extensions` references; no hidden WebView at startup; BrowserHost lazy.
- No hard-coded strings/colours; i18n complete; age gate + disclaimers intact.
- `THIRD_PARTY_NOTICES.md` present; upstream references under `docs/upstream/`.
- Nothing committed unless the owner asks.
