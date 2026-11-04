# How the score was made

Composed by Claude (Claude Code, Opus 5.5) as code. No music model, no licensed track.

- **The brief, from the author:** compose the music for this demo yourself, with surprise, pause and
  being moved; later, strong contrast between slow and fast for impact.
- **What Claude wrote:** the theme (E A G D), the harmony, every note's time and level
  (`compose.py`), and the renderer (`engine.py`).
- **What the author decided:** direction and approval, by listening. Claude cannot hear; it checks
  note times, level curves and peaks, and the author judges whether it is beautiful.
- **Sounds:** the plucked string is the app's own (`apps/web/src/lib/live/feel.ts`, `pluckSamples`),
  ported to Python. Strings and percussion are VSCO 2 Community Edition samples (CC0,
  https://github.com/sgossner/VSCO-2-CE), fetched by `fetch-samples.sh` and not committed. Wind, the
  pull of the thread, the thunder's rumble and the hall are synthesised from noise.

To rebuild: `sh score/fetch-samples.sh`, then `score/.venv/bin/python score/compose.py`.
