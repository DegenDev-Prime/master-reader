# Master Reader

A modern, offline-first reader for serialized fiction, built on Expo (React Native).
Master Reader is a from-scratch replacement for the unmaintained
[`theilluminatus/litapp`](https://github.com/theilluminatus/litapp) Ionic 3 app.

> **Status:** Phase 9 — a runtime extension system lets users add sources for other platforms.
> All planned phases are complete.

> **Disclaimer:** Master Reader is unofficial and not affiliated with any content provider.
> It is intended for adults (18+). You are responsible for complying with the terms of
> service of any source you configure.

## Stack

| Concern        | Choice                                                   |
| -------------- | -------------------------------------------------------- |
| Runtime        | Expo SDK 57, React Native, React 19, TypeScript (strict) |
| Navigation     | expo-router (file-based)                                 |
| Data           | expo-sqlite + Drizzle ORM                                |
| Network        | fetch + zod validation + retry/backoff queue             |
| State          | zustand stores + TanStack Query for source data          |
| Lists / motion | FlashList, Reanimated                                    |
| Files          | expo-file-system (SAF), expo-sharing, fflate             |
| Localisation   | i18n-js + expo-localization                              |
| Background     | expo-background-task + expo-task-manager                 |
| Extensions     | react-native-webview JS sandbox + HTTP bridge            |

## Architecture

```
src/
  app/          routes: (tabs)/…, story/[sourceId]/[id], reader/[sourceId]/[id], downloads, restore, sources
  components/   shared UI primitives and story list
  constants/    spacing, radii, fonts, layout tokens
  theme/        palettes (light/dark/AMOLED), reader palettes, theme provider
  hooks/        reusable hooks and TanStack Query wrappers
  db/           drizzle schema, migrations, repositories, mappers
  sources/      Source interface, transport, Literotica impl, parsers
  extensions/   runtime sandbox, protocol, runtime manager, source adapter
  services/     catalog, library, history, reading, caches, downloads, backup, updates, source manager
  stores/       zustand stores (settings, library, history, downloads, extensions)
  tasks/        background task definitions
  i18n/         translator + English strings
  utils/        html, hash, format, ids, time, reading positions, download sizing
fixtures/       recorded payloads for parser tests
```

The app is **Android-only** and **offline-first**: SQLite is the source of truth, with a
separated metadata cache, HTTP cache and pinned download tier.

## Sources

Content sources implement the `Source` interface (`src/sources/types.ts`). The built-in
Literotica source talks to their unofficial JSON API through a transport layer that handles
rate limiting, timeouts, cookies and retry/backoff, and validates every payload with zod.

**Credentials are never bundled.** If a source requires an app id/key pair, it is supplied at
runtime and read from settings; anonymous browsing works without it.

## Extensions

Sources for other platforms can be added at runtime (ArcReader/Aidoku-style). Hermes has no
`eval`, so extensions run in a **hidden WebView sandbox**; network requests are bridged back to
the app so they go through the cached, rate-limited, offline-aware transport and never hit CORS.
Install from a URL or by pasting code under Settings → Sources → Extensions.

```js
registerSource({
  id: 'com.example.source',
  name: 'Example',
  version: '1.0.0',
  lang: 'en',
  baseUrl: 'https://example.com',
  capabilities: ['popular', 'latest', 'search', 'tags'],
  async getPopular({ page }) {
    const res = await host.request({ url: 'https://example.com/api', query: { page } });
    return { page, hasNext: false, items: JSON.parse(res.text) };
  },
  // getLatest, search, getStory, getTags...
});
```

See [docs/EXTENSIONS.md](./docs/EXTENSIONS.md) for the full API and
[docs/examples/example-source.js](./docs/examples/example-source.js) for a complete example.

## Caching & offline

Three independent tiers, all persisted in SQLite:

1. **HTTP response cache** — the transport stores GET responses with ETag/Last-Modified and
   revalidates conditionally (304 reuses the body). Fresh entries are served without a network
   call; stale entries are served when the network fails.
2. **Listing cache** — browse and search pages are stored with their story order and a TTL, so
   previously viewed listings remain browsable offline.
3. **Page/metadata cache** — story metadata and page content persist as they are read; the
   reader always prefers cached content.

**Offline mode** (Settings → Advanced) short-circuits all network access: reads are served from
cache and `OfflineError` is raised for anything not yet cached. Expired entries are pruned on
startup, and Settings → Storage can clear cached data without touching the library.

## Downloads

Downloads are a **pinned tier** that cache sweeps never touch. A download queues a story, fetches
and persists every page, and records page count and byte size. The queue runs one story at a time
with status transitions `queued → downloading → completed | failed`; failures can be retried and
entries removed (which also deletes their pages). The Downloads screen (Library top-right, or
Settings → Storage) lists items with sizes and total storage use.

## Backup & restore

Backups are versioned, gzipped JSON (`master-reader-backup-<timestamp>.json.gz`) containing the
library, referenced story metadata, reading progress, history, sources and settings — downloads
are intentionally excluded (they can be re-fetched).

- **Auto backup** writes to a folder you pick via the Android Storage Access Framework when the
  configured interval has elapsed, keeping the newest N files.
- **Manual export** shares a snapshot, and the library can be exported as CSV.
- **Restore** (Settings → Backup → Restore) supports `merge`, `replace` and `skip` modes, and
  validates the file shape before applying anything.

## Localisation, updates & age gate

- **Localisation**: all user-facing strings live in `src/i18n/en.json` and are read through `t()`
  (`src/i18n`). The device language is detected with `expo-localization` and falls back to English.
- **Background updates**: when enabled, `expo-background-task` periodically refreshes library story
  metadata through the cached transport. Settings → Advanced also offers a manual check.
- **Theming**: light/dark/AMOLED palettes drive the navigation theme, status bar and Android
  navigation bar; the reader keeps the screen awake while open.
- **Age gate**: the app requires an explicit 18+ confirmation on first launch before any content
  is shown.

## Requirements

- Node.js 24+
- Android SDK / an Android device or emulator

## Scripts

```bash
npm install          # install dependencies
npm start            # start the Expo dev server
npm run android      # launch on an Android device/emulator
npm run typecheck    # tsc --noEmit
npm run lint         # eslint (expo lint)
npm run format       # prettier --write
npm run test         # vitest run
npm run db:generate  # generate a migration from src/db/schema.ts
npm run db:check     # validate migration history
npm run verify       # typecheck + lint + test (mirrors CI)
npx expo prebuild --platform android   # generate the native project
```

## Releasing

Releases are built from source in CI (`expo prebuild` + Gradle), not via EAS.

- [docs/RELEASING.md](./docs/RELEASING.md) — signing keys, cutting a release, local builds.
- [docs/FDROID.md](./docs/FDROID.md) — publishing the self-hosted F-Droid repository.

Tag a commit (`git tag v0.2.0 && git push origin v0.2.0`) to trigger the `Release` workflow,
which verifies, builds, aligns and signs the APK, and publishes it with release notes.

## Distribution constraints

Master Reader targets **GitHub Releases** plus a **self-hosted F-Droid repository**. It is
_not_ eligible for the main F-Droid repository (adult content) or any store with
restrictive content policies. The build therefore must stay FLOSS-only:

- No Google Play Services, Firebase, Crashlytics or proprietary analytics.
- No silent over-the-air code updates (`expo-updates`) unless self-hosted and opt-in.
- No bundling of third-party trademarks or provider credentials.

## Roadmap

| Phase | Scope                                                                       |
| ----- | --------------------------------------------------------------------------- |
| 0 ✅  | Scaffold, tooling, CI, design tokens, tab shell                             |
| 1 ✅  | SQLite + Drizzle schema, migrations, repositories, settings store           |
| 2 ✅  | `Source` interface, HTTP transport, Literotica implementation, parser tests |
| 3 ✅  | Library, browse, search, story detail, reader, progress, history            |
| 4 ✅  | Cache tiers + offline mode                                                  |
| 5 ✅  | Download queue + storage management                                         |
| 6 ✅  | Backup/restore + SAF auto-backup                                            |
| 7 ✅  | Background updates, i18n, theming, age gate                                 |
| 8 ✅  | Release engineering (Gradle APK in CI, GitHub Releases, F-Droid repo)       |
| 9 ✅  | Runtime JS extension system                                                 |

## License

MIT — see [LICENSE](./LICENSE). _(Placeholder copyright holder; update before first release.)_
