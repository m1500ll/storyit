#!/bin/bash
# final render of HammersmithShort in chunks (software WebGL, no GPU): 1080x1920, h264 crf 16
cd "$(dirname "$0")"
export TEMP=$PWD/.rtmp TMP=$PWD/.rtmp
CH=$(ls /opt/pw-browsers/chromium_headless_shell-1243/*/chrome-headless-shell)
mkdir -p out/hs/final
for r in 0-299 300-599 600-899 900-1199 1200-1499 1500-1799; do
  [ -f out/hs/final/part_$r.mp4 ] && continue
  echo "START $r $(date +%T)"
  npx remotion render src/index.ts HammersmithShort out/hs/final/tmp_$r.mp4 --frames=$r --gl=swangle --browser-executable=$CH \
    --concurrency=3 --timeout=900000 --codec h264 --crf 16 --scale 1 --log=error > out/hs/final/log_$r.txt 2>&1 \
    && mv out/hs/final/tmp_$r.mp4 out/hs/final/part_$r.mp4 && echo "DONE $r $(date +%T)" || echo "FAIL $r $(date +%T)"
done
echo ALLDONE
