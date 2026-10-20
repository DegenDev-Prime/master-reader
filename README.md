# Master Reader

A modern, offline-first reader for serialized fiction, built with Expo (React Native).

Master Reader is a from-scratch Android app for reading web novels, serialised stories and
creator archives. It keeps a local SQLite copy of everything you read, renders chapters with a
native block renderer (no embedded browser), and speaks the chapter aloud with on-device neural
text-to-speech.

> **Disclaimer:** Master Reader is unofficial and not affiliated with any content provider.
> It is intended for adults (18+). You are responsible for complying with the terms of service of
> any source you use.

## Features

- **Seven built-in sources** — Literotica, NovelFire, Royal Road, Scribble Hub, NovelBuddy,
  Pawchive and Kemono — behind one `Source` interface.
- **Chapter-first reading.** A novel is a list of chapters, not a list of pages. Serials with
  thousands of chapters are supported: the full chapter list is searchable and jump-to-chapter
  works without loading the whole catalogue.
- **Native reader.** Chapters render as native React Native blocks with a hairline rule, no
  shadows and four reading themes (paper, sepia, slate, AMOLED). The system bars hide while you
  read and the chrome fades after a few seconds.
- **Offline-first.** SQLite is the source of truth. Metadata, listings, HTTP responses and
  chapter content each have their own cache tier; downloads are pinned and never evicted.
- **Narration.** On-device neural TTS (sherpa-onnx, Apache-2.0) with per-voice speed control,
  sleep timer, chapter-windowed narration and exact highlight-to-text mapping.
- **Updates feed.** A per-chapter feed of newly published chapters for the novels you follow.
- **Downloads, backup and export.** Pinned offline downloads, versioned JSON backups with
  merge/replace restore, CSV library export and EPUB export.
- **FLOSS-only.** No Google Play Services, no Firebase, no proprietary analytics, no ads.

## Screens

| Tab         | Screen                                                   |
| ----------- | -------------------------------------------------------- |
| **Library** | Followed novels, reading progress, unread counts         |
| **Updates** | Newly published chapters, grouped per novel              |
| **Browse**  | Popular / latest / search across every source            |
| **Audio**   | Now playing, transport, queue, recent narration sessions |
| **More**    | History, downloads, sources, settings, backup, about     |

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
| Narration      | sherpa-onnx (on-device neural TTS, Apache-2.0)           |

## Architecture

```
src/
  app/          routes: (tabs)/…, story/[sourceId]/[id], reader/[sourceId]/[novelId]/[chapterId]
  components/   shared UI primitives, reader blocks, audio player
  constants/    spacing, radii, fonts, layout tokens
  theme/        palettes (light/dark/AMOLED), reader palettes, theme provider
  hooks/        reusable hooks and TanStack Query wrappers
  db/           drizzle schema, migrations, repositories, mappers
  narration/    TTS engine, chunking, highlight mapping, player estimates
  sources/      Source interface, transport, per-provider implementations
  services/     catalog, library, history, reading, caches, downloads, backup, export
  stores/       zustand stores (settings, library, history, narration)
  tasks/        background task definitions
  i18n/         translator + English strings
  utils/        html, hash, format, ids, time, reading positions
fixtures/       recorded payloads for parser tests
modules/        local Expo modules (sherpa-tts)
```

The app is **Android-only** and **offline-first**: SQLite is the source of truth, with separated
metadata, listing, HTTP and pinned download tiers.

## Sources

Content sources implement the `Source` interface (`src/sources/types.ts`). Every provider ships
as a built-in module, so there is no runtime plugin system and no third-party code executes in
your app.

| Source       | Kind            | Notes                                 |
| ------------ | --------------- | ------------------------------------- |
| Literotica   | Story site      | JSON API, categories and tags         |
| NovelFire    | Story site      | JSON API, categories                  |
| Royal Road   | Story site      | Browser-backed HTML parsing           |
| Scribble Hub | Story site      | Browser-backed HTML parsing           |
| NovelBuddy   | Story site      | JSON API                              |
| Pawchive     | Creator archive | Creator is a story, post is a chapter |
| Kemono       | Creator archive | Creator is a story, post is a chapter |

Parsers are pure functions validated with zod and tested against recorded payloads in
`fixtures/`. **Credentials are never bundled** — anything a source needs is supplied at runtime.

## Development

### Requirements

- Node.js 24+
- JDK 17
- Android SDK (`ANDROID_HOME` set) and a device or emulator

### Getting started

```bash
npm install           # install dependencies
npm start             # start the Expo dev server
npm run android       # build and launch on a device/emulator
```

### Checks

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint (expo lint)
npm run format        # prettier --write
npm run format:check  # prettier --check
npm run test          # vitest run
npm run db:generate   # generate a migration from src/db/schema.ts
npm run verify        # format:check + typecheck + lint + test (mirrors CI)
```

## Installation

Download an APK from the [releases page](https://github.com/DegenDev-Prime/master-reader/releases)
and install it. Android asks you to allow installs from your browser the first time.

| File                                      | Size  | Use it when                             |
| ----------------------------------------- | ----- | --------------------------------------- |
| `master-reader-<version>.apk`             | ~235M | You are not sure which one to take      |
| `master-reader-<version>-arm64-v8a.apk`   | ~74M  | Almost every phone from the last decade |
| `master-reader-<version>-armeabi-v7a.apk` | ~57M  | Older 32-bit devices                    |
| `master-reader-<version>-x86_64.apk`      | ~80M  | 64-bit emulators                        |
| `master-reader-<version>-x86.apk`         | ~81M  | 32-bit emulators                        |

Every APK is signed with the same key, so you can install one now and upgrade in place later.
The universal APK works on any device but is three times the size of the `arm64-v8a` one.

There is also a [self-hosted F-Droid repository](https://github.com/DegenDev-Prime/master-reader/blob/main/docs/FDROID.md).

## Building an APK

The native project is generated by `expo prebuild` and is not committed. Releases are built from
source in CI — never with EAS.

```bash
npm run build:android          # prebuild + assembleRelease + ABI verification
npm run build:android:debug    # same, debug variant
npm run verify:apk -- <apk>    # check the native libraries inside an APK
```

`scripts/android/build-release.sh` always compiles **every** supported ABI
(`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`) and then runs
`scripts/android/verify-apk.sh`, which fails the build if any ABI is missing a required native
library. A partial build otherwise installs cleanly and crashes on launch with
`NoClassDefFoundError: expo.modules.kotlin.jni.MainRuntimeInstaller`.

The build produces a universal APK plus one APK per ABI. The universal one works everywhere; the
per-ABI ones are about a third of the size.

## Releasing

- [docs/RELEASING.md](./docs/RELEASING.md) — signing keys, cutting a release.
- [docs/FDROID.md](./docs/FDROID.md) — publishing the self-hosted F-Droid repository.

Tag a commit and push the tag to trigger the `Release` workflow, which verifies, builds, checks
the ABIs, aligns, signs and publishes the APK with release notes:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

## Distribution constraints

Master Reader targets **GitHub Releases** plus a **self-hosted F-Droid repository**. It is _not_
eligible for the main F-Droid repository (adult content) or any store with restrictive content
policies. The build therefore must stay FLOSS-only:

- No Google Play Services, Firebase, Crashlytics or proprietary analytics.
- No silent over-the-air code updates (`expo-updates`) unless self-hosted and opt-in.
- No bundling of third-party trademarks or provider credentials.

## License

MIT — see [LICENSE](./LICENSE).
