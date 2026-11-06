#!/bin/sh
# Renders the film and restarts it when it stops making progress. After a browser crash Remotion can
# hang without exiting, so waiting for it to finish is not enough: a silent log means a stalled render.
LOG=out/film-render.log
STALL=180 # seconds of silence
TRIES=6

try=1
while [ "$try" -le "$TRIES" ]; do
  echo "attempt $try" > "$LOG"
  npx remotion render src/index.ts Film out/film.mp4 --crf=20 --color-space=bt709 --concurrency=4 >> "$LOG" 2>&1 &
  pid=$!
  while kill -0 "$pid" 2>/dev/null; do
    sleep 10
    idle=$(($(date +%s) - $(stat -f %m "$LOG")))
    if [ "$idle" -gt "$STALL" ]; then
      echo "stalled after ${idle}s" >> out/film-render-retries.log
      pkill -9 -P "$pid"
      kill -9 "$pid"
      break
    fi
  done
  if wait "$pid" && ! grep -q 'Error:' "$LOG"; then
    echo done >> "$LOG"
    exit 0
  fi
  echo "attempt $try failed: $(tr '\r' '\n' < "$LOG" | grep -E '^Rendered' | tail -1)" >> out/film-render-retries.log
  pkill -9 -f "chromium_headless_shell.*remotion" 2>/dev/null
  try=$((try + 1))
done
echo failed >> "$LOG"
exit 1
