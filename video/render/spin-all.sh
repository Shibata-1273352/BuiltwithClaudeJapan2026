#!/bin/sh
# Renders the shot in short Blender runs: one long run stops partway without an error, and
# spin.py skips the frames already on disk, so a run that dies only costs its unfinished frame.
# usage: render/spin-all.sh <res> <samples> <out dir> [last frame]
res=$1; samples=$2; out=$3; last=${4:-179}
pass=0
while [ "$pass" -lt 4 ]; do
  f=0
  while [ "$f" -le "$last" ]; do
    to=$((f + 29)); [ "$to" -gt "$last" ] && to=$last
    blender -b -P "${SCRIPT:-render/spin.py}" -- --frames "$f" "$to" --res "$res" --samples "$samples" --out "$out" 2>&1 | grep -E "RENDERED|Traceback"
    f=$((to + 1))
  done
  [ "$(ls "$out" | wc -l)" -gt "$last" ] && break
  pass=$((pass + 1))
done
echo "frames on disk: $(ls "$out" | wc -l) of $((last + 1))"
