# Day-1 verification (2026-11-02)

Environment: MacBook, Apple M4, 16GB unified memory / macOS (Darwin 25.5) / Node 22.22 / Python 3.12 (uv) / PyTorch 2.15 (MPS) / transformers 5.22.1 / Docker 29.8.

Test images (all outside the repo, under `$DATA_DIR/samples/`):

| File | Source | License |
| --- | --- | --- |
| `kaminarimon_cc0.jpg` | [Wikimedia Commons: Lantern of Kaminarimon Gate](https://commons.wikimedia.org/wiki/File:Lantern_of_Kaminarimon_Gate.JPG), 1600px | CC0 |
| `met_56689.jpg` | The Met 56689 primaryImage (DP121552) | Public domain (`isPublicDomain: true`) |

Note: `kaminarimon_cc0.jpg` shows the inner side of the gate; the lantern reads 「風雷神門」, not 「雷門」. Re-run FR-06 with a front-side photo when we shoot on site (11/4).

## 1. SAM 3 (open item 2) — GO

`facebook/sam3` @ `3c879f39` loaded via `transformers.Sam3Model` (safetensors, no `trust_remote_code`). Needs `torchvision`.
Run with `PYTORCH_ENABLE_MPS_FALLBACK=1`: **no op fell back to CPU.**

| Input | Prompt | Latency (warm) | Result |
| --- | --- | --- | --- |
| Kaminarimon photo 1600×2156 | text "paper lantern" | 2.9 s | 1 instance, score 0.894, bbox (0.117, 0.307)–(0.704, 0.828); mask follows the lantern outline incl. the gilt base |
| same | box around lantern | 4.1 s | score 0.987, same bbox |
| Hiroshige 56689 2624×3840 | text "paper lantern" / "lantern" | 2.9 s | **0 instances** |
| same | box (918,262)–(2493,1394) | 3.0 s | score 0.989, bbox (0.353, 0.067)–(0.948, 0.365) |

- Load: 4.8 s. MPS memory: ~3.2 GB after load, ~4.3 GB driver peak during inference, back to ~2.2 GB after `empty_cache`.
- Via the FastAPI server (`/segment`): first call 10.1 s wall (includes load), warm 2.9 s. Meets the 15 s "first mask" budget (4.13) only if the model is pre-warmed → **warm the model when a capture starts.**
- **Decision**: SAM 3 is adopted; SAM 2.1 fallback not needed.
- **Finding**: text prompts fail on the woodblock print. For artifacts (FR-30) use the pre-annotated box prompt, which the requirements already allow (`annotated_by`).

## 2. Depth Anything V2 Small — GO

`depth-anything/Depth-Anything-V2-Small-hf` @ `5426e4f0`. Load 0.5 s, inference 103 ms (photo) / 101 ms (Hiroshige) on MPS, no CPU fallback, ~1.2 GB driver peak. Via `/depth`: 0.6 s wall.

## 3. Claude image understanding (FR-06) — pass, retest with front-side photo

`npm run see -- $DATA_DIR/samples/kaminarimon_cc0.jpg` (model `claude-opus-5-5`, adaptive thinking, effort medium, structured output, server-side fallback enabled).

- Lantern: `text_original` 「風雷神門」, reading "Fūraijinmon", meaning "Gate of the Wind and Thunder Gods (formal name of Kaminarimon)". Box (0.11, 0.38, w 0.60, h 0.42) — consistent with the SAM 3 mask.
- Also read 「平成二十五年十一月吉日」 and 「松下幸之助」 on the base.
- Place rank 1 (confidence 0.97): 浅草 (area) › 金龍山浅草寺 (site) › 雷門（風雷神門）/ Kaminarimon (Thunder Gate) (structure).
- People were present but not described (as instructed).
- 18.7 s, 4,483 input + 1,375 output tokens, cache write 1,807, **$0.054** per call. The 10 s "cultural elements" budget (4.13) is not met at effort medium → try effort `low` and/or streaming the elements on 11/3.

### Rate limits (open item 1)

From `anthropic-ratelimit-*` headers on that call: requests 45,000/min, input tokens 10,000,000/min, output tokens 2,000,000/min. Plenty for the 14-calls-per-exploration budget.

## 4. The Met API (section 8)

| Endpoint | Status |
| --- | --- |
| `/public/collection/v1.1/search` | **200** (56689 included in results) |
| `/public/collection/v1/search` | 410 Gone |
| `/public/collection/v1.1/objects/56689` | 404 |
| `/public/collection/v1/objects/56689` | **200** |

→ Search uses **v1.1**, object detail uses **v1**. Record saved to `fixtures/met/56689.json` (CC0 data): "Kinryūsan Temple at Asakusa, from the series 'One Hundred Famous Views of Edo'", Utagawa Hiroshige, 1856, `isPublicDomain: true`.

## 5. Neo4j

`neo4j:5-community` = **5.26.32** (multi-arch, arm64 confirmed), pinned by index digest. `npm run graph:init` → 11 uniqueness constraints + 2 indexes, seed 4 entities / 3 relationships; second run is idempotent. Container: 1.37 GB / 2 GB limit.

## 6. Memory with everything running

Neo4j + inference server (SAM 3 and depth both loaded) + `next start`:

| Process | Memory |
| --- | --- |
| python (inference, both models) | 4.8 GB |
| Docker VM (Docker Desktop allocation 7.7 GB; Neo4j uses 1.4 GB of it) | 4.2 GB |
| another virtualization VM (not TSUMUGI) | 2.1 GB |
| system total | 14 GB used, swap 5.2 GB |

Actions:
- Lower Docker Desktop memory to ~4 GB (user agreed).
- The inference server releases idle models after 300 s (`INFERENCE_IDLE_RELEASE_S`).
- Close unrelated VMs/apps during demos.
- Re-measure after the Docker change.

## 7. Input for the 11/3 night GO/fallback decision

| Item | Status |
| --- | --- |
| SAM 3 on MPS | GO (no fallback, ~3 s warm) |
| Depth | GO (~0.1 s) |
| Artifact masks | box prompt works; text prompt does not → pre-annotate |
| Memory headroom | tight; re-measure with Docker at 4 GB |
| Claude latency for stage 1 | 18.7 s, over the 10 s target → tune on 11/3 |
