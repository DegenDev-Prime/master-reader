#!/usr/bin/env bash
#
# Aligns and signs an unsigned release APK using the Android build-tools.
#
# Required environment:
#   ANDROID_KEYSTORE_PATH      path to the .jks/.keystore file
#   ANDROID_KEYSTORE_PASSWORD  keystore password
#   ANDROID_KEY_ALIAS          key alias
#   ANDROID_KEY_PASSWORD       key password
# Optional:
#   ANDROID_HOME               Android SDK root (used to locate build-tools)
#   ANDROID_BUILD_TOOLS        explicit build-tools directory
#
# Usage: sign-apk.sh <unsigned.apk> <output.apk>

set -euo pipefail

UNSIGNED_APK="${1:?usage: sign-apk.sh <unsigned.apk> <output.apk>}"
OUTPUT_APK="${2:?usage: sign-apk.sh <unsigned.apk> <output.apk>}"

: "${ANDROID_KEYSTORE_PATH:?ANDROID_KEYSTORE_PATH is required}"
: "${ANDROID_KEYSTORE_PASSWORD:?ANDROID_KEYSTORE_PASSWORD is required}"
: "${ANDROID_KEY_ALIAS:?ANDROID_KEY_ALIAS is required}"
: "${ANDROID_KEY_PASSWORD:?ANDROID_KEY_PASSWORD is required}"

if [[ ! -f "$UNSIGNED_APK" ]]; then
  echo "error: unsigned APK not found: $UNSIGNED_APK" >&2
  exit 1
fi

BUILD_TOOLS="${ANDROID_BUILD_TOOLS:-}"
if [[ -z "$BUILD_TOOLS" ]]; then
  : "${ANDROID_HOME:?ANDROID_HOME or ANDROID_BUILD_TOOLS must be set}"
  BUILD_TOOLS="$(ls -d "${ANDROID_HOME}"/build-tools/* 2>/dev/null | sort -V | tail -1)"
fi

ZIPALIGN="${BUILD_TOOLS}/zipalign"
APKSIGNER="${BUILD_TOOLS}/apksigner"

for tool in "$ZIPALIGN" "$APKSIGNER"; do
  if [[ ! -x "$tool" ]]; then
    echo "error: required build tool not found: $tool" >&2
    exit 1
  fi
done

ALIGNED_APK="${OUTPUT_APK%.apk}-aligned.apk"

echo "==> Aligning $(basename "$UNSIGNED_APK")"
"$ZIPALIGN" -p -f 4 "$UNSIGNED_APK" "$ALIGNED_APK"

echo "==> Signing $(basename "$OUTPUT_APK")"
"$APKSIGNER" sign \
  --ks "$ANDROID_KEYSTORE_PATH" \
  --ks-key-alias "$ANDROID_KEY_ALIAS" \
  --ks-pass env:ANDROID_KEYSTORE_PASSWORD \
  --key-pass env:ANDROID_KEY_PASSWORD \
  --out "$OUTPUT_APK" \
  "$ALIGNED_APK"

rm -f "$ALIGNED_APK"

echo "==> Verifying signature"
"$APKSIGNER" verify --print-certs "$OUTPUT_APK"

echo "==> Signed APK: $OUTPUT_APK"
