#!/bin/sh
# Renders the film and restarts it when it stops making progress. After a browser crash Remotion can
# hang without exiting, so waiting for it to finish is not enough: a silent log means a stalled render.
LOG=out/film-render.log
STALL=180 # seconds of silence
TRIES=6

# Chromium hangs off a child of the render, so the whole tree has to go.
kill_tree() {
  for child in $(pgrep -P "$1"); do kill_tree "$child"; done
  kill -9 "$1" 2>/dev/null
}

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
      kill_tree "$pid"
      break
    fi
  done
  # a crash Remotion recovers from leaves "Error:" in the log, so only the exit status and the last frame count
  if wait "$pid" && tr '\r' '\n' < "$LOG" | awk -F'[ /]' '$1 == "Encoded" && $2 == $3 { ok = 1 } END { exit !ok }'; then
    echo done >> "$LOG"
    exit 0
  fi
  echo "attempt $try failed: $(tr '\r' '\n' < "$LOG" | grep -E '^Rendered' | tail -1)" >> out/film-render-retries.log
  try=$((try + 1))
done
echo failed >> "$LOG"
exit 1
