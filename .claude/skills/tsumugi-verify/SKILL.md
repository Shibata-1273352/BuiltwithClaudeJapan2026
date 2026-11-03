---
name: tsumugi-verify
description: Which TSUMUGI check to run for which change — unit tests, the design rules, live and replay E2E, and the screenshot scripts — and what each costs. Use before a PR or after changing the live stage, the panels, the landing page or the pipeline.
---

# Verifying a TSUMUGI change

Always, before a PR (CLAUDE.md): `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
While someone reviews the app on :3100, build the work copy aside: `NEXT_DIST_DIR=.next-work npm run build`
and `NEXT_DIST_DIR=.next-work npm run start -w web -- -p 3200` — never rebuild :3100 under them.

Pick the checks by what changed. Prefer the public recording (`DEMO_REPLAY_ID`, no Claude call);
report the cost of every live run.

| Changed | Run | Claude cost |
| --- | --- | --- |
| any file in `apps/web/src/app` | the design hook runs `design.test.ts` after each edit (`.claude/settings.json`) | none |
| the pipeline (`lib/dag/run.ts`, prompts) | `scripts/e2e-sample.ts <base>` (live), then `scripts/profile-run.ts <exp>` for timings and cost | one run |
| a place with no sources | `scripts/e2e-anywhere.ts <base> <photo>` | reading + guide only |
| the stage, touch, threads, the years | `scripts/loom-check.ts <base> <replay> [--lang en] [--no-ask]` | a question if not `--no-ask` |
| 時をめくる panel | `scripts/time-shot.ts <base> [replay] [--lang en]` | none |
| 言の地層 panel | `scripts/names-shot.ts <base> [replay] [--lang en]` | none |
| 絵の中へ (3D) | `scripts/space-shot.ts <base> <scene> [--auto]` | none |
| the landing page images | `scripts/landing-shots.ts <base> [replay]` (writes `apps/web/public/landing/`) | none |
| the demo flow end to end | `scripts/rehearse.ts <base>`, `scripts/e2e-demo.ts <base>` | none |
| the look overall | `scripts/design-shots.ts <base> <label>` then the `design-critic` subagent on the PNGs | none |
| performance | `scripts/profile-run.ts`, `bench-see.ts`, `bench-scene.ts` before and after | per bench |

Screenshots land in `$DATA_DIR/out/screens/…`. Read them; a passing script is not a good-looking screen.
The evaluation (Batch API) runs once, aggregated, when features are done: `npm run eval`.
