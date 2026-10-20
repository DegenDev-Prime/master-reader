#!/usr/bin/env bash
#
# Verifies that a release APK ships the native libraries for every supported
# ABI.
#
# A partially built APK (for example one produced after a local Gradle run
# restricted to a single architecture) installs fine but crashes on launch with
# `NoClassDefFoundError: expo.modules.kotlin.jni.MainRuntimeInstaller`,
# because the runtime native library for the device's ABI is missing. This
# script turns that into a build failure instead of a broken download.
#
# Usage: verify-apk.sh <apk> [abi ...]

set -euo pipefail

APK="${1:?usage: verify-apk.sh <apk> [abi ...]}"
shift || true

ABIS=("$@")
if [[ ${#ABIS[@]} -eq 0 ]]; then
  ABIS=(arm64-v8a armeabi-v7a x86 x86_64)
fi

# Libraries the app cannot start without, and the TTS runtime it advertises.
REQUIRED_LIBS=(
  libexpo-modules-core.so
  libappmodules.so
  libreactnative.so
  libhermesvm.so
  libsherpa-onnx-jni.so
)

if [[ ! -f "$APK" ]]; then
  echo "error: APK not found: $APK" >&2
  exit 1
fi

if ! command -v unzip >/dev/null 2>&1; then
  echo "error: unzip is required to inspect the APK" >&2
  exit 1
fi

ENTRIES="$(unzip -Z1 "$APK")"

failed=0
for abi in "${ABIS[@]}"; do
  libs="$(printf '%s\n' "$ENTRIES" | grep -E "^lib/${abi}/.*\.so$" || true)"
  if [[ -z "$libs" ]]; then
    echo "error: $abi: no native libraries in $(basename "$APK")" >&2
    failed=1
    continue
  fi

  missing=()
  for lib in "${REQUIRED_LIBS[@]}"; do
    if ! printf '%s\n' "$libs" | grep -q "/${lib}$"; then
      missing+=("$lib")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "error: $abi: missing ${missing[*]}" >&2
    failed=1
    continue
  fi

  count="$(printf '%s\n' "$libs" | wc -l | tr -d ' ')"
  echo "ok: $abi: $count native libraries"
done

if [[ $failed -ne 0 ]]; then
  cat >&2 <<'EOF'

The APK is incomplete. This happens when Gradle builds only a subset of ABIs,
because a previous build restricted `reactNativeArchitectures` and Gradle reused
the cached native output. Build every ABI:

    npm run build:android

or clear the cached native build first:

    cd android && ./gradlew clean
EOF
  exit 1
fi

echo "==> Verified $(basename "$APK"): ${#ABIS[@]} ABIs, all required libraries present"
