# Releasing Master Reader

Master Reader ships as a **signed APK on GitHub Releases** plus an optional **self-hosted F-Droid
repository**. There is no EAS/cloud build: everything is produced from source in CI with
`expo prebuild` + Gradle, which is what F-Droid requires.

## One-time setup

Generate an Android signing key and add it to repository secrets:

```bash
keytool -genkeypair -v \
  -keystore master-reader-release.jks \
  -alias master-reader \
  -keyalg RSA -keysize 4096 -validity 10000
```

Add these **secrets** (Settings → Secrets and variables → Actions):

| Secret                      | Value                                  |
| --------------------------- | -------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | `base64 -w0 master-reader-release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password                      |
| `ANDROID_KEY_ALIAS`         | `master-reader`                        |
| `ANDROID_KEY_PASSWORD`      | key password                           |

Keep `master-reader-release.jks` safe: updates must be signed with the same key.

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
4. builds `assembleRelease`, then aligns and signs the APK
   (`scripts/android/sign-apk.sh`),
5. publishes a GitHub Release with the signed APK and generated release notes.

You can also run the workflow manually (`workflow_dispatch`) to produce an APK without tagging.

## Local release build

```bash
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
```

This produces `android/app/build/outputs/apk/release/app-release-unsigned.apk`. Sign it with:

```bash
ANDROID_KEYSTORE_PATH=/path/to/master-reader-release.jks \
ANDROID_KEYSTORE_PASSWORD=... \
ANDROID_KEY_ALIAS=master-reader \
ANDROID_KEY_PASSWORD=... \
scripts/android/sign-apk.sh \
  android/app/build/outputs/apk/release/app-release-unsigned.apk \
  master-reader-0.2.0.apk
```

`ANDROID_HOME` (or `ANDROID_BUILD_TOOLS`) must point at an SDK install so the script can find
`zipalign` and `apksigner`.

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
