# How Claude is used — in the product and in building it

## In the product: what Claude does, and what code decides

TSUMUGI gives Claude the jobs that need reading and judgment, and keeps every yes/no that a
traveler would rely on in code. The live stage shows the same split while it runs (the
「舞台裏」 panel and the chips above the photo: *Claude* / *ローカルGPU* / *コード* / *Neo4j*).

| Stage | Claude | Code |
| --- | --- | --- |
| 視る see | Reads the photo: text in its original script, reading, meaning; element boxes; place candidates as a hierarchy; **viewpoint guess with premises** (FR-35, pencil) | Validates boxes/ranks; drops a viewpoint without premises; maps candidates to the entity dictionary (an unknown place stops honestly) |
| 探す search | — | Facet × language plan, FTS over the public-domain corpus |
| 確かめる check | Proposes claims with exact excerpts (en ∥ ja in parallel); judges **what is missing** and proposes extra search terms (`gap.assessment`, shown as "Claudeの判断") | Seven checks per claim (sentence ids exist, subject/object known, named in the sentence, negation, time) → accepted / downgraded / rejected |
| 時を照らす time | — | "Did it exist when the source was written?" against a reviewed chronology. Claude is never asked this |
| 紡ぐ weave | Writes the story citing claim ids | Every sentence's citations re-checked; failures dropped; thread line styles decided from state |
| 間 space | Marked the anchors on the Hiroshige print once (recorded as `annotated_by`) | SAM 3 + depth on the local GPU; similarity transform; SigLIP visual search (not evidence) |
| 連想 (FR-59) | — | Personalized PageRank over the Evidence Graph (Neo4j), shown in pencil |
| 寄って読む closer | Reads a small plate again from a crop | Picks what to look at, crops it, and keeps the new reading only if it contains the old one |
| ガイド guide | Writes what to look at, what to try and how the kanji are built | Labels it as Claude's guide, never as evidence |
| 糸を引く ask | Answers from this run's sources, with native citations | Keeps a citation only if its quote is in the corpus |

Which model runs each stage, and where each prompt lives: [`docs/models.md`](models.md).

The rule that makes this split work is written into the prompts. From the extraction prompt ([`lib/extract.ts`](../apps/web/src/lib/extract.ts)):

```
- "describes"/"observed" only if the writer actually saw and wrote about that entity;
  "mentions" if it is only named; never upgrade.
- A temple (site), its deity (Kannon) and its gates (structures) are different entities.
  A passage about the temple is not about the gate.
- If the sentence denies or says the writer did not see/go, set negated=true.
```

Claude reports what a sentence says; code then decides what the claim may be used for.

API features in use (each chosen for a reason):

- **Native citations** (`search_result` blocks, one text block per sentence) for 「糸を引く」:
  Claude answers a visitor's question from this run's passages only; code keeps a citation only if
  its quote is in the corpus, and with none left the answer is "not in the sources" (`lib/ask.ts`).
- **Model split** (standard speed; in fast mode every call is Opus): Opus to read the photo and write the story; Sonnet for the gap judgment, the
  viewpoint and the guide notes (Opus in fast mode for the live demo).
- **Fast mode** (`speed: "fast"`) only for the live demo, retried at standard speed on rate limits.
- **Streaming** of the reading and the story, so the first answer appears within seconds.

- **Structured outputs** (`betaZodOutputFormat` / `zodOutputFormat`): every Claude answer is a
  zod schema; code validation runs on top.
- **Server-side fallback** (`server-side-fallback-2026-07-01`, `fallbacks: "default"`): a live
  demo must not stop on one model's capacity; the stage shows the model that actually answered.
- **Adaptive thinking**, **effort** per stage, **prompt caching** of system prompts (ephemeral).
- **Message Batches API** for the evaluation (`npm run eval`), at 50% cost (request count and cost in each report under `evaluation/results/`);
  the batch uses the same request builders as the live run, so the evaluation measures the
  product, not a copy of it.
- Untrusted text (sources, OCR) is wrapped and Claude is told it is data, never instructions
  (SEC-01..03 test this with real calls).

## In building it: Claude Code

- **Requirements → plan → review.** The requirements (`docs/REQUIREMENTS.md`) were turned into
  plans in plan mode; an independent review pass checked each plan before code (day 1 it caught a
  missing git base and a mis-located fixtures folder; the live-stage redesign review caught a
  dimmed counter, a missing failure fallback, judge-facing links that would 404, and a checklist
  line claiming work the prompt did not yet ask for).
- **Subagents for research.** Broad searches (model choices for Japanese text and images, SAM 3
  prompts, state-of-the-art "show the AI working" UIs) ran in subagents; only their conclusions
  came back into the main thread.
- **Skills.** The `claude-api` skill was read before touching any Claude call (Batch API rules:
  no fallbacks in batches; model ids; pricing for the cost guard).
- **Verification on the real machine.** Each model was run on this Mac (MPS) before being
  depended on; results are in `docs/verification/`. The live stage was checked by timed
  screenshots of real runs (`scripts/stage-shots.ts`, `scripts/e2e-sample.ts`).
- **Guard rails while working autonomously.** A gitleaks pre-commit hook (lefthook); `.env` is
  written only by a human; no destructive commands; costs reported per run
  (a live run averages $0.323, [stored per call](../evaluation/results/2026-11-04.md)).


## What Claude Code made possible while building

- **A judge's eye on demand.** The `design-critic` subagent (`.claude/agents/design-critic.md`)
  reviewed the real screenshots against the CLAUDE.md design rules and the judging criteria, round
  after round. Each round found what we no longer saw: a dashboard-like stage, raw scores on screen, a
  seam where the print met the photo, the friend's second question unanswered in presenter mode.
  [PR #20](https://github.com/Shibata-1273352/BuiltwithClaudeJapan2026/pull/20) moved the stage from 31 pill shapes and 20 nested boxes to none; [PR #31](https://github.com/Shibata-1273352/BuiltwithClaudeJapan2026/pull/31)
  cut the visible Japanese on the landing's first screen from 274 characters to 93.
- **Rules that hold while moving fast.** A PostToolUse hook (`.claude/settings.json`) runs the
  design rules test after every edit of a screen file and feeds a failure back to Claude in the
  same turn, so a 4K pass or a new panel cannot quietly break the type scale or the glow rule.
- **Knowing what to check.** The `tsumugi-verify` skill maps each kind of change to its check
  script and its Claude cost; `scripts/acceptance.ts` runs all twelve screen checks in one go.
- **Parallel work without collisions.** A subagent converted the remaining screens to ja/en while
  the main thread built the cited Q&A; another scanned the requirements for unimplemented P0/P1
  items (it found FR-16, now shown in the time panel). A second build directory (`NEXT_DIST_DIR`)
  let the work build run beside the one the user was reviewing.
- **Measured, not guessed.** Every performance change was profiled from the stored stage events
  before and after (`scripts/profile-run.ts`): moving 間 to the start of the run and adding the
  `/align` endpoint took the demo run from 24.8 s to 13.6–16.3 s ([PR #22](https://github.com/Shibata-1273352/BuiltwithClaudeJapan2026/pull/22), [PR #27](https://github.com/Shibata-1273352/BuiltwithClaudeJapan2026/pull/27)).

## The demo film, also made with Claude Code

The film is source code, in [`video/`](../video/); the media it produces stays out of git.

- **One timeline.** [`video/timeline.json`](../video/timeline.json) and
  [`narration/lines.json`](../video/narration/lines.json) drive the Remotion edit, the score and the
  table in [`docs/demo-script.md`](demo-script.md).
- **Music composed as code.** Claude wrote the score in [`video/score/`](../video/score/); no
  music-generation model was used ([provenance](../video/score/PROVENANCE.md)).
- **Silk rendered from Python.** The threads are fibres in Blender Cycles ([`video/render/`](../video/render/)).
  The knot took three attempts. Frame review found the first two read as rope and chain links, so
  [`knot_sim.py`](../video/render/knot_sim.py) now weaves a real awaji-musubi and draws it tight with
  physics ([PR #56](https://github.com/Shibata-1273352/BuiltwithClaudeJapan2026/pull/56)); the sound lands on the measured stop of the knot.
- **Automatic checks for the film.** [`video/scripts/qa.mjs`](../video/scripts/qa.mjs) checks length, loudness,
  subtitles against the voice, and how much of the film is the real app.
- **The app changed for the film, not the edit.** Where a scene was weak, the fix went into the
  product and the take was recorded again ([PR #37](https://github.com/Shibata-1273352/BuiltwithClaudeJapan2026/pull/37), [PR #52](https://github.com/Shibata-1273352/BuiltwithClaudeJapan2026/pull/52)).
