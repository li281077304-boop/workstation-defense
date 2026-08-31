#!/usr/bin/env bash
# Reproducible local Android build: always use a system-registered Java 21.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

JAVA_21_HOME="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
if [[ -z "$JAVA_21_HOME" || ! -x "$JAVA_21_HOME/bin/java" ]]; then
  echo "JAVA 21 SYSTEM INSTALL REQUIRED"
  echo "Install a Java 21 JDK so /usr/libexec/java_home -v 21 returns a Contents/Home path."
  exit 1
fi

export JAVA_HOME="$JAVA_21_HOME"
export PATH="$JAVA_HOME/bin:$PATH"
JAVA_VERSION="$(java -version 2>&1 | head -n 1)"
if [[ ! "$JAVA_VERSION" =~ \"21\. ]]; then
  echo "JAVA 21 SYSTEM INSTALL REQUIRED"
  echo "Detected: $JAVA_VERSION"
  exit 1
fi

echo "JAVA_HOME=$JAVA_HOME"
echo "$JAVA_VERSION"
npm test
npm run build
npx cap sync android
(
  cd android
  ./gradlew --stop
  ./gradlew assembleDebug
)

APK_SOURCE="android/app/build/outputs/apk/debug/app-debug.apk"
APK_TARGET="artifacts/工位保卫战-v0.34-experience.apk"
if [[ ! -f "$APK_SOURCE" ]]; then
  echo "ANDROID BUILD FAILED: expected APK missing at $APK_SOURCE"
  exit 1
fi
mkdir -p artifacts
cp "$APK_SOURCE" "$APK_TARGET"
echo "TEST=PASS"
echo "WEB BUILD=PASS"
echo "ANDROID BUILD=PASS"
echo "APK PATH=$ROOT_DIR/$APK_TARGET"
echo "APK SIZE=$(stat -f%z "$APK_TARGET")"
echo "SHA256=$(shasum -a 256 "$APK_TARGET" | awk '{print $1}')"
