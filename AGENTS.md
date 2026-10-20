# Master Reader — agent guide

> **Expo HAS CHANGED.** Read the exact versioned docs at
> https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Project facts

- Expo SDK 57 · React Native · React 19 · TypeScript strict · expo-router.
- **Android-only.** Do not add iOS/web-specific work or dependencies.
- Offline-first: SQLite is the source of truth (added in phase 1).
- Path alias: `@/*` → `src/*`, `@/assets/*` → `assets/*`.

## Commands

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint (flat config, eslint.config.js)
npm run format      # prettier --write
npm run test        # vitest run
npm run db:generate # regenerate migrations after editing src/db/schema.ts
npm run verify      # all of the above; run before finishing any task
```

ALWAYS run `npm run verify` after making changes.

## Conventions

- No comments unless they explain non-obvious intent.
- Consume colours through `useAppTheme()` / `useTheme()` — never hard-code hex values.
- Keep features inside a phase; do not pull later-phase dependencies forward without cause.
- Prefer pure, testable modules in `src/sources`, `src/services`, `src/db`; add
  `*.test.ts` coverage for parsing and business logic.
- Never edit `src/db/migrations/*` by hand. Change `src/db/schema.ts` and run
  `npm run db:generate`.
- Keep row/domain mapping in `src/db/mappers/*` free of the database client so it stays
  unit-testable under Vitest (the SQLite native module is unavailable in Node).
- Keep source parsers pure and free of `HttpClient`; validate payloads with zod and test
  them against recorded JSON in `fixtures/`. Never bundle provider credentials — they are
  supplied at runtime.
- Keep pure logic out of modules that import `@/db/*` so Vitest can test it in Node (the
  SQLite native module is unavailable there). Example: `utils/reading-position.ts`.
- The transport is cache-agnostic: it takes a `ResponseCacheStore` (`sources/transport/cache.ts`).
  The SQLite implementation lives in `services/response-cache.ts`; `services/cache.ts` handles
  pruning and clearing. Never import `@/db/*` from `src/sources/transport/*`.
- Downloads are the pinned tier: cache sweeps must never delete rows in `pages` for stories with
  a `completed` download. Deleting a download removes both the `downloads` row and its pages.
- Backup encoding/decoding, filename/rotation and CSV live in `services/backup/format.ts` and
  must stay pure and `@/db`-free so they are unit-testable. Filesystem and database work belongs
  in `services/backup/index.ts`.
- Never hard-code user-facing strings in components. Add them to `src/i18n/en.json` and read them
  with `t()` from `@/i18n`. Keep `src/i18n/translator.ts` pure (`@/i18n` imports `expo-localization`).
- Releases are built from source with `expo prebuild` + Gradle (no EAS). Do not commit `android/`
  or `ios/`; they are generated. Keep the app FLOSS-only (see Distribution constraints) and bump
  `app.json` `version` for releases.
- Sources are built-in modules under `src/sources/*`. There is no runtime plugin system: no
  third-party code executes in the app. Add a source by implementing `Source`
  (`src/sources/types.ts`) and registering it in `src/sources/registry.ts`.
- A release APK must contain every supported ABI. `npm run build:android` compiles all of them
  and `scripts/android/verify-apk.sh` fails the build if a native library is missing, so a
  partial Gradle build never ships.

## Hard constraints (distribution)

Master Reader ships via GitHub Releases and a self-hosted F-Droid repository. It must remain FLOSS-only:

- No Google Play Services, Firebase, Crashlytics, proprietary analytics or ads.
- No silent OTA code updates (`expo-updates`) unless self-hosted and opt-in.
- Never bundle third-party trademarks or provider credentials/API keys.
- The app is 18+; preserve the age gate and the "unofficial / not affiliated" disclaimer.
