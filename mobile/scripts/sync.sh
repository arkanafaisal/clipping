#!/bin/bash
# Script pembantu untuk menyinkronkan skrip Python dari git repo ke shared storage di Android
TARGET_DIR="${1:-/storage/emulated/0/clipping/scripts}"
SCRIPTS_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🔄 Menyinkronkan skrip Python ke: $TARGET_DIR ..."
mkdir -p "$TARGET_DIR"
cp -r "$SCRIPTS_ROOT/utils" "$TARGET_DIR/"
if [ -f "$SCRIPTS_ROOT/cookies.txt" ]; then
    cp "$SCRIPTS_ROOT/cookies.txt" "$TARGET_DIR/"
fi

echo "✅ Sinkronisasi selesai! File skrip siap dieksekusi secara dinamis oleh aplikasi."
