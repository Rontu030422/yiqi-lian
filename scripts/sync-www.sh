#!/bin/sh
# 把 PWA 静态文件同步到 Capacitor 的 www/ 目录（App 打包用）
# 注意：不含 sw.js —— 原生 App 内 Service Worker 已禁用，避免与 WebView 冲突
set -e
cd "$(dirname "$0")/.."
rm -rf www
mkdir -p www
cp index.html manifest.json www/
cp icon-192.png icon-512.png apple-touch-icon.png www/
echo "www/ synced: $(ls www/ | tr '\n' ' ')"
