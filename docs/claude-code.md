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
