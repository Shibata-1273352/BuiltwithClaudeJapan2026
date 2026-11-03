# How Claude is used — in the product and in building it

## In the product: what Claude does, and what code decides

TSUMUGI gives Claude the jobs that need reading and judgment, and keeps every yes/no that a
traveler would rely on in code. The live stage shows the same split while it runs (the
「舞台裏」 panel and the chips above the photo: *Claude* / *ローカルGPU* / *コード* / *Neo4j*).

| Stage | Claude (`claude-opus-5-5`) | Code |
| --- | --- | --- |
| 視る see | Reads the photo: text in its original script, reading, meaning; element boxes; place candidates as a hierarchy; **viewpoint guess with premises** (FR-35, pencil) | Validates boxes/ranks; drops a viewpoint without premises; maps candidates to the entity dictionary (an unknown place stops honestly) |
| 探す search | — | Facet × language plan, FTS over the public-domain corpus |
| 確かめる check | Proposes claims with exact excerpts (en ∥ ja in parallel); judges **what is missing** and proposes extra search terms (`gap.assessment`, shown as "Claudeの判断") | Seven checks per claim (sentence ids exist, subject/object known, named in the sentence, negation, time) → accepted / downgraded / rejected |
| 時を照らす time | — | "Did it exist when the source was written?" against a reviewed chronology. Claude is never asked this |
| 紡ぐ weave | Writes the story citing claim ids | Every sentence's citations re-checked; failures dropped; thread line styles decided from state |
| 間 space | Marked the anchors on the Hiroshige print once (recorded as `annotated_by`) | SAM 3 + depth on the local GPU; similarity transform; SigLIP visual search (not evidence) |
| 連想 (FR-59) | — | Personalized PageRank over the Evidence Graph (Neo4j), shown in pencil |

API features in use (each chosen for a reason):

- **Native citations** (`search_result` blocks, one text block per sentence) for 「糸を引く」:
  Claude answers a visitor's question from this run's passages only; code keeps a citation only if
  its quote is in the corpus, and with none left the answer is "not in the sources" (`lib/ask.ts`).
- **Model split**: Opus to read the photo and write the story; Sonnet for the gap judgment, the
  viewpoint and the guide notes (Opus in fast mode for the live demo).
- **Fast mode** (`speed: "fast"`) only for the live demo, retried at standard speed on rate limits.
- **Streaming** of the reading and the story, so the first answer appears within seconds.

- **Structured outputs** (`betaZodOutputFormat` / `zodOutputFormat`): every Claude answer is a
  zod schema; code validation runs on top.
- **Server-side fallback** (`server-side-fallback-2026-07-01`, `fallbacks: "default"`): a live
  demo must not stop on one model's capacity; the stage shows the model that actually answered.
- **Adaptive thinking**, **effort** per stage, **prompt caching** of system prompts (ephemeral).
- **Message Batches API** for the evaluation (`npm run eval`): 23 requests, $0.38 at 50% cost;
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
  (one live sample run ≈ $0.24).


## What Claude Code made possible in the final week (2026-11-03/04)

- **A judge's eye on demand.** The `design-critic` subagent (`.claude/agents/design-critic.md`)
  reviewed the real screenshots against the CLAUDE.md design rules and the judging criteria three
  times. Each round found what we no longer saw: a dashboard-like stage, raw scores on screen, a
  seam where the print met the photo, the friend's second question unanswered in presenter mode.
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
  `/align` endpoint took the demo run from 24.8 s to 13.6–16.3 s.
