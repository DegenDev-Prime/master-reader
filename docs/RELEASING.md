# Releasing Master Reader

Master Reader ships as **signed APKs on GitHub Releases** plus an optional **self-hosted F-Droid
repository**. There is no EAS/cloud build: everything is produced from source in CI with
`expo prebuild` + Gradle, which is what F-Droid requires.

## What a release contains

| File                                      | Size  | Contents                   |
| ----------------------------------------- | ----- | -------------------------- |
| `master-reader-<version>.apk`             | ~235M | Every ABI in one file      |
| `master-reader-<version>-arm64-v8a.apk`   | ~74M  | 64-bit phones (almost all) |
| `master-reader-<version>-armeabi-v7a.apk` | ~57M  | Older 32-bit phones        |
| `master-reader-<version>-x86_64.apk`      | ~80M  | 64-bit emulators           |
| `master-reader-<version>-x86.apk`         | ~81M  | 32-bit emulators           |

All of them are signed with the same release key, so a user can install one and upgrade in place.

The universal APK is roughly three times the size of the `arm64-v8a` one. Most people want that
one; the universal is there so nobody has to work out which file to pick.

## One-time setup

Generate an Android signing key and add it to repository secrets:

```bash
keytool -genkeypair -v \
  -keystore master-reader-release.p12 \
  -storetype PKCS12 \
  -alias master-reader \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=Master Reader, OU=Release, O=Master Reader, C=US"
```

Add these **secrets** (Settings → Secrets and variables → Actions):

| Secret                      | Value                                  |
| --------------------------- | -------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | `base64 -w0 master-reader-release.p12` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password                      |
| `ANDROID_KEY_ALIAS`         | `master-reader`                        |
| `ANDROID_KEY_PASSWORD`      | key password                           |

Keep the keystore safe: **updates must be signed with the same key**, and there is no way to
recover it if it is lost. Back it up somewhere you control, outside the repository.

## Cutting a release

1. Update `version` in `app.json` and commit.
2. Tag and push:

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

The `Release` workflow then:

1. runs `npm run verify`,
2. sets `android.versionCode` from the CI run number,
3. runs `npx expo prebuild --platform android --clean`,
4. builds `assembleRelease` for **every** ABI,
5. verifies the native libraries inside each APK
   (`scripts/android/verify-apk.sh`),
6. aligns and signs each APK (`scripts/android/sign-apk.sh`),
7. publishes a GitHub Release with all five APKs and generated release notes.

You can also run the workflow manually (`workflow_dispatch`) to produce APKs without tagging.

## Local release build

```bash
npm run build:android
```

That regenerates the native project, builds every ABI, and verifies the result. It leaves the
APKs in `android/app/build/outputs/apk/release/`. Sign them with:

```bash
source /path/to/credentials        # KEYSTORE, ALIAS, PASSWORD
ANDROID_KEYSTORE_PATH="$KEYSTORE" \
ANDROID_KEYSTORE_PASSWORD="$PASSWORD" \
ANDROID_KEY_ALIAS="$ALIAS" \
ANDROID_KEY_PASSWORD="$PASSWORD" \
scripts/android/sign-apk.sh \
  android/app/build/outputs/apk/release/app-universal-release.apk \
  master-reader-0.2.0.apk
```

`ANDROID_HOME` (or `ANDROID_BUILD_TOOLS`) must point at an SDK install so the script can find
`zipalign` and `apksigner`.

### Why the ABI check exists

Gradle reuses the native libraries it has already compiled. If one build is restricted to a single
architecture, the next build packages only that architecture even though it was asked for all of
them. The APK then installs normally and crashes on launch with:

```
NoClassDefFoundError: expo.modules.kotlin.jni.MainRuntimeInstaller
```

`scripts/android/verify-apk.sh` fails the build when an ABI is missing a required library, so
this is caught before anyone downloads it.

## Versioning

- `version` (app.json) → `versionName` and the release tag.
- `versionCode` is injected in CI from the workflow run number.
- The application ID is `app.masterreader`; change it (and the app name) before the first
  public release if you own a domain you would rather use.

## Distribution notes

- The main F-Droid repository will **not** accept Master Reader (adult content). See
  [FDROID.md](./FDROID.md) for the self-hosted repository.
- Do not add Google Play Services, Firebase, Crashlytics, proprietary analytics, or silent OTA
  updates (`expo-updates`); they break the FOSS-only requirement.
