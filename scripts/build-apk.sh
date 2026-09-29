#!/bin/sh
# 一起练 Android APK 打包脚本（release 签名，可直接分发安装）
# 用法: sh scripts/build-apk.sh [输出文件名，默认 yiqilian-v1.0.0.apk]
#
# 环境变量（均有默认值，可覆盖）:
#   ANDROID_HOME       Android SDK 路径
#   JAVA_HOME          JDK 17 路径
#   GRADLE_BIN         gradle 可执行文件
#   KEYSTORE           签名 keystore 路径（默认 ~/.signing 下，不在仓库内）
#   KEYSTORE_PWD_FILE  keystore 密码文件
set -e
cd "$(dirname "$0")/.."

ANDROID_HOME="${ANDROID_HOME:-$HOME/workspace/.android-sdk}"
export ANDROID_HOME ANDROID_SDK_ROOT="$ANDROID_HOME"
JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
export JAVA_HOME
export PATH="$ANDROID_HOME/build-tools/34.0.0:$ANDROID_HOME/platform-tools:$PATH"

KEYSTORE="${KEYSTORE:-$HOME/workspace/.signing/yiqilian-release.keystore}"
KEYSTORE_PWD_FILE="${KEYSTORE_PWD_FILE:-$HOME/workspace/.signing/keystore.pwd}"
OUT_NAME="${1:-yiqilian-v1.0.0.apk}"

echo "==> 1/4 同步 www/"
sh scripts/sync-www.sh
npx cap sync android >/dev/null 2>&1

echo "==> 2/4 Gradle 构建 release"
GRADLE_BIN="${GRADLE_BIN:-$HOME/workspace/.gradle-dist/gradle-8.14.3/bin/gradle}"
"$GRADLE_BIN" -p android assembleRelease --no-daemon -q
APK_UNSIGNED="android/app/build/outputs/apk/release/app-release-unsigned.apk"
[ -f "$APK_UNSIGNED" ] || { echo "构建产物未找到: $APK_UNSIGNED"; exit 1; }

echo "==> 3/4 zipalign + apksigner 签名"
PASS="$(cat "$KEYSTORE_PWD_FILE")"
APK_TMP="android/app/build/outputs/apk/release/app-release-tmp.apk"
APK_SIGNED="android/app/build/outputs/apk/release/app-release-signed.apk"
zipalign -f 4 "$APK_UNSIGNED" "$APK_TMP"
apksigner sign --ks "$KEYSTORE" --ks-key-alias yiqilian \
  --ks-pass "pass:$PASS" --key-pass "pass:$PASS" \
  --out "$APK_SIGNED" "$APK_TMP"
rm -f "$APK_TMP"
apksigner verify "$APK_SIGNED" && echo "签名验证通过"

echo "==> 4/4 输出"
mkdir -p releases
cp "$APK_SIGNED" "releases/$OUT_NAME"
ls -la "releases/$OUT_NAME"
echo "DONE: releases/$OUT_NAME"
