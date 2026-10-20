# Self-hosted F-Droid repository

Master Reader cannot be listed in the **main** F-Droid repository: its
[Inclusion Policy](https://f-droid.org/en/docs/Inclusion_Policy/) requires apps to be suitable
for all users "including children", and it forbids bundled provider credentials. F-Droid
explicitly allows distributing via your own repository, which is the supported route here.

The `Release` workflow builds an F-Droid index (`fdroid/repo`) from each signed APK and attaches
`master-reader-fdroid-repo-<version>.tar.gz` to the GitHub Release. Publish that directory to any
static host (GitHub Pages, Codeberg Pages, S3, a VPS, …).

## One-time setup

Create a **separate** repository signing key (do not reuse the app signing key):

```bash
keytool -genkeypair -v \
  -keystore master-reader-fdroid-repo.jks \
  -alias master-reader-repo \
  -keyalg RSA -keysize 4096 -validity 10000
```

Add these repository **secrets**:

| Secret                        | Value                                      |
| ----------------------------- | ------------------------------------------ |
| `FDROID_REPO_KEYSTORE_BASE64` | `base64 -w0 master-reader-fdroid-repo.jks` |
| `FDROID_KEYSTORE_PASSWORD`    | keystore password                          |
| `FDROID_KEY_ALIAS`            | `master-reader-repo`                       |
| `FDROID_KEY_PASSWORD`         | key password                               |

Add a repository **variable**:

| Variable          | Value                                         |
| ----------------- | --------------------------------------------- |
| `FDROID_REPO_URL` | public URL of the published `repo/` directory |

If the secrets/variable are absent, the release workflow skips the F-Droid step.

## Publishing the repository

Each release attaches `master-reader-fdroid-repo-<version>.tar.gz`. Extract `repo/` to your host so
that `index-v1.jar`, `index-v2.json` and the APKs are reachable at `FDROID_REPO_URL`. Users add
that URL under _F-Droid → Settings → Repositories_.

Example with GitHub Pages: extract the archive into a `fdroid/` folder on the `gh-pages` branch,
then set `FDROID_REPO_URL=https://<user>.github.io/<repo>/fdroid`.

## Rebuilding an index locally

```bash
pip install fdroidserver
FDROID_REPO_KEYSTORE=/path/to/master-reader-fdroid-repo.jks \
FDROID_KEYSTORE_PASSWORD=... \
FDROID_KEY_ALIAS=master-reader-repo \
FDROID_KEY_PASSWORD=... \
FDROID_REPO_URL=https://example.org/fdroid \
scripts/fdroid/build-repo.sh build/fdroid master-reader-0.2.0-arm64-v8a.apk \
  master-reader-0.2.0-armeabi-v7a.apk master-reader-0.2.0-x86_64.apk \
  master-reader-0.2.0-x86.apk
```

Stage one APK per ABI: that is what F-Droid clients expect, and it keeps the
downloads small. The publishable index is written to `build/fdroid/repo`.

## Constraints recap

- Keep the app FLOSS-only (no Google Play Services, Firebase, Crashlytics or proprietary
  analytics) or F-Droid clients will flag anti-features.
- No bundled provider credentials — sources read credentials at runtime.
- Bump `versionCode` for every release; the workflow uses the CI run number.
