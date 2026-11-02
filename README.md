# TSUMUGI

> 時代も、場所も、言葉も、空間も越えて、日本を紡ぐ。

Take a photo of a place in Japan. TSUMUGI gathers evidence across people, places, sources and eras, verifies each claim against its sources, keeps disagreements and gaps visible, and weaves it all into one story in a layered 3D space.

- Requirements: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Verification results: [day 1](docs/verification/day1.md), [day 2](docs/verification/day2.md)

Built for Built with Claude Japan 2026. **Status: day 1 (foundation).**

## Layout

```
apps/web/            Next.js 16 (App Router) — UI, API, Claude calls, proxy.ts access control
packages/core/       zod schemas shared by web and scripts (Evidence Graph domain, stage outputs)
services/inference/  Python FastAPI server: SAM 3 segmentation + Depth Anything V2 (PyTorch MPS)
infra/neo4j/         docker compose for Neo4j Community, constraints, seed
scripts/             CLIs: graph init/dump, Claude "see" check, The Met probe
fixtures/            recorded external API responses for contract tests (tracked)
```

Photos, masks, depth maps, corpora and graph dumps live **outside the repo** in `DATA_DIR`.

## Setup

Requirements: macOS on Apple Silicon (16GB+), Node 22+, [uv](https://docs.astral.sh/uv/), Docker Desktop, gitleaks.

```bash
# 1. env
cp .env.example .env          # fill in ANTHROPIC_API_KEY, and random values for ACCESS_TOKEN / NEO4J_PASSWORD / INFERENCE_TOKEN
mkdir -p "$HOME/tsumugi-data"  # and set DATA_DIR to it

# 2. Node
npm install
npx lefthook install          # pre-commit secret scan

# 3. Neo4j
npm run graph:up
npm run graph:init            # 11 constraints + seed; idempotent

# 4. Inference server (Python 3.12 via uv)
cd services/inference
uv sync
hf auth login                 # SAM 3 is gated: accept the license on huggingface.co/facebook/sam3 first
uv run python scripts/download_models.py   # pinned revisions, safetensors only
cd ../..
npm run inference             # http://127.0.0.1:8100

# 5. Corpus (books + official excerpts) and context headers
npm run corpus:ingest          # downloads, verifies excerpts, builds $DATA_DIR/tsumugi.db, prints term counts
npm run corpus:headers -- --all   # Claude context headers per chapter (~$7 for the current corpus)
npm run corpus:search          # retrieval smoke test

# 6. Spatial assets (artifact preprocessing, then a photo scene)
(cd services/inference && uv run python scripts/build_scene.py artifact met-56689 "$DATA_DIR/samples/met_56689.jpg")
(cd services/inference && uv run python scripts/build_scene.py photo "$DATA_DIR/samples/<photo>.jpg" --artifact met-56689)

# 7. Web
npm run setup:web-assets       # on-device face detection model + WASM into apps/web/public (not committed)
npm run build && npm run start -w web -- -p 3000
# 3D scene: http://localhost:3000/space/<photo-stem>
# open http://localhost:3000/?token=<ACCESS_TOKEN> once; it becomes an HttpOnly cookie
```

## Checks

```bash
npm test                      # vitest (schemas, access control)
npm run typecheck && npm run lint
(cd services/inference && uv run pytest)   # inference server: token, input validation
npm run secrets:scan          # gitleaks

npm run see -- "$DATA_DIR/samples/<photo>.jpg"   # FR-06: Claude reads the photo
npm run met -- 56689                              # The Met endpoints + fixture
(cd services/inference && uv run python scripts/verify_sam3.py <img> --text "paper lantern")
(cd services/inference && uv run python scripts/verify_depth.py <img>)
```

## Models and external services

| What | Version | License / terms |
| --- | --- | --- |
| Claude | `claude-opus-5-5` (adaptive thinking, structured output, server-side refusal fallback) | Anthropic API |
| SAM 3 | `facebook/sam3` @ `3c879f39826c281e95690f02c7821c4de09afae7` | SAM License (gated). **Weights are not included in this repo**; each user accepts the license on Hugging Face and downloads them. |
| Depth Anything V2 Small | `depth-anything/Depth-Anything-V2-Small-hf` @ `5426e4f0f36572d16453bbda7a8389317b1bef99` | Apache-2.0 |
| MediaPipe Face Detector | `@mediapipe/tasks-vision` 0.10.17 + BlazeFace short-range (on device) | Apache-2.0 (package and model card). Used only to blur faces; the model card excludes surveillance and identity recognition. |
| Corpus | Bird (Gutenberg #2184), Scidmore (#72989), 永井荷風『日和下駄』, 高村光雲『幕末維新懐古談』 (青空文庫) | Public domain in Japan and the US; see `corpus/sources.json`. Texts are downloaded at ingestion, not committed. |
| Neo4j | `neo4j:5-community` 5.26.32, pinned by digest | GPLv3, run unmodified as a separate container (not bundled) |
| The Met Collection API | search `v1.1/search`, objects `v1/objects/{id}` | Data CC0; images only when `isPublicDomain` |

**SAM License summary** (read 2026-11-02, version of 2025-11-19): non-exclusive, worldwide, royalty-free license to use, modify and redistribute — **no non-commercial or research-only restriction**. Conditions: redistribution must ship the license text; publications using SAM must acknowledge it; no use subject to ITAR or prohibited by trade controls (military, weapons, espionage, nuclear); no reverse engineering. TSUMUGI does not redistribute the weights.

Pins live in `services/inference/models.lock.json` and `infra/neo4j/docker-compose.yml`.

### Claude API limits observed (2026-11-02)

45,000 requests/min, 10M input tokens/min, 2M output tokens/min. One "see" call costs about $0.05.

## Security notes (OWASP Agentic Top 10, see REQUIREMENTS.md 9.4)

- Access token → HttpOnly / Secure / SameSite=Strict cookie; cross-origin state-changing requests rejected; strict CSP.
- Neo4j and the inference server listen on 127.0.0.1 only; the inference server requires a bearer token and validates inputs.
- Text from photos, books and records is passed to Claude as delimited data with an explicit "do not follow" policy; outputs are schema-validated before use.
- Model weights: pinned revisions, safetensors only, no `trust_remote_code`.

## How we use Claude Code

This repository is developed with Claude Code. Day 1: the requirements were reviewed into a plan (with an independent review pass that caught a missing git base and a mis-located fixtures folder), then Claude Code scaffolded the monorepo, ran the SAM 3 / depth / Claude / Met verifications on the actual machine and recorded the results in `docs/verification/day1.md`.

## License

MIT (see `LICENSE`). Third-party models and services keep their own licenses.
