#!/usr/bin/env bash
#
# Builds or refreshes a self-hosted F-Droid repository from release APKs.
#
# Master Reader cannot be listed in the main F-Droid repository (adult content), so
# releases are distributed from a self-hosted index. This script expects a
# long-lived repository signing key supplied via environment variables.
#
# Required environment:
#   FDROID_REPO_KEYSTORE   path to the F-Droid repo signing keystore (.jks)
#   FDROID_KEYSTORE_PASSWORD
#   FDROID_KEY_ALIAS
#   FDROID_KEY_PASSWORD
#   FDROID_REPO_URL        public base URL of the hosted repo (e.g. https://user.github.io/master-reader/fdroid/repo)
# Optional:
#   FDROID_KEY_DNAME       key distinguished name (defaults to a placeholder)
#   FDROID_REPO_NAME       display name (defaults to "Master Reader")
#
# Usage: build-repo.sh <repo-dir> <apk> [<apk>...]

set -euo pipefail

REPO_DIR="${1:?usage: build-repo.sh <repo-dir> <apk>...}"
shift
if [[ "$#" -eq 0 ]]; then
  echo "error: at least one APK is required" >&2
  exit 1
fi

: "${FDROID_REPO_KEYSTORE:?FDROID_REPO_KEYSTORE is required}"
: "${FDROID_KEYSTORE_PASSWORD:?FDROID_KEYSTORE_PASSWORD is required}"
: "${FDROID_KEY_ALIAS:?FDROID_KEY_ALIAS is required}"
: "${FDROID_KEY_PASSWORD:?FDROID_KEY_PASSWORD is required}"
: "${FDROID_REPO_URL:?FDROID_REPO_URL is required}"

if ! command -v fdroid >/dev/null 2>&1; then
  echo "error: fdroidserver is not installed (pip install fdroidserver)" >&2
  exit 1
fi

REPO_NAME="${FDROID_REPO_NAME:-Master Reader}"
KEY_DNAME="${FDROID_KEY_DNAME:-CN=Master Reader, OU=Release, O=Master Reader, C=US}"
PUBLISH_DIR="${REPO_DIR}/repo"

mkdir -p "$PUBLISH_DIR"
cp "$FDROID_REPO_KEYSTORE" "${REPO_DIR}/repo.jks"

cat > "${REPO_DIR}/config.yml" <<YAML
repo_url: ${FDROID_REPO_URL}
repo_name: ${REPO_NAME}
repo_description: Master Reader release repository (adult content, 18+).
archive_older: 0
keystore: repo.jks
repo_keyalias: ${FDROID_KEY_ALIAS}
keystorepass: ${FDROID_KEYSTORE_PASSWORD}
keypass: ${FDROID_KEY_PASSWORD}
keydname: ${KEY_DNAME}
YAML

for apk in "$@"; do
  echo "==> Staging $(basename "$apk")"
  cp "$apk" "${PUBLISH_DIR}/"
done

cd "$REPO_DIR"
echo "==> Updating index"
fdroid update --create-metadata

echo "==> F-Droid repository ready at ${PUBLISH_DIR}"
